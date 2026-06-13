const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'pet_health.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    birth_date TEXT NOT NULL,
    weight REAL,
    gender TEXT,
    neutered INTEGER DEFAULT 0,
    photo_url TEXT,
    owner_id INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS weight_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    weight REAL NOT NULL,
    recorded_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vaccinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    vaccine_name TEXT NOT NULL,
    vaccination_date TEXT NOT NULL,
    next_vaccination_date TEXT,
    institution TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS deworming_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    deworming_date TEXT NOT NULL,
    next_deworming_date TEXT,
    medicine_name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS checkup_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    checkup_date TEXT NOT NULL,
    items TEXT,
    result TEXT,
    doctor_advice TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS medication_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency_per_day INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS medication_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    pet_id INTEGER NOT NULL,
    reminder_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (plan_id) REFERENCES medication_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feeding_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    feeding_time TEXT NOT NULL,
    food TEXT NOT NULL,
    portion TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS water_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    record_date TEXT NOT NULL,
    amount_ml REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    expense_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );
`);

function seedData() {
  const petCount = db.prepare('SELECT COUNT(*) as count FROM pets').get();
  if (petCount.count > 0) return;

  const insertPet = db.prepare(`
    INSERT INTO pets (name, species, breed, birth_date, weight, gender, neutered, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWeight = db.prepare(`
    INSERT INTO weight_records (pet_id, weight, recorded_date) VALUES (?, ?, ?)
  `);

  const insertVaccination = db.prepare(`
    INSERT INTO vaccinations (pet_id, vaccine_name, vaccination_date, next_vaccination_date, institution)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertDeworming = db.prepare(`
    INSERT INTO deworming_records (pet_id, deworming_date, next_deworming_date, medicine_name, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertCheckup = db.prepare(`
    INSERT INTO checkup_records (pet_id, checkup_date, items, result, doctor_advice)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMedPlan = db.prepare(`
    INSERT INTO medication_plans (pet_id, medicine_name, dosage, frequency_per_day, duration_days, start_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMedReminder = db.prepare(`
    INSERT INTO medication_reminders (plan_id, pet_id, reminder_time, status) VALUES (?, ?, ?, ?)
  `);

  const insertFeeding = db.prepare(`
    INSERT INTO feeding_records (pet_id, feeding_time, food, portion) VALUES (?, ?, ?, ?)
  `);

  const insertWater = db.prepare(`
    INSERT INTO water_records (pet_id, record_date, amount_ml) VALUES (?, ?, ?)
  `);

  const insertExpense = db.prepare(`
    INSERT INTO expenses (pet_id, category, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const goldenId = insertPet.run(
      '大毛', '狗', '金毛寻回犬', '2022-03-15', 28.5, 'male', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=golden%20retriever%20dog%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const catId = insertPet.run(
      '小橘', '猫', '英国短毛猫', '2023-07-20', 4.2, 'female', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=british%20shorthair%20cat%20orange%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const weightDataGolden = [
      [goldenId, 26.0, '2026-01-15'],
      [goldenId, 26.8, '2026-02-15'],
      [goldenId, 27.3, '2026-03-15'],
      [goldenId, 27.9, '2026-04-15'],
      [goldenId, 28.2, '2026-05-15'],
      [goldenId, 28.5, '2026-06-13'],
    ];
    const weightDataCat = [
      [catId, 3.8, '2026-01-15'],
      [catId, 3.9, '2026-02-15'],
      [catId, 4.0, '2026-03-15'],
      [catId, 4.1, '2026-04-15'],
      [catId, 4.1, '2026-05-15'],
      [catId, 4.2, '2026-06-13'],
    ];
    for (const w of weightDataGolden) insertWeight.run(...w);
    for (const w of weightDataCat) insertWeight.run(...w);

    const vaccGolden = [
      [goldenId, '犬瘟热疫苗', '2026-01-10', '2027-01-10', '宠爱动物医院'],
      [goldenId, '狂犬病疫苗', '2026-02-20', '2027-02-20', '宠爱动物医院'],
      [goldenId, '犬副流感疫苗', '2026-03-15', '2026-06-20', '阳光宠物诊所'],
    ];
    const vaccCat = [
      [catId, '猫瘟疫苗', '2026-01-05', '2027-01-05', '喵星动物医院'],
      [catId, '狂犬病疫苗', '2026-02-10', '2027-02-10', '喵星动物医院'],
      [catId, '猫鼻支疫苗', '2026-04-01', '2026-06-18', '阳光宠物诊所'],
    ];
    for (const v of vaccGolden) insertVaccination.run(...v);
    for (const v of vaccCat) insertVaccination.run(...v);

    const dewGolden = [
      [goldenId, '2026-04-01', '2026-07-01', '拜宠清', '体内驱虫'],
      [goldenId, '2026-05-15', '2026-06-18', '福来恩', '体外驱虫'],
    ];
    const dewCat = [
      [catId, '2026-03-20', '2026-06-20', '大宠爱', '内外同驱'],
      [catId, '2026-05-01', '2026-08-01', '拜宠清', '体内驱虫'],
    ];
    for (const d of dewGolden) insertDeworming.run(...d);
    for (const d of dewCat) insertDeworming.run(...d);

    const checkGolden = [
      [goldenId, '2026-05-10', '血常规,生化检查', '各项指标正常', '保持当前饮食和运动量，定期复查'],
      [goldenId, '2026-03-01', '骨科检查', '髋关节发育良好', '适当补充关节营养品'],
    ];
    const checkCat = [
      [catId, '2026-04-15', '血常规,尿常规', '轻微尿路炎症', '增加饮水量，7天后复查'],
    ];
    for (const c of checkGolden) insertCheckup.run(...c);
    for (const c of checkCat) insertCheckup.run(...c);

    const plan1 = insertMedPlan.run(goldenId, '关节宝', '1粒', 2, 30, '2026-06-01', 'active').lastInsertRowid;
    const plan2 = insertMedPlan.run(goldenId, '益生菌', '半包', 1, 14, '2026-06-10', 'active').lastInsertRowid;
    const plan3 = insertMedPlan.run(catId, '泌尿通', '1粒', 2, 21, '2026-06-05', 'active').lastInsertRowid;
    const plan4 = insertMedPlan.run(catId, '营养膏', '2cm', 1, 30, '2026-06-01', 'active').lastInsertRowid;

    const fmt = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const today = '2026-06-13';
    for (let d = 0; d < 30; d++) {
      const day = 1 + d;
      if (day > 13) break;
      const dateStr = fmt(2026, 5, day);
      const status1 = dateStr < today ? 'completed' : 'pending';
      const status2 = dateStr < today ? 'completed' : 'pending';
      insertMedReminder.run(plan1, goldenId, `${dateStr} 08:00`, status1);
      insertMedReminder.run(plan1, goldenId, `${dateStr} 20:00`, status1);
      insertMedReminder.run(plan2, goldenId, `${dateStr} 09:00`, status2);
    }
    for (let d = 0; d < 21; d++) {
      const day = 5 + d;
      if (day > 13) break;
      const dateStr = fmt(2026, 5, day);
      const status = dateStr < today ? 'completed' : 'pending';
      insertMedReminder.run(plan3, catId, `${dateStr} 08:00`, status);
      insertMedReminder.run(plan3, catId, `${dateStr} 20:00`, status);
    }
    for (let d = 0; d < 30; d++) {
      const day = 1 + d;
      if (day > 13) break;
      const dateStr = fmt(2026, 5, day);
      const status = dateStr < today ? 'completed' : 'pending';
      insertMedReminder.run(plan4, catId, `${dateStr} 10:00`, status);
    }

    const feedingGolden = [
      [goldenId, '2026-06-13 07:30', '皇家金毛专用粮', '350g'],
      [goldenId, '2026-06-13 12:00', '鸡胸肉+蔬菜', '150g'],
      [goldenId, '2026-06-13 18:00', '皇家金毛专用粮', '300g'],
    ];
    const feedingCat = [
      [catId, '2026-06-13 07:00', '渴望猫粮', '40g'],
      [catId, '2026-06-13 18:30', '渴望猫粮', '40g'],
    ];
    for (const f of feedingGolden) insertFeeding.run(...f);
    for (const f of feedingCat) insertFeeding.run(...f);

    insertWater.run(goldenId, '2026-06-13', 850);
    insertWater.run(catId, '2026-06-13', 220);

    const expGolden = [
      [goldenId, 'medical', 380, '体检费用', '2026-05-10'],
      [goldenId, 'medical', 260, '骨科检查', '2026-03-01'],
      [goldenId, 'medication', 198, '关节宝', '2026-06-01'],
      [goldenId, 'medication', 68, '益生菌', '2026-06-10'],
      [goldenId, 'food', 320, '皇家金毛专用粮15kg', '2026-06-01'],
      [goldenId, 'food', 85, '鸡胸肉', '2026-06-05'],
    ];
    const expCat = [
      [catId, 'medical', 290, '血常规+尿常规检查', '2026-04-15'],
      [catId, 'medication', 156, '泌尿通', '2026-06-05'],
      [catId, 'medication', 88, '营养膏', '2026-06-01'],
      [catId, 'food', 268, '渴望猫粮1.8kg', '2026-06-01'],
    ];
    for (const e of expGolden) insertExpense.run(...e);
    for (const e of expCat) insertExpense.run(...e);
  });

  transaction();
}

seedData();

module.exports = db;
