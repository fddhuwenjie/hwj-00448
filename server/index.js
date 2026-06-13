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

const SYMPTOM_PRESETS = ['呕吐', '拉稀', '食欲不振', '精神萎靡', '咳嗽', '皮肤异常', '发热', '流鼻涕', '打喷嚏', '瘙痒', '便秘', '抽搐'];

const EXERCISE_TYPES = [
  { id: 'walk', name: '散步', icon: '🚶' },
  { id: 'run', name: '跑步', icon: '🏃' },
  { id: 'swim', name: '游泳', icon: '🏊' },
  { id: 'play', name: '室内玩耍', icon: '🎾' }
];

function getRecommendedVaccines(species) {
  if (species === '狗') {
    return ['犬瘟热疫苗', '狂犬病疫苗', '犬副流感疫苗', '细小病毒疫苗', '传染性肝炎疫苗'];
  } else if (species === '猫') {
    return ['猫瘟疫苗', '狂犬病疫苗', '猫鼻支疫苗', '猫杯状病毒疫苗', '猫白血病疫苗'];
  }
  return ['狂犬病疫苗'];
}

app.get('/api/pets/compare', (req, res) => {
  const petIds = (req.query.ids || '').split(',').map(id => parseInt(id)).filter(id => id > 0);
  if (petIds.length < 2 || petIds.length > 3) {
    return res.status(400).json({ error: '请选择2-3只宠物进行对比' });
  }

  const result = [];
  for (const id of petIds) {
    const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(id);
    if (!pet) continue;

    const weights = db.prepare('SELECT recorded_date, weight FROM weight_records WHERE pet_id = ? ORDER BY recorded_date').all(id);
    
    const vaccinations = db.prepare('SELECT vaccine_name, next_vaccination_date FROM vaccinations WHERE pet_id = ?').all(id);
    const recommended = getRecommendedVaccines(pet.species);
    const vaccinatedNames = new Set(vaccinations.map(v => v.vaccine_name));
    const upToDate = vaccinations.filter(v => !v.next_vaccination_date || new Date(v.next_vaccination_date) >= new Date()).length;
    const vaccineCoverage = Math.round((upToDate / recommended.length) * 100);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE pet_id = ? AND expense_date >= ?').get(id, monthStart);

    const father = pet.father_id ? db.prepare('SELECT id, name FROM pets WHERE id = ?').get(pet.father_id) : null;
    const mother = pet.mother_id ? db.prepare('SELECT id, name FROM pets WHERE id = ?').get(pet.mother_id) : null;

    result.push({
      pet: {
        ...pet,
        age: calcAge(pet.birth_date),
        lifeStage: getLifeStage(pet.species, calcAge(pet.birth_date).years),
        father,
        mother
      },
      weights,
      vaccineCoverage,
      recommendedVaccines: recommended,
      vaccinatedCount: upToDate,
      monthlyExpense: expenses.total
    });
  }

  res.json(result);
});

app.get('/api/symptoms/presets', (req, res) => {
  res.json(SYMPTOM_PRESETS);
});

app.get('/api/exercise/types', (req, res) => {
  res.json(EXERCISE_TYPES);
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

// ===== FAMILY TREE =====
app.get('/api/pets/:id/family', (req, res) => {
  const petId = parseInt(req.params.id);
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });

  function getFamilyTree(id, visited = new Set()) {
    if (visited.has(id)) return null;
    visited.add(id);
    
    const p = db.prepare('SELECT * FROM pets WHERE id = ?').get(id);
    if (!p) return null;

    const father = p.father_id ? getFamilyTree(p.father_id, new Set(visited)) : null;
    const mother = p.mother_id ? getFamilyTree(p.mother_id, new Set(visited)) : null;

    const children = db.prepare(`
      SELECT * FROM pets WHERE father_id = ? OR mother_id = ?
    `).all(id, id);

    return {
      ...p,
      age: calcAge(p.birth_date),
      father,
      mother,
      children: children.map(c => ({
        ...c,
        age: calcAge(c.birth_date)
      }))
    };
  }

  const tree = getFamilyTree(petId);
  res.json(tree);
});

app.put('/api/pets/:id/parents', (req, res) => {
  const petId = parseInt(req.params.id);
  const { father_id, mother_id } = req.body;

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });

  if (father_id === petId || mother_id === petId) {
    return res.status(400).json({ error: '不能将自己设为父母' });
  }

  if (father_id) {
    const father = db.prepare('SELECT * FROM pets WHERE id = ?').get(father_id);
    if (!father || father.gender !== 'male') {
      return res.status(400).json({ error: '父亲必须是公宠物' });
    }
  }
  if (mother_id) {
    const mother = db.prepare('SELECT * FROM pets WHERE id = ?').get(mother_id);
    if (!mother || mother.gender !== 'female') {
      return res.status(400).json({ error: '母亲必须是母宠物' });
    }
  }

  let breed = pet.breed;
  if (father_id && mother_id) {
    const father = db.prepare('SELECT breed FROM pets WHERE id = ?').get(father_id);
    const mother = db.prepare('SELECT breed FROM pets WHERE id = ?').get(mother_id);
    if (father.breed && mother.breed && father.breed === mother.breed) {
      breed = father.breed;
    }
  } else if (father_id) {
    const father = db.prepare('SELECT breed FROM pets WHERE id = ?').get(father_id);
    if (father.breed) breed = father.breed;
  } else if (mother_id) {
    const mother = db.prepare('SELECT breed FROM pets WHERE id = ?').get(mother_id);
    if (mother.breed) breed = mother.breed;
  }

  db.prepare('UPDATE pets SET father_id = ?, mother_id = ?, breed = ? WHERE id = ?').run(
    father_id || null, mother_id || null, breed, petId
  );

  res.json({ message: '父母关系更新成功', breed });
});

