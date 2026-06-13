const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 8448;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function calcAge(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < birth.getDate()) { months--; if (months < 0) { years--; months += 12; } }
  return { years, months, text: `${years}岁${months}月` };
}

function getLifeStage(species, ageYears) {
  if (species === '狗') {
    if (ageYears <= 1) return '幼年';
    if (ageYears <= 7) return '成年';
    return '老年';
  } else if (species === '猫') {
    if (ageYears <= 1) return '幼年';
    if (ageYears <= 10) return '成年';
    return '老年';
  } else {
    if (ageYears <= 1) return '幼年';
    if (ageYears <= 5) return '成年';
    return '老年';
  }
}

function getLifeStageAdvice(species, stage) {
  const adviceMap = {
    '狗': {
      '幼年': '幼犬需要少食多餐(每日3-4次)，注意社会化训练，按时完成疫苗接种和驱虫。避免剧烈运动以保护关节发育。',
      '成年': '成犬每日喂食2次，保持规律运动(每日30-60分钟)。每年体检1次，按时接种疫苗和驱虫。注意体重管理。',
      '老年': '老年犬建议半年体检1次，适当补充关节营养品。减少运动强度，注意心脏和肾脏健康。选择易消化的老年犬粮。'
    },
    '猫': {
      '幼年': '幼猫需要少食多餐(每日4-5次)，注意社会化训练，按时完成疫苗接种和驱虫。提供安全的探索环境。',
      '成年': '成猫每日喂食2次，保证充足饮水。每年体检1次，注意口腔健康。提供适当的运动和玩耍时间，避免肥胖。',
      '老年': '老年猫建议半年体检1次，关注肾脏和甲状腺功能。增加饮水点，选择易消化的老年猫粮。注意行为变化。'
    }
  };
  const speciesAdvice = adviceMap[species] || adviceMap['猫'];
  return speciesAdvice[stage] || speciesAdvice['成年'];
}

// ===== PETS =====
app.get('/api/pets', (req, res) => {
  const pets = db.prepare('SELECT * FROM pets ORDER BY id').all();
  const result = pets.map(p => ({ ...p, age: calcAge(p.birth_date), lifeStage: getLifeStage(p.species, calcAge(p.birth_date).years) }));
  res.json(result);
});

app.get('/api/pets/:id', (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });
  res.json({ ...pet, age: calcAge(pet.birth_date), lifeStage: getLifeStage(pet.species, calcAge(pet.birth_date).years) });
});

