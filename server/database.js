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
    father_id INTEGER,
    mother_id INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (father_id) REFERENCES pets(id) ON DELETE SET NULL,
    FOREIGN KEY (mother_id) REFERENCES pets(id) ON DELETE SET NULL
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

  CREATE TABLE IF NOT EXISTS symptom_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    symptoms TEXT NOT NULL,
    custom_description TEXT,
    severity INTEGER NOT NULL,
    photo_url TEXT,
    recorded_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercise_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    exercise_type TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    distance_km REAL,
    recorded_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sleep_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    sleep_time TEXT NOT NULL,
    wake_time TEXT NOT NULL,
    quality INTEGER NOT NULL,
    recorded_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );
`);

const cols = db.pragma('table_info(pets)').map(c => c.name);
if (!cols.includes('father_id')) db.exec('ALTER TABLE pets ADD COLUMN father_id INTEGER REFERENCES pets(id) ON DELETE SET NULL');
if (!cols.includes('mother_id')) db.exec('ALTER TABLE pets ADD COLUMN mother_id INTEGER REFERENCES pets(id) ON DELETE SET NULL');

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

  const insertSymptom = db.prepare(`
    INSERT INTO symptom_records (pet_id, symptoms, custom_description, severity, photo_url, recorded_date) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertExercise = db.prepare(`
    INSERT INTO exercise_records (pet_id, exercise_type, duration_minutes, distance_km, recorded_date) VALUES (?, ?, ?, ?, ?)
  `);

  const insertSleep = db.prepare(`
    INSERT INTO sleep_records (pet_id, sleep_time, wake_time, quality, recorded_date) VALUES (?, ?, ?, ?, ?)
  `);

  const updatePetParents = db.prepare('UPDATE pets SET father_id = ?, mother_id = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    const goldenDadId = insertPet.run(
      '大黄', '狗', '金毛寻回犬', '2018-05-20', 32.0, 'male', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=adult%20male%20golden%20retriever%20dog%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const goldenMomId = insertPet.run(
      '莉莉', '狗', '金毛寻回犬', '2019-08-10', 26.5, 'female', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=adult%20female%20golden%20retriever%20dog%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const goldenId = insertPet.run(
      '大毛', '狗', '金毛寻回犬', '2022-03-15', 28.5, 'male', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=golden%20retriever%20dog%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const goldenSonId = insertPet.run(
      '小金', '狗', '金毛寻回犬', '2024-06-01', 18.0, 'male', 0,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=young%20golden%20retriever%20puppy%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    updatePetParents.run(goldenDadId, goldenMomId, goldenId);
    updatePetParents.run(goldenId, null, goldenSonId);

    const catId = insertPet.run(
      '小橘', '猫', '英国短毛猫', '2023-07-20', 4.2, 'female', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=british%20shorthair%20cat%20orange%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const corgiId = insertPet.run(
      '豆豆', '狗', '威尔士柯基', '2023-02-14', 12.5, 'male', 1,
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=welsh%20corgi%20dog%20portrait%20photo%20realistic&image_size=square'
    ).lastInsertRowid;

    const weightDataGoldenDad = [
      [goldenDadId, 30.5, '2026-01-15'],
      [goldenDadId, 31.0, '2026-02-15'],
      [goldenDadId, 31.5, '2026-03-15'],
      [goldenDadId, 31.8, '2026-04-15'],
      [goldenDadId, 32.0, '2026-05-15'],
      [goldenDadId, 32.0, '2026-06-13'],
    ];
    const weightDataGoldenMom = [
      [goldenMomId, 25.0, '2026-01-15'],
      [goldenMomId, 25.5, '2026-02-15'],
      [goldenMomId, 25.8, '2026-03-15'],
      [goldenMomId, 26.2, '2026-04-15'],
      [goldenMomId, 26.5, '2026-05-15'],
      [goldenMomId, 26.5, '2026-06-13'],
    ];
    const weightDataGolden = [
      [goldenId, 26.0, '2026-01-15'],
      [goldenId, 26.8, '2026-02-15'],
      [goldenId, 27.3, '2026-03-15'],
      [goldenId, 27.9, '2026-04-15'],
      [goldenId, 28.2, '2026-05-15'],
      [goldenId, 28.5, '2026-06-13'],
    ];
    const weightDataGoldenSon = [
      [goldenSonId, 12.0, '2026-01-15'],
      [goldenSonId, 14.0, '2026-02-15'],
      [goldenSonId, 15.5, '2026-03-15'],
      [goldenSonId, 16.8, '2026-04-15'],
      [goldenSonId, 17.5, '2026-05-15'],
      [goldenSonId, 18.0, '2026-06-13'],
    ];
    const weightDataCat = [
      [catId, 3.8, '2026-01-15'],
      [catId, 3.9, '2026-02-15'],
      [catId, 4.0, '2026-03-15'],
      [catId, 4.1, '2026-04-15'],
      [catId, 4.1, '2026-05-15'],
      [catId, 4.2, '2026-06-13'],
    ];
    const weightDataCorgi = [
      [corgiId, 11.0, '2026-01-15'],
      [corgiId, 11.5, '2026-02-15'],
      [corgiId, 11.8, '2026-03-15'],
      [corgiId, 12.1, '2026-04-15'],
      [corgiId, 12.3, '2026-05-15'],
      [corgiId, 12.5, '2026-06-13'],
    ];
    for (const w of weightDataGoldenDad) insertWeight.run(...w);
    for (const w of weightDataGoldenMom) insertWeight.run(...w);
    for (const w of weightDataGolden) insertWeight.run(...w);
    for (const w of weightDataGoldenSon) insertWeight.run(...w);
    for (const w of weightDataCat) insertWeight.run(...w);
    for (const w of weightDataCorgi) insertWeight.run(...w);

    const vaccGolden = [
      [goldenId, '犬瘟热疫苗', '2026-01-10', '2027-01-10', '宠爱动物医院'],
      [goldenId, '狂犬病疫苗', '2026-02-20', '2027-02-20', '宠爱动物医院'],
      [goldenId, '犬副流感疫苗', '2026-03-15', '2026-06-20', '阳光宠物诊所'],
    ];
    const vaccGoldenDad = [
      [goldenDadId, '犬瘟热疫苗', '2026-02-01', '2027-02-01', '宠爱动物医院'],
      [goldenDadId, '狂犬病疫苗', '2026-03-10', '2027-03-10', '宠爱动物医院'],
    ];
    const vaccGoldenMom = [
      [goldenMomId, '犬瘟热疫苗', '2026-01-25', '2027-01-25', '宠爱动物医院'],
      [goldenMomId, '狂犬病疫苗', '2026-04-15', '2027-04-15', '宠爱动物医院'],
    ];
    const vaccCorgi = [
      [corgiId, '犬瘟热疫苗', '2026-03-05', '2027-03-05', '阳光宠物诊所'],
      [corgiId, '狂犬病疫苗', '2026-05-20', '2027-05-20', '阳光宠物诊所'],
    ];
    const vaccCat = [
      [catId, '猫瘟疫苗', '2026-01-05', '2027-01-05', '喵星动物医院'],
      [catId, '狂犬病疫苗', '2026-02-10', '2027-02-10', '喵星动物医院'],
      [catId, '猫鼻支疫苗', '2026-04-01', '2026-06-18', '阳光宠物诊所'],
    ];
    for (const v of vaccGolden) insertVaccination.run(...v);
    for (const v of vaccGoldenDad) insertVaccination.run(...v);
    for (const v of vaccGoldenMom) insertVaccination.run(...v);
    for (const v of vaccCorgi) insertVaccination.run(...v);
    for (const v of vaccCat) insertVaccination.run(...v);

    const dewGolden = [
      [goldenId, '2026-04-01', '2026-07-01', '拜宠清', '体内驱虫'],
      [goldenId, '2026-05-15', '2026-06-18', '福来恩', '体外驱虫'],
    ];
    const dewCorgi = [
      [corgiId, '2026-03-10', '2026-06-10', '大宠爱', '内外同驱'],
    ];
    const dewCat = [
      [catId, '2026-03-20', '2026-06-20', '大宠爱', '内外同驱'],
      [catId, '2026-05-01', '2026-08-01', '拜宠清', '体内驱虫'],
    ];
    for (const d of dewGolden) insertDeworming.run(...d);
    for (const d of dewCorgi) insertDeworming.run(...d);
    for (const d of dewCat) insertDeworming.run(...d);

    const checkGolden = [
      [goldenId, '2026-05-10', '血常规,生化检查', '各项指标正常', '保持当前饮食和运动量，定期复查'],
      [goldenId, '2026-03-01', '骨科检查', '髋关节发育良好', '适当补充关节营养品'],
    ];
    const checkCat = [
      [catId, '2026-04-15', '血常规,尿常规', '轻微尿路炎症', '增加饮水量，7天后复查'],
    ];
    const checkCorgi = [
      [corgiId, '2026-05-20', '体检', '各项指标正常', '注意控制体重，避免肥胖'],
    ];
    for (const c of checkGolden) insertCheckup.run(...c);
    for (const c of checkCat) insertCheckup.run(...c);
    for (const c of checkCorgi) insertCheckup.run(...c);

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
    const feedingCorgi = [
      [corgiId, '2026-06-13 08:00', '皇家柯基专用粮', '150g'],
      [corgiId, '2026-06-13 18:00', '皇家柯基专用粮', '150g'],
    ];
    for (const f of feedingGolden) insertFeeding.run(...f);
    for (const f of feedingCat) insertFeeding.run(...f);
    for (const f of feedingCorgi) insertFeeding.run(...f);

    insertWater.run(goldenId, '2026-06-13', 850);
    insertWater.run(goldenDadId, '2026-06-13', 900);
    insertWater.run(goldenMomId, '2026-06-13', 750);
    insertWater.run(goldenSonId, '2026-06-13', 600);
    insertWater.run(catId, '2026-06-13', 220);
    insertWater.run(corgiId, '2026-06-13', 450);

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
    const expCorgi = [
      [corgiId, 'medical', 200, '体检', '2026-05-20'],
      [corgiId, 'food', 180, '皇家柯基专用粮', '2026-06-01'],
      [corgiId, 'food', 50, '零食', '2026-06-08'],
    ];
    const expGoldenDad = [
      [goldenDadId, 'food', 350, '狗粮', '2026-06-01'],
      [goldenDadId, 'medical', 150, '驱虫', '2026-05-15'],
    ];
    const expGoldenMom = [
      [goldenMomId, 'food', 320, '狗粮', '2026-06-02'],
    ];
    const expGoldenSon = [
      [goldenSonId, 'food', 280, '幼犬粮', '2026-06-01'],
      [goldenSonId, 'medication', 120, '钙片', '2026-06-05'],
    ];
    for (const e of expGolden) insertExpense.run(...e);
    for (const e of expCat) insertExpense.run(...e);
    for (const e of expCorgi) insertExpense.run(...e);
    for (const e of expGoldenDad) insertExpense.run(...e);
    for (const e of expGoldenMom) insertExpense.run(...e);
    for (const e of expGoldenSon) insertExpense.run(...e);

    const symptomGolden = [
      [goldenId, '食欲不振,精神萎靡', '最近3天胃口不好，吃得很少', 4, '', '2026-06-11'],
      [goldenId, '食欲不振', '还是不想吃东西', 3, '', '2026-06-12'],
      [goldenId, '食欲不振,拉稀', '早上拉稀一次，还是没胃口', 4, '', '2026-06-13'],
    ];
    const symptomCat = [
      [catId, '呕吐', '早上吐了一次黄水', 2, '', '2026-06-10'],
      [catId, '皮肤异常', '后背有红疹，经常抓挠', 3, '', '2026-06-12'],
    ];
    const symptomCorgi = [
      [corgiId, '咳嗽', '偶尔干咳，运动后加重', 3, '', '2026-06-08'],
      [corgiId, '精神萎靡', '今天不太想动', 2, '', '2026-06-13'],
    ];
    for (const s of symptomGolden) insertSymptom.run(...s);
    for (const s of symptomCat) insertSymptom.run(...s);
    for (const s of symptomCorgi) insertSymptom.run(...s);

    const exerciseTypes = ['walk', 'run', 'swim', 'play'];
    const exerciseNames = { walk: '散步', run: '跑步', swim: '游泳', play: '室内玩耍' };
    const petsForExercise = [goldenId, goldenDadId, goldenMomId, goldenSonId, corgiId];
    
    for (let day = 6; day >= 0; day--) {
      const date = new Date('2026-06-13');
      date.setDate(date.getDate() - day);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const petId of petsForExercise) {
        const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
        const isGoldenFamily = pet.breed === '金毛寻回犬';
        const isYoung = new Date().getFullYear() - new Date(pet.birth_date).getFullYear() < 2;
        
        let duration, distance, type;
        if (isGoldenFamily) {
          if (isYoung) {
            duration = 30 + Math.floor(Math.random() * 20);
            distance = 1.5 + Math.random() * 1.5;
          } else {
            duration = 60 + Math.floor(Math.random() * 40);
            distance = 3 + Math.random() * 3;
          }
          type = Math.random() > 0.5 ? 'walk' : 'run';
        } else {
          duration = 30 + Math.floor(Math.random() * 30);
          distance = 1 + Math.random() * 2;
          type = Math.random() > 0.5 ? 'walk' : 'play';
        }
        insertExercise.run(petId, type, duration, parseFloat(distance.toFixed(1)), dateStr);
      }
    }

    const sleepQualities = [3, 4, 5, 4, 5, 4, 3];
    const petsForSleep = [goldenId, goldenDadId, goldenMomId, goldenSonId, catId, corgiId];
    
    for (let day = 6; day >= 0; day--) {
      const date = new Date('2026-06-13');
      date.setDate(date.getDate() - day);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const petId of petsForSleep) {
        const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
        const isCat = pet.species === '猫';
        const baseSleep = isCat ? 16 : 10;
        const variation = Math.floor(Math.random() * 3) - 1;
        const sleepHours = baseSleep + variation;
        
        const sleepHour = 21 + Math.floor(Math.random() * 2);
        const wakeHour = 7 + Math.floor(Math.random() * 2);
        
        insertSleep.run(
          petId,
          `${dateStr} ${sleepHour}:00`,
          `${dateStr} ${wakeHour}:00`,
          sleepQualities[day],
          dateStr
        );
      }
    }
  });

  transaction();
}

seedData();

module.exports = db;