// ===== SYMPTOMS =====

function analyzeSymptoms(petId) {
  const records = db.prepare(`
    SELECT * FROM symptom_records 
    WHERE pet_id = ? 
    ORDER BY recorded_date DESC 
    LIMIT 10
  `).all(petId);

  const suggestions = [];
  const symptomHistory = records.map(r => ({
    date: r.recorded_date,
    symptoms: r.symptoms.split(','),
    severity: r.severity
  }));

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentRecords = records.filter(r => new Date(r.recorded_date) >= threeDaysAgo);
  const hasLossOfAppetite = recentRecords.filter(r => r.symptoms.includes('食欲不振')).length;
  
  if (hasLossOfAppetite >= 3) {
    suggestions.push({
      type: 'danger',
      title: '连续食欲不振预警',
      description: '连续3天以上食欲不振，建议立即就医检查！'
    });
  }

  const hasVomitingAndDiarrhea = records.some(r => 
    r.symptoms.includes('呕吐') && r.symptoms.includes('拉稀')
  );
  if (hasVomitingAndDiarrhea) {
    suggestions.push({
      type: 'warning',
      title: '疑似肠胃炎',
      description: '同时出现呕吐和拉稀症状，疑似肠胃炎。建议禁食观察12-24小时，给予充足饮水，如症状持续请及时就医。'
    });
  }

  const highSeverity = records.filter(r => r.severity >= 4);
  if (highSeverity.length >= 2) {
    suggestions.push({
      type: 'warning',
      title: '严重症状提醒',
      description: '近期出现多次严重症状（4星及以上），建议密切观察，必要时就医。'
    });
  }

  const hasFever = records.some(r => r.symptoms.includes('发热'));
  if (hasFever) {
    suggestions.push({
      type: 'warning',
      title: '发热症状',
      description: '出现发热症状，建议测量体温，正常体温：犬38-39°C，猫38.5-39.5°C。如持续发热请就医。'
    });
  }

  const hasCough = records.some(r => r.symptoms.includes('咳嗽'));
  if (hasCough && !hasVomitingAndDiarrhea) {
    suggestions.push({
      type: 'info',
      title: '呼吸道症状',
      description: '出现咳嗽症状，可能是呼吸道感染或过敏。保持环境清洁通风，避免剧烈运动，如持续请就医。'
    });
  }

  const hasSkinIssue = records.some(r => r.symptoms.includes('皮肤异常') || r.symptoms.includes('瘙痒'));
  if (hasSkinIssue) {
    suggestions.push({
      type: 'info',
      title: '皮肤问题',
      description: '出现皮肤异常或瘙痒，可能是过敏、寄生虫或皮肤病。检查是否有跳蚤，保持皮肤清洁，如持续请就医做皮肤检查。'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'info',
      title: '状态良好',
      description: '未检测到需要特别关注的症状组合。继续保持观察，记录任何异常变化。'
    });
  }

  return suggestions;
}

app.get('/api/pets/:id/symptoms', (req, res) => {
  const petId = req.params.id;
  const records = db.prepare('SELECT * FROM symptom_records WHERE pet_id = ? ORDER BY recorded_date DESC').all(petId);
  const suggestions = analyzeSymptoms(petId);
  res.json({ records, suggestions });
});