app.post('/api/pets', (req, res) => {
  const { name, species, breed, birth_date, weight, gender, neutered, photo_url } = req.body;
  if (!name || !species || !birth_date) return res.status(400).json({ error: '名字、种类和出生日期为必填项' });
  const result = db.prepare(
    'INSERT INTO pets (name, species, breed, birth_date, weight, gender, neutered, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, species, breed, birth_date, weight, gender, neutered ? 1 : 0, photo_url);
  if (weight) {
    db.prepare('INSERT INTO weight_records (pet_id, weight, recorded_date) VALUES (?, ?, ?)').run(result.lastInsertRowid, weight, new Date().toISOString().split('T')[0]);
  }
  res.json({ id: result.lastInsertRowid, message: '宠物添加成功' });
});

app.put('/api/pets/:id', (req, res) => {
  const { name, species, breed, birth_date, weight, gender, neutered, photo_url } = req.body;
  db.prepare(
    'UPDATE pets SET name=?, species=?, breed=?, birth_date=?, weight=?, gender=?, neutered=?, photo_url=? WHERE id=?'
  ).run(name, species, breed, birth_date, weight, gender, neutered ? 1 : 0, photo_url, req.params.id);
  res.json({ message: '更新成功' });
});

app.delete('/api/pets/:id', (req, res) => {
  db.prepare('DELETE FROM pets WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== WEIGHT RECORDS =====
app.get('/api/pets/:id/weights', (req, res) => {
  const weights = db.prepare('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY recorded_date').all(req.params.id);
  res.json(weights);
});

app.post('/api/pets/:id/weights', (req, res) => {
  const { weight, recorded_date } = req.body;
  if (!weight || !recorded_date) return res.status(400).json({ error: '体重和日期为必填项' });
  db.prepare('INSERT INTO weight_records (pet_id, weight, recorded_date) VALUES (?, ?, ?)').run(req.params.id, weight, recorded_date);
  db.prepare('UPDATE pets SET weight = ? WHERE id = ?').run(weight, req.params.id);
  res.json({ message: '体重记录添加成功' });
});

app.delete('/api/weights/:id', (req, res) => {
  db.prepare('DELETE FROM weight_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== VACCINATIONS =====
app.get('/api/pets/:id/vaccinations', (req, res) => {
  const records = db.prepare('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY vaccination_date DESC').all(req.params.id);
  res.json(records);
});

app.post('/api/pets/:id/vaccinations', (req, res) => {
  const { vaccine_name, vaccination_date, next_vaccination_date, institution } = req.body;
  if (!vaccine_name || !vaccination_date) return res.status(400).json({ error: '疫苗名称和接种日期为必填项' });
  db.prepare('INSERT INTO vaccinations (pet_id, vaccine_name, vaccination_date, next_vaccination_date, institution) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, vaccine_name, vaccination_date, next_vaccination_date, institution);
  res.json({ message: '疫苗接种记录添加成功' });
});

app.delete('/api/vaccinations/:id', (req, res) => {
  db.prepare('DELETE FROM vaccinations WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== DEWORMING =====
app.get('/api/pets/:id/deworming', (req, res) => {
  const records = db.prepare('SELECT * FROM deworming_records WHERE pet_id = ? ORDER BY deworming_date DESC').all(req.params.id);
  res.json(records);
});

app.post('/api/pets/:id/deworming', (req, res) => {
  const { deworming_date, next_deworming_date, medicine_name, notes } = req.body;
  if (!deworming_date) return res.status(400).json({ error: '驱虫日期为必填项' });
  db.prepare('INSERT INTO deworming_records (pet_id, deworming_date, next_deworming_date, medicine_name, notes) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, deworming_date, next_deworming_date, medicine_name, notes);
  res.json({ message: '驱虫记录添加成功' });
});

app.delete('/api/deworming/:id', (req, res) => {
  db.prepare('DELETE FROM deworming_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== CHECKUPS =====
app.get('/api/pets/:id/checkups', (req, res) => {
  const records = db.prepare('SELECT * FROM checkup_records WHERE pet_id = ? ORDER BY checkup_date DESC').all(req.params.id);
  res.json(records);
});

app.post('/api/pets/:id/checkups', (req, res) => {
  const { checkup_date, items, result, doctor_advice } = req.body;
  if (!checkup_date) return res.status(400).json({ error: '体检日期为必填项' });
  db.prepare('INSERT INTO checkup_records (pet_id, checkup_date, items, result, doctor_advice) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, checkup_date, items, result, doctor_advice);
  res.json({ message: '体检记录添加成功' });
});

app.delete('/api/checkups/:id', (req, res) => {
  db.prepare('DELETE FROM checkup_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== MEDICATION PLANS =====
app.get('/api/pets/:id/medications', (req, res) => {
  const plans = db.prepare('SELECT * FROM medication_plans WHERE pet_id = ? ORDER BY start_date DESC').all(req.params.id);
  res.json(plans);
});

app.post('/api/pets/:id/medications', (req, res) => {
  const { medicine_name, dosage, frequency_per_day, duration_days, start_date } = req.body;
  if (!medicine_name || !dosage || !frequency_per_day || !duration_days || !start_date) {
    return res.status(400).json({ error: '所有字段为必填项' });
  }
  const planResult = db.prepare(
    'INSERT INTO medication_plans (pet_id, medicine_name, dosage, frequency_per_day, duration_days, start_date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, medicine_name, dosage, frequency_per_day, duration_days, start_date);

  const planId = planResult.lastInsertRowid;
  const startDate = new Date(start_date);
  for (let d = 0; d < duration_days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const hours = [];
    for (let h = 0; h < frequency_per_day; h++) {
      const hour = Math.floor(8 + (14 * h / Math.max(1, frequency_per_day - 1)));
      hours.push(hour);
    }
    for (const hour of hours) {
      const timeStr = `${dateStr} ${String(hour).padStart(2, '0')}:00`;
      db.prepare('INSERT INTO medication_reminders (plan_id, pet_id, reminder_time) VALUES (?, ?, ?)').run(planId, req.params.id, timeStr);
    }
  }
  res.json({ id: planId, message: '用药计划添加成功' });
});

app.put('/api/medications/:id', (req, res) => {
  db.prepare('UPDATE medication_plans SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.json({ message: '更新成功' });
});

app.delete('/api/medications/:id', (req, res) => {
  db.prepare('DELETE FROM medication_plans WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM medication_reminders WHERE plan_id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== MEDICATION REMINDERS =====
app.get('/api/pets/:id/reminders', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const reminders = db.prepare(`
    SELECT mr.*, mp.medicine_name, mp.dosage, p.name as pet_name
    FROM medication_reminders mr
    JOIN medication_plans mp ON mr.plan_id = mp.id
    JOIN pets p ON mr.pet_id = p.id
    WHERE mr.pet_id = ? AND mr.reminder_time LIKE ?
    ORDER BY mr.reminder_time
  `).all(req.params.id, `${date}%`);
  res.json(reminders);
});

app.get('/api/reminders/today', (req, res) => {
  const date = new Date().toISOString().split('T')[0];
  const reminders = db.prepare(`
    SELECT mr.*, mp.medicine_name, mp.dosage, p.name as pet_name
    FROM medication_reminders mr
    JOIN medication_plans mp ON mr.plan_id = mp.id
    JOIN pets p ON mr.pet_id = p.id
    WHERE mr.reminder_time LIKE ? AND mr.status = 'pending'
    ORDER BY mr.reminder_time
  `).all(`${date}%`);

  const overdue = db.prepare(`
    SELECT mr.*, mp.medicine_name, mp.dosage, p.name as pet_name
    FROM medication_reminders mr
    JOIN medication_plans mp ON mr.plan_id = mp.id
    JOIN pets p ON mr.pet_id = p.id
    WHERE mr.reminder_time < ? AND mr.status = 'pending'
    ORDER BY mr.reminder_time
  `).all(`${date} 00:00`);

  res.json({ today: reminders, overdue });
});

app.put('/api/reminders/:id', (req, res) => {
  db.prepare('UPDATE medication_reminders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.json({ message: '更新成功' });
});

// ===== ALERTS =====
app.get('/api/pets/:id/alerts', (req, res) => {
  const petId = req.params.id;
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });

  const alerts = [];

  const weights = db.prepare('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY recorded_date DESC LIMIT 2').all(petId);
  if (weights.length >= 2) {
    const [latest, prev] = weights;
    const changeRate = ((latest.weight - prev.weight) / prev.weight) * 100;
    const daysDiff = (new Date(latest.recorded_date) - new Date(prev.recorded_date)) / (1000 * 60 * 60 * 24);
    const monthlyRate = daysDiff > 0 ? (changeRate / daysDiff) * 30 : 0;

    if (monthlyRate > 10) {
      alerts.push({ type: 'warning', category: '体重', message: `体重月增幅${monthlyRate.toFixed(1)}%，超过10%预警线，请注意饮食控制`, level: 'warning' });
    } else if (monthlyRate < -5) {
      alerts.push({ type: 'warning', category: '体重', message: `体重月减幅${Math.abs(monthlyRate).toFixed(1)}%，超过5%预警线，请关注健康状况`, level: 'warning' });
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const expiringVaccines = db.prepare(
    'SELECT * FROM vaccinations WHERE pet_id = ? AND next_vaccination_date BETWEEN ? AND ?'
  ).all(petId, today, sevenDaysLater);
  for (const v of expiringVaccines) {
    alerts.push({ type: 'vaccine', category: '疫苗', message: `${v.vaccine_name}即将到期，下次接种日期：${v.next_vaccination_date}`, level: 'warning', date: v.next_vaccination_date });
  }
  const expiredVaccines = db.prepare(
    'SELECT * FROM vaccinations WHERE pet_id = ? AND next_vaccination_date < ?'
  ).all(petId, today);
  for (const v of expiredVaccines) {
    alerts.push({ type: 'vaccine', category: '疫苗', message: `${v.vaccine_name}已过期！上次接种：${v.vaccination_date}，请尽快补种`, level: 'danger', date: v.next_vaccination_date });
  }

  const expiringDeworming = db.prepare(
    'SELECT * FROM deworming_records WHERE pet_id = ? AND next_deworming_date BETWEEN ? AND ?'
  ).all(petId, today, sevenDaysLater);
  for (const d of expiringDeworming) {
    alerts.push({ type: 'deworming', category: '驱虫', message: `驱虫即将到期，下次驱虫日期：${d.next_deworming_date}，药品：${d.medicine_name || '未指定'}`, level: 'warning', date: d.next_deworming_date });
  }
  const expiredDeworming = db.prepare(
    'SELECT * FROM deworming_records WHERE pet_id = ? AND next_deworming_date < ?'
  ).all(petId, today);
  for (const d of expiredDeworming) {
    alerts.push({ type: 'deworming', category: '驱虫', message: `驱虫已过期！上次驱虫：${d.deworming_date}，请尽快驱虫`, level: 'danger', date: d.next_deworming_date });
  }

  const age = calcAge(pet.birth_date);
  const stage = getLifeStage(pet.species, age.years);
  alerts.push({ type: 'advice', category: '护理建议', message: getLifeStageAdvice(pet.species, stage), level: 'info', stage });

  res.json(alerts);
});

app.get('/api/alerts/all', (req, res) => {
  const pets = db.prepare('SELECT * FROM pets').all();
  const allAlerts = [];
  for (const pet of pets) {
    const weights = db.prepare('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY recorded_date DESC LIMIT 2').all(pet.id);
    if (weights.length >= 2) {
      const [latest, prev] = weights;
      const changeRate = ((latest.weight - prev.weight) / prev.weight) * 100;
      const daysDiff = (new Date(latest.recorded_date) - new Date(prev.recorded_date)) / (1000 * 60 * 60 * 24);
      const monthlyRate = daysDiff > 0 ? (changeRate / daysDiff) * 30 : 0;
      if (monthlyRate > 10) {
        allAlerts.push({ petId: pet.id, petName: pet.name, type: 'warning', category: '体重', message: `体重月增幅${monthlyRate.toFixed(1)}%，超过10%预警线`, level: 'warning' });
      } else if (monthlyRate < -5) {
        allAlerts.push({ petId: pet.id, petName: pet.name, type: 'warning', category: '体重', message: `体重月减幅${Math.abs(monthlyRate).toFixed(1)}%，超过5%预警线`, level: 'warning' });
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expV = db.prepare('SELECT * FROM vaccinations WHERE pet_id = ? AND next_vaccination_date BETWEEN ? AND ?').all(pet.id, today, sevenDaysLater);
    for (const v of expV) {
      allAlerts.push({ petId: pet.id, petName: pet.name, type: 'vaccine', category: '疫苗', message: `${v.vaccine_name}即将到期（${v.next_vaccination_date}）`, level: 'warning' });
    }
    const expD = db.prepare('SELECT * FROM deworming_records WHERE pet_id = ? AND next_deworming_date BETWEEN ? AND ?').all(pet.id, today, sevenDaysLater);
    for (const d of expD) {
      allAlerts.push({ petId: pet.id, petName: pet.name, type: 'deworming', category: '驱虫', message: `驱虫即将到期（${d.next_deworming_date}）`, level: 'warning' });
    }

    const age = calcAge(pet.birth_date);
    const stage = getLifeStage(pet.species, age.years);
    allAlerts.push({ petId: pet.id, petName: pet.name, type: 'advice', category: '护理建议', message: getLifeStageAdvice(pet.species, stage), level: 'info', stage });
  }
  res.json(allAlerts);
});

// ===== DIET =====
app.get('/api/pets/:id/feedings', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const records = db.prepare('SELECT * FROM feeding_records WHERE pet_id = ? AND feeding_time LIKE ? ORDER BY feeding_time').all(req.params.id, `${date}%`);
  res.json(records);
});

app.post('/api/pets/:id/feedings', (req, res) => {
  const { feeding_time, food, portion } = req.body;
  if (!feeding_time || !food) return res.status(400).json({ error: '喂食时间和食物为必填项' });
  db.prepare('INSERT INTO feeding_records (pet_id, feeding_time, food, portion) VALUES (?, ?, ?, ?)').run(req.params.id, feeding_time, food, portion);
  res.json({ message: '喂食记录添加成功' });
});

app.delete('/api/feedings/:id', (req, res) => {
  db.prepare('DELETE FROM feeding_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

app.get('/api/pets/:id/water', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const records = db.prepare('SELECT * FROM water_records WHERE pet_id = ? AND record_date = ?').all(req.params.id, date);
  res.json(records);
});

app.post('/api/pets/:id/water', (req, res) => {
  const { record_date, amount_ml } = req.body;
  if (!record_date || !amount_ml) return res.status(400).json({ error: '日期和饮水量为必填项' });
  const existing = db.prepare('SELECT * FROM water_records WHERE pet_id = ? AND record_date = ?').get(req.params.id, record_date);
  if (existing) {
    db.prepare('UPDATE water_records SET amount_ml = amount_ml + ? WHERE id = ?').run(amount_ml, existing.id);
  } else {
    db.prepare('INSERT INTO water_records (pet_id, record_date, amount_ml) VALUES (?, ?, ?)').run(req.params.id, record_date, amount_ml);
  }
  res.json({ message: '饮水记录添加成功' });
});

app.get('/api/pets/:id/diet-recommendation', (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });
  const dailyCalories = pet.weight * 30 + 70;
  const age = calcAge(pet.birth_date);
  let waterRecommendation;
  if (pet.species === '猫') {
    waterRecommendation = pet.weight * 50;
  } else {
    waterRecommendation = pet.weight * 50;
  }
  const today = new Date().toISOString().split('T')[0];
  const todayWater = db.prepare('SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_records WHERE pet_id = ? AND record_date = ?').get(req.params.id, today);

  res.json({
    dailyCalories: Math.round(dailyCalories),
    waterRecommendation: Math.round(waterRecommendation),
    todayWater: todayWater.total,
    age
  });
});

// ===== EXPENSES =====
app.get('/api/pets/:id/expenses', (req, res) => {
  const records = db.prepare('SELECT * FROM expenses WHERE pet_id = ? ORDER BY expense_date DESC').all(req.params.id);
  res.json(records);
});

app.post('/api/pets/:id/expenses', (req, res) => {
  const { category, amount, description, expense_date } = req.body;
  if (!category || !amount || !expense_date) return res.status(400).json({ error: '类别、金额和日期为必填项' });
  db.prepare('INSERT INTO expenses (pet_id, category, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)').run(req.params.id, category, amount, description, expense_date);
  res.json({ message: '花费记录添加成功' });
});

app.delete('/api/expenses/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

app.get('/api/pets/:id/expenses/summary', (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const summary = db.prepare(`
    SELECT category, SUM(amount) as total FROM expenses
    WHERE pet_id = ? AND expense_date >= ?
    GROUP BY category
  `).all(req.params.id, monthStart);
  const total = summary.reduce((s, r) => s + r.total, 0);
  res.json({ categories: summary, total, month: monthStart });
});

// ===== SHARE =====
app.post('/api/pets/:id/share', (req, res) => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO share_links (pet_id, token, expires_at) VALUES (?, ?, ?)').run(req.params.id, token, expiresAt);
  res.json({ token, expires_at: expiresAt, url: `/share/${token}` });
});

app.get('/api/share/:token', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(req.params.token);
  if (!link) return res.status(404).json({ error: '分享链接不存在' });
  if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: '分享链接已过期' });

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(link.pet_id);
  const weights = db.prepare('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY recorded_date').all(link.pet_id);
  const vaccinations = db.prepare('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY vaccination_date DESC').all(link.pet_id);
  const deworming = db.prepare('SELECT * FROM deworming_records WHERE pet_id = ? ORDER BY deworming_date DESC').all(link.pet_id);
  const checkups = db.prepare('SELECT * FROM checkup_records WHERE pet_id = ? ORDER BY checkup_date DESC').all(link.pet_id);

  res.json({
    pet: { ...pet, age: calcAge(pet.birth_date), lifeStage: getLifeStage(pet.species, calcAge(pet.birth_date).years) },
    weights,
    vaccinations,
    deworming,
    checkups
  });
});

// ===== EXPORT PDF (HTML) =====
app.get('/api/pets/:id/export', (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });

  const age = calcAge(pet.birth_date);
  const weights = db.prepare('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY recorded_date').all(req.params.id);
  const vaccinations = db.prepare('SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY vaccination_date DESC').all(req.params.id);
  const deworming = db.prepare('SELECT * FROM deworming_records WHERE pet_id = ? ORDER BY deworming_date DESC').all(req.params.id);
  const checkups = db.prepare('SELECT * FROM checkup_records WHERE pet_id = ? ORDER BY checkup_date DESC').all(req.params.id);
  const medications = db.prepare('SELECT * FROM medication_plans WHERE pet_id = ? ORDER BY start_date DESC').all(req.params.id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE pet_id = ? ORDER BY expense_date DESC').all(req.params.id);

  const speciesMap = { '狗': '犬', '猫': '猫', '兔': '兔', '鸟': '鸟', '其他': '其他' };
  const genderMap = { 'male': '公', 'female': '母' };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${pet.name} - 健康档案</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #333; line-height: 1.6; padding: 20px; }
  h1 { text-align: center; color: #2c5282; border-bottom: 3px solid #2c5282; padding-bottom: 10px; margin-bottom: 20px; }
  h2 { color: #2c5282; border-left: 4px solid #2c5282; padding-left: 10px; margin: 20px 0 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 10px 0; }
  .info-item { padding: 6px 10px; background: #f7fafc; border-radius: 4px; }
  .info-label { font-weight: bold; color: #4a5568; margin-right: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
  th { background: #2c5282; color: white; padding: 8px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f7fafc; }
  .footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; }
</style>
</head>
<body>
<h1>🐾 ${pet.name} 的健康档案</h1>

<h2>基本信息</h2>
<div class="info-grid">
  <div class="info-item"><span class="info-label">名字:</span>${pet.name}</div>
  <div class="info-item"><span class="info-label">种类:</span>${speciesMap[pet.species] || pet.species}</div>
  <div class="info-item"><span class="info-label">品种:</span>${pet.breed || '未填写'}</div>
  <div class="info-item"><span class="info-label">出生日期:</span>${pet.birth_date}</div>
  <div class="info-item"><span class="info-label">年龄:</span>${age.text}</div>
  <div class="info-item"><span class="info-label">性别:</span>${genderMap[pet.gender] || pet.gender}</div>
  <div class="info-item"><span class="info-label">体重:</span>${pet.weight}kg</div>
  <div class="info-item"><span class="info-label">绝育状态:</span>${pet.neutered ? '已绝育' : '未绝育'}</div>
</div>

<h2>体重变化记录</h2>
<table>
  <tr><th>日期</th><th>体重(kg)</th></tr>
  ${weights.map(w => `<tr><td>${w.recorded_date}</td><td>${w.weight}</td></tr>`).join('')}
</table>

<h2>疫苗接种记录</h2>
<table>
  <tr><th>疫苗名称</th><th>接种日期</th><th>下次接种</th><th>接种机构</th></tr>
  ${vaccinations.map(v => `<tr><td>${v.vaccine_name}</td><td>${v.vaccination_date}</td><td>${v.next_vaccination_date || '—'}</td><td>${v.institution || '—'}</td></tr>`).join('')}
</table>

<h2>驱虫记录</h2>
<table>
  <tr><th>驱虫日期</th><th>下次驱虫</th><th>药品</th><th>备注</th></tr>
  ${deworming.map(d => `<tr><td>${d.deworming_date}</td><td>${d.next_deworming_date || '—'}</td><td>${d.medicine_name || '—'}</td><td>${d.notes || '—'}</td></tr>`).join('')}
</table>

<h2>体检记录</h2>
<table>
  <tr><th>日期</th><th>检查项目</th><th>结果</th><th>医生建议</th></tr>
  ${checkups.map(c => `<tr><td>${c.checkup_date}</td><td>${c.items || '—'}</td><td>${c.result || '—'}</td><td>${c.doctor_advice || '—'}</td></tr>`).join('')}
</table>

<h2>用药记录</h2>
<table>
  <tr><th>药品名称</th><th>剂量</th><th>频率</th><th>持续天数</th><th>开始日期</th><th>状态</th></tr>
  ${medications.map(m => `<tr><td>${m.medicine_name}</td><td>${m.dosage}</td><td>每日${m.frequency_per_day}次</td><td>${m.duration_days}天</td><td>${m.start_date}</td><td>${m.status === 'active' ? '进行中' : '已完成'}</td></tr>`).join('')}
</table>

<h2>花费记录</h2>
<table>
  <tr><th>日期</th><th>类别</th><th>金额(元)</th><th>描述</th></tr>
  ${expenses.map(e => `<tr><td>${e.expense_date}</td><td>${e.category === 'medical' ? '医疗' : e.category === 'medication' ? '用药' : '食物'}</td><td>${e.amount}</td><td>${e.description || '—'}</td></tr>`).join('')}
</table>

<div class="footer">生成时间：${new Date().toLocaleString('zh-CN')} | 宠物健康管理系统</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`宠物健康管理系统后端运行在 http://localhost:${PORT}`);
});