app.post('/api/pets/:id/symptoms', (req, res) => {
  const { symptoms, custom_description, severity, photo_url, recorded_date } = req.body;
  if (!symptoms || !severity || !recorded_date) {
    return res.status(400).json({ error: '症状、严重程度和日期为必填项' });
  }
  if (severity < 1 || severity > 5) {
    return res.status(400).json({ error: '严重程度必须在1-5之间' });
  }
  const symptomStr = Array.isArray(symptoms) ? symptoms.join(',') : symptoms;
  db.prepare(`
    INSERT INTO symptom_records (pet_id, symptoms, custom_description, severity, photo_url, recorded_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, symptomStr, custom_description, severity, photo_url, recorded_date);

  const suggestions = analyzeSymptoms(req.params.id);
  res.json({ message: '症状记录添加成功', suggestions });
});

app.delete('/api/symptoms/:id', (req, res) => {
  db.prepare('DELETE FROM symptom_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== EXERCISE =====

function getExerciseRecommendation(species, breed, ageYears) {
  const breedLower = (breed || '').toLowerCase();
  let minMinutes = 30;
  let maxMinutes = 60;

  if (species === '狗') {
    if (breedLower.includes('金毛') || breedLower.includes('拉布拉多') || breedLower.includes('golden') || breedLower.includes('labrador')) {
      minMinutes = 60;
      maxMinutes = 90;
    } else if (breedLower.includes('边牧') || breedLower.includes('柯基') || breedLower.includes('corgi') || breedLower.includes('collie')) {
      minMinutes = 45;
      maxMinutes = 75;
    } else if (breedLower.includes('吉娃娃') || breedLower.includes('chihuahua')) {
      minMinutes = 20;
      maxMinutes = 40;
    }
  } else if (species === '猫') {
    minMinutes = 15;
    maxMinutes = 30;
  }

  if (ageYears < 1) {
    minMinutes = Math.round(minMinutes * 0.5);
    maxMinutes = Math.round(maxMinutes * 0.6);
  } else if (ageYears > 8) {
    minMinutes = Math.round(minMinutes * 0.6);
    maxMinutes = Math.round(maxMinutes * 0.7);
  }

  return { minMinutes, maxMinutes };
}

app.get('/api/pets/:id/exercise/recommendation', (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });
  const age = calcAge(pet.birth_date);
  const recommendation = getExerciseRecommendation(pet.species, pet.breed, age.years);
  res.json({ ...recommendation, age: age.years, species: pet.species, breed: pet.breed });
});

app.get('/api/pets/:id/exercise', (req, res) => {
  const petId = req.params.id;
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return res.status(404).json({ error: '宠物不存在' });

  const records = db.prepare('SELECT * FROM exercise_records WHERE pet_id = ? ORDER BY recorded_date DESC').all(petId);
  
  const age = calcAge(pet.birth_date);
  const recommendation = getExerciseRecommendation(pet.species, pet.breed, age.years);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const weekRecords = records.filter(r => new Date(r.recorded_date) >= sevenDaysAgo);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.recorded_date === today);
  const todayTotal = todayRecords.reduce((s, r) => s + r.duration_minutes, 0);

  let status = 'normal';
  if (todayTotal < recommendation.minMinutes) status = 'insufficient';
  else if (todayTotal > recommendation.maxMinutes * 1.5) status = 'excessive';

  res.json({
    records,
    recommendation,
    weekRecords,
    todayTotal,
    status,
    statusText: {
      insufficient: '不足',
      normal: '达标',
      excessive: '超标'
    }[status]
  });
});

app.post('/api/pets/:id/exercise', (req, res) => {
  const { exercise_type, duration_minutes, distance_km, recorded_date } = req.body;
  if (!exercise_type || !duration_minutes || !recorded_date) {
    return res.status(400).json({ error: '运动类型、时长和日期为必填项' });
  }
  db.prepare(`
    INSERT INTO exercise_records (pet_id, exercise_type, duration_minutes, distance_km, recorded_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, exercise_type, duration_minutes, distance_km || null, recorded_date);
  res.json({ message: '运动记录添加成功' });
});

app.delete('/api/exercise/:id', (req, res) => {
  db.prepare('DELETE FROM exercise_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== SLEEP =====
app.get('/api/pets/:id/sleep', (req, res) => {
  const petId = req.params.id;
  const records = db.prepare('SELECT * FROM sleep_records WHERE pet_id = ? ORDER BY recorded_date DESC').all(petId);
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const weekRecords = records.filter(r => new Date(r.recorded_date) >= sevenDaysAgo);

  const avgQuality = weekRecords.length > 0
    ? (weekRecords.reduce((s, r) => s + r.quality, 0) / weekRecords.length).toFixed(1)
    : 0;

  const avgHours = weekRecords.length > 0
    ? (weekRecords.reduce((s, r) => {
        const sleep = new Date(r.sleep_time);
        const wake = new Date(r.wake_time);
        if (wake < sleep) wake.setDate(wake.getDate() + 1);
        return s + (wake - sleep) / (1000 * 60 * 60);
      }, 0) / weekRecords.length).toFixed(1)
    : 0;

  res.json({ records, weekRecords, avgQuality, avgHours });
});

app.post('/api/pets/:id/sleep', (req, res) => {
  const { sleep_time, wake_time, quality, recorded_date } = req.body;
  if (!sleep_time || !wake_time || !quality || !recorded_date) {
    return res.status(400).json({ error: '入睡时间、起床时间、睡眠质量和日期为必填项' });
  }
  if (quality < 1 || quality > 5) {
    return res.status(400).json({ error: '睡眠质量必须在1-5之间' });
  }
  db.prepare(`
    INSERT INTO sleep_records (pet_id, sleep_time, wake_time, quality, recorded_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, sleep_time, wake_time, quality, recorded_date);
  res.json({ message: '睡眠记录添加成功' });
});

app.delete('/api/sleep/:id', (req, res) => {
  db.prepare('DELETE FROM sleep_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

app.listen(PORT, () => {
  console.log(`宠物健康管理系统后端运行在 http://localhost:${PORT}`);
});
