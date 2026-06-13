const API_BASE = window.location.port === '3448'
  ? 'http://localhost:8448/api'
  : '/api';

let currentPetId = null;
let pets = [];
let weightChart = null;
let expenseChart = null;
let compareWeightChart = null;
let compareExpenseChart = null;
let exerciseChart = null;
let sleepChart = null;
let selectedCompareIds = [];
let symptomPresets = [];
let exerciseTypes = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function api(url, options = {}) {
  return fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '请求失败');
    return data;
  });
}

function showToast(msg, type = 'success') {
  const toast = $('#toast');
  const content = $('#toastContent');
  const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
  content.className = `toast-${type}`;
  content.className += ' px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2 transition-all';
  content.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function openModal(id) {
  $(`#${id}`).classList.remove('hidden');
  const today = new Date().toISOString().split('T')[0];
  $(`#${id} [name="recorded_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="checkup_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="deworming_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="vaccination_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="start_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="record_date"]`)?.setAttribute('value', today);
  $(`#${id} [name="expense_date"]`)?.setAttribute('value', today);
  const dt = $(`#${id} [name="feeding_time"]`);
  if (dt) dt.value = new Date().toISOString().slice(0, 16);
}

function closeModals() {
  $$('.modal-overlay').forEach((m) => m.classList.add('hidden'));
}

function initNavigation() {
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      $$('.module-section').forEach((s) => s.classList.add('hidden'));
      $(`#section-${section}`).classList.remove('hidden');
      if (section === 'health') renderWeightChart();
      if (section === 'medication') renderTodayReminders();
      if (section === 'alerts') renderAlerts();
      if (section === 'diet') renderDiet();
      if (section === 'export') renderExport();
      if (section === 'compare') renderComparePage();
      if (section === 'family') renderFamilyPage();
      if (section === 'symptoms') renderSymptoms();
      if (section === 'activity') renderActivityPage();
    });
  });
}

function initModalHandlers() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
      closeModals();
    }
  });

  $('#btnAddPet')?.addEventListener('click', () => openModal('addPetModal'));
  $('#btnAddWeight')?.addEventListener('click', () => openModal('addWeightModal'));
  $('#btnAddVaccination')?.addEventListener('click', () => openModal('addVaccinationModal'));
  $('#btnAddDeworming')?.addEventListener('click', () => openModal('addDewormingModal'));
  $('#btnAddCheckup')?.addEventListener('click', () => openModal('addCheckupModal'));
  $('#btnAddMedication')?.addEventListener('click', () => openModal('addMedicationModal'));
  $('#btnAddFeeding')?.addEventListener('click', () => openModal('addFeedingModal'));
  $('#btnAddWater')?.addEventListener('click', () => openModal('addWaterModal'));
  $('#btnExportPdf')?.addEventListener('click', exportPdf);
  $('#btnShareLink')?.addEventListener('click', generateShareLink);
  $('#btnCopyShareLink')?.addEventListener('click', copyShareLink);
  $('#btnAddSymptom')?.addEventListener('click', () => {
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    loadSymptomPresets();
    openModal('addSymptomModal');
    setSeverityStars(1);
  });
  $('#btnAddExercise')?.addEventListener('click', () => {
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    openModal('addExerciseModal');
  });
  $('#btnAddSleep')?.addEventListener('click', () => {
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    openModal('addSleepModal');
    setSleepQualityStars(3);
  });
  $('#btnSetParents')?.addEventListener('click', () => {
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    loadParentSelectors();
    openModal('setParentsModal');
  });
  $('#btnCompare')?.addEventListener('click', doCompare);
}

function initFormHandlers() {
  $('#addPetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.neutered = fd.has('neutered');
    data.weight = data.weight ? parseFloat(data.weight) : null;
    try {
      await api('/pets', { method: 'POST', body: data });
      showToast('宠物添加成功');
      e.target.reset();
      closeModals();
      await loadPets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addWeightForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.weight = parseFloat(data.weight);
    try {
      await api(`/pets/${currentPetId}/weights`, { method: 'POST', body: data });
      showToast('体重记录添加成功');
      e.target.reset();
      closeModals();
      renderWeightChart();
      await loadPets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addVaccinationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      await api(`/pets/${currentPetId}/vaccinations`, { method: 'POST', body: data });
      showToast('疫苗记录添加成功');
      e.target.reset();
      closeModals();
      renderHealthRecords();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addDewormingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      await api(`/pets/${currentPetId}/deworming`, { method: 'POST', body: data });
      showToast('驱虫记录添加成功');
      e.target.reset();
      closeModals();
      renderHealthRecords();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addCheckupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      await api(`/pets/${currentPetId}/checkups`, { method: 'POST', body: data });
      showToast('体检记录添加成功');
      e.target.reset();
      closeModals();
      renderHealthRecords();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addMedicationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.frequency_per_day = parseInt(data.frequency_per_day);
    data.duration_days = parseInt(data.duration_days);
    try {
      await api(`/pets/${currentPetId}/medications`, { method: 'POST', body: data });
      showToast('用药计划添加成功');
      e.target.reset();
      closeModals();
      renderMedicationPlans();
      renderTodayReminders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addFeedingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    let data = Object.fromEntries(fd);
    const dt = data.feeding_time;
    data.feeding_time = dt.replace('T', ' ') + ':00';
    try {
      await api(`/pets/${currentPetId}/feedings`, { method: 'POST', body: data });
      showToast('喂食记录添加成功');
      e.target.reset();
      closeModals();
      renderDiet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addWaterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.amount_ml = parseFloat(data.amount_ml);
    try {
      await api(`/pets/${currentPetId}/water`, { method: 'POST', body: data });
      showToast('饮水记录添加成功');
      e.target.reset();
      closeModals();
      renderDiet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addSymptomForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.severity = parseInt(data.severity);
    const checkedSymptoms = [];
    $$('#symptomCheckboxes input[type="checkbox"]:checked').forEach(cb => {
      checkedSymptoms.push(cb.value);
    });
    if (checkedSymptoms.length === 0 && !data.custom_description) {
      return showToast('请至少选择一个症状或填写自定义描述', 'warning');
    }
    data.symptoms = checkedSymptoms;
    try {
      const result = await api(`/pets/${currentPetId}/symptoms`, { method: 'POST', body: data });
      showToast('症状记录添加成功');
      e.target.reset();
      closeModals();
      renderSymptoms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addExerciseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.duration_minutes = parseInt(data.duration_minutes);
    data.distance_km = data.distance_km ? parseFloat(data.distance_km) : null;
    try {
      await api(`/pets/${currentPetId}/exercise`, { method: 'POST', body: data });
      showToast('运动记录添加成功');
      e.target.reset();
      closeModals();
      renderActivityPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#addSleepForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.quality = parseInt(data.quality);
    data.sleep_time = `${data.recorded_date} ${data.sleep_time}`;
    data.wake_time = `${data.recorded_date} ${data.wake_time}`;
    try {
      await api(`/pets/${currentPetId}/sleep`, { method: 'POST', body: data });
      showToast('睡眠记录添加成功');
      e.target.reset();
      closeModals();
      renderActivityPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#setParentsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPetId) return showToast('请先选择宠物', 'warning');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.father_id = data.father_id ? parseInt(data.father_id) : null;
    data.mother_id = data.mother_id ? parseInt(data.mother_id) : null;
    try {
      await api(`/pets/${currentPetId}/parents`, { method: 'PUT', body: data });
      showToast('父母关系设置成功');
      closeModals();
      await loadPets();
      renderFamilyPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadPets() {
  try {
    pets = await api('/pets');
    renderPetSelector();
    renderPetCards();
    if (!currentPetId && pets.length > 0) {
      selectPet(pets[0].id);
    } else if (currentPetId) {
      updatePetInfo();
    }
  } catch (err) {
    showToast('加载宠物失败', 'error');
  }
}

function renderPetSelector() {
  const sel = $('#petSelector');
  sel.innerHTML = '<option value="">请选择宠物</option>' +
    pets.map((p) => `<option value="${p.id}">${p.name}（${p.species}）</option>`).join('');
  if (currentPetId) sel.value = currentPetId;
  sel.onchange = () => selectPet(sel.value ? parseInt(sel.value) : null);
}

function renderPetCards() {
  const list = $('#petCardsList');
  if (pets.length === 0) {
    list.innerHTML = `<div class="empty-state col-span-full">
      <div class="empty-icon">🐾</div>
      <div class="empty-text">还没有宠物档案，点击右上角添加第一只宠物吧</div>
    </div>`;
    return;
  }
  list.innerHTML = pets.map((p) => {
    const genderIcon = p.gender === 'male' ? '♂' : '♀';
    const speciesIcon = { '狗': '🐶', '猫': '🐱', '兔': '🐰', '鸟': '🐦', '其他': '🐹' }[p.species] || '🐾';
    const photo = p.photo_url ? `<div class="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-sm">
      <img src="${p.photo_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-4xl\\'>${speciesIcon}</div>'">
    </div>` : `<div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl bg-gradient-to-br from-indigo-100 to-purple-100 flex-shrink-0">${speciesIcon}</div>`;
    const badgeClass = p.lifeStage === '幼年' ? 'badge-info' : p.lifeStage === '老年' ? 'badge-overdue' : 'badge-secondary';
    return `
      <div class="pet-card ${p.id === currentPetId ? 'selected' : ''}" data-id="${p.id}">
        <div class="flex gap-4 items-start">
          ${photo}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-bold text-lg truncate">${p.name}</h3>
              <span class="text-gray-500">${genderIcon}</span>
              <span class="badge ${badgeClass} ml-auto">${p.lifeStage}</span>
            </div>
            <p class="text-sm text-gray-500 mb-2">${p.species} · ${p.breed || '未知品种'}</p>
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>🎂 ${p.age.text}</div>
              <div>⚖️ ${p.weight}kg</div>
              <div>🏷️ ${p.neutered ? '已绝育' : '未绝育'}</div>
              <div>📅 ${p.birth_date}</div>
            </div>
            ${(p.father_id || p.mother_id) ? `
            <div class="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              👨‍👩‍👧 父亲: ${pets.find(x => x.id === p.father_id)?.name || '未知'} / 母亲: ${pets.find(x => x.id === p.mother_id)?.name || '未知'}
            </div>
            ` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
  $$('.pet-card').forEach((card) => {
    card.addEventListener('click', () => selectPet(parseInt(card.dataset.id)));
  });
}

function selectPet(id) {
  currentPetId = id;
  $('#petSelector').value = id || '';
  renderPetCards();
  updatePetInfo();
  if (id) {
    renderWeightChart();
    renderHealthRecords();
    renderMedicationPlans();
    renderTodayReminders();
    renderAlerts();
    renderDiet();
    renderExport();
    renderComparePage();
    renderFamilyPage();
    renderSymptoms();
    renderActivityPage();
  }
}

function updatePetInfo() {
  const pet = pets.find((p) => p.id === currentPetId);
  const info = $('#currentPetInfo');
  if (!pet) {
    info.innerHTML = '';
    return;
  }
  const speciesIcon = { '狗': '🐶', '猫': '🐱', '兔': '🐰', '鸟': '🐦', '其他': '🐹' }[pet.species] || '🐾';
  info.innerHTML = `
    <span class="text-2xl">${speciesIcon}</span>
    <div>
      <div class="font-semibold text-gray-700">${pet.name}</div>
      <div class="text-xs">${pet.age.text} · ${pet.weight}kg</div>
    </div>
  `;
}

async function renderWeightChart() {
  if (!currentPetId) return;
  try {
    const weights = await api(`/pets/${currentPetId}/weights`);
    const ctx = $('#weightChart');
    if (!ctx) return;
    if (weightChart) weightChart.destroy();
    const labels = weights.map((w) => w.recorded_date);
    const data = weights.map((w) => w.weight);
    weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '体重 (kg)',
          data,
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#4F46E5',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937',
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (c) => `体重: ${c.parsed.y} kg`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 12 }, callback: (v) => `${v}kg` },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0 },
          },
        },
      },
    });
  } catch (err) {
    console.error(err);
  }
}

async function renderHealthRecords() {
  if (!currentPetId) return;
  try {
    const [vaccinations, deworming, checkups] = await Promise.all([
      api(`/pets/${currentPetId}/vaccinations`),
      api(`/pets/${currentPetId}/deworming`),
      api(`/pets/${currentPetId}/checkups`),
    ]);

    $('#vaccinationList').innerHTML = vaccinations.length === 0
      ? '<div class="empty-state"><div class="empty-icon">💉</div><div class="empty-text">暂无疫苗记录</div></div>'
      : vaccinations.map((v) => {
          const today = new Date().toISOString().split('T')[0];
          let badge = '';
          if (v.next_vaccination_date) {
            if (v.next_vaccination_date < today) {
              badge = '<span class="badge badge-overdue">已过期</span>';
            } else {
              const diff = Math.ceil((new Date(v.next_vaccination_date) - new Date(today)) / 86400000);
              if (diff <= 7) badge = `<span class="badge badge-pending">${diff}天后</span>`;
            }
          }
          return `<div class="health-list-item">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-sm truncate">${v.vaccine_name}</span>
                ${badge}
              </div>
              <div class="text-xs text-gray-500">接种: ${v.vaccination_date}${v.institution ? ' · ' + v.institution : ''}</div>
              ${v.next_vaccination_date ? `<div class="text-xs text-indigo-600">下次: ${v.next_vaccination_date}</div>` : ''}
            </div>
          </div>`;
        }).join('');

    $('#dewormingList').innerHTML = deworming.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🐛</div><div class="empty-text">暂无驱虫记录</div></div>'
      : deworming.map((d) => {
          const today = new Date().toISOString().split('T')[0];
          let badge = '';
          if (d.next_deworming_date) {
            if (d.next_deworming_date < today) {
              badge = '<span class="badge badge-overdue">已过期</span>';
            } else {
              const diff = Math.ceil((new Date(d.next_deworming_date) - new Date(today)) / 86400000);
              if (diff <= 7) badge = `<span class="badge badge-pending">${diff}天后</span>`;
            }
          }
          return `<div class="health-list-item">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-sm truncate">${d.medicine_name || '驱虫药'}</span>
                ${badge}
              </div>
              <div class="text-xs text-gray-500">日期: ${d.deworming_date}</div>
              ${d.next_deworming_date ? `<div class="text-xs text-indigo-600">下次: ${d.next_deworming_date}</div>` : ''}
              ${d.notes ? `<div class="text-xs text-gray-500 mt-1">${d.notes}</div>` : ''}
            </div>
          </div>`;
        }).join('');

    $('#checkupList').innerHTML = checkups.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🏥</div><div class="empty-text">暂无体检记录</div></div>'
      : checkups.map((c) => `<div class="health-list-item items-start">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm mb-1">${c.checkup_date}</div>
          ${c.items ? `<div class="text-xs text-indigo-600 mb-1">项目: ${c.items}</div>` : ''}
          ${c.result ? `<div class="text-xs text-gray-600 mb-1">结果: ${c.result}</div>` : ''}
          ${c.doctor_advice ? `<div class="text-xs text-emerald-700">建议: ${c.doctor_advice}</div>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    console.error(err);
  }
}

async function renderTodayReminders() {
  const todayCount = $('#todayReminderCount');
  const container = $('#todayRemindersList');
  const noHint = $('#noRemindersHint');
  if (!container) return;
  try {
    const data = await api('/reminders/today');
    const all = [...(data.overdue || []), ...(data.today || [])];
    const total = all.filter((r) => r.status === 'pending').length;
    todayCount.textContent = total;
    if (all.length === 0) {
      container.innerHTML = '';
      noHint.classList.remove('hidden');
      return;
    }
    noHint.classList.add('hidden');
    container.innerHTML = all.map((r) => {
      const isOverdue = r.status === 'pending' && (data.overdue || []).some((o) => o.id === r.id);
      const timePart = r.reminder_time.split(' ')[1] || r.reminder_time;
      return `<div class="reminder-item ${r.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'border-red-300 bg-red-50' : ''}">
        <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${r.status === 'completed' ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} font-bold text-sm">
          ${timePart.slice(0, 5)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-sm">${r.medicine_name}</span>
            <span class="text-xs text-gray-500">${r.dosage}</span>
            <span class="badge badge-info">${r.pet_name}</span>
            ${isOverdue ? '<span class="badge badge-overdue">已过期</span>' : ''}
          </div>
          <div class="text-xs text-gray-500">${r.reminder_time}</div>
        </div>
        <div class="flex-shrink-0">
          ${r.status === 'completed'
            ? '<span class="badge badge-completed">已完成</span>'
            : `<button onclick="completeReminder(${r.id})" class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition">完成</button>`}
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

window.completeReminder = async function (id) {
  try {
    await api(`/reminders/${id}`, { method: 'PUT', body: { status: 'completed' } });
    showToast('已标记完成');
    renderTodayReminders();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function renderMedicationPlans() {
  if (!currentPetId) return;
  const container = $('#medicationPlansList');
  if (!container) return;
  try {
    const plans = await api(`/pets/${currentPetId}/medications`);
    container.innerHTML = plans.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无用药计划</div></div>'
      : plans.map((p) => {
          const end = new Date(p.start_date);
          end.setDate(end.getDate() + p.duration_days);
          const statusBadge = p.status === 'active'
            ? '<span class="badge badge-primary">进行中</span>'
            : '<span class="badge badge-completed">已完成</span>';
          return `<div class="medication-plan-item">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-bold text-gray-800">${p.medicine_name}</h4>
                  ${statusBadge}
                </div>
                <div class="text-sm text-gray-600">剂量: ${p.dosage} · 每日 ${p.frequency_per_day} 次 · 持续 ${p.duration_days} 天</div>
                <div class="text-xs text-gray-500 mt-1">${p.start_date} 至 ${end.toISOString().split('T')[0]}</div>
              </div>
              <div class="flex gap-2">
                ${p.status === 'active' ? `<button onclick="completeMedPlan(${p.id})" class="btn-edit">完成</button>` : ''}
                <button onclick="deleteMedPlan(${p.id})" class="btn-delete">删除</button>
              </div>
            </div>
          </div>`;
        }).join('');
  } catch (err) {
    console.error(err);
  }
}

window.completeMedPlan = async function (id) {
  try {
    await api(`/medications/${id}`, { method: 'PUT', body: { status: 'completed' } });
    showToast('用药计划已完成');
    renderMedicationPlans();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteMedPlan = async function (id) {
  if (!confirm('确定删除该用药计划？')) return;
  try {
    await api(`/medications/${id}`, { method: 'DELETE' });
    showToast('已删除');
    renderMedicationPlans();
    renderTodayReminders();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteSymptom = async function (id) {
  if (!confirm('确定删除该症状记录？')) return;
  try {
    await api(`/symptoms/${id}`, { method: 'DELETE' });
    showToast('已删除');
    renderSymptoms();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteExercise = async function (id) {
  if (!confirm('确定删除该运动记录？')) return;
  try {
    await api(`/exercise/${id}`, { method: 'DELETE' });
    showToast('已删除');
    renderExercise();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteSleep = async function (id) {
  if (!confirm('确定删除该睡眠记录？')) return;
  try {
    await api(`/sleep/${id}`, { method: 'DELETE' });
    showToast('已删除');
    renderSleep();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function renderAlerts() {
  const container = $('#alertCardsList');
  const noHint = $('#noAlertsHint');
  if (!container) return;
  try {
    const data = currentPetId
      ? await api(`/pets/${currentPetId}/alerts`)
      : await api('/alerts/all');
    const alerts = currentPetId ? data : data;
    if (alerts.length === 0) {
      container.innerHTML = '';
      noHint.classList.remove('hidden');
      return;
    }
    noHint.classList.add('hidden');
    const levelClass = { danger: 'alert-danger', warning: 'alert-warning', info: 'alert-info' };
    const levelIcon = { danger: '🚨', warning: '⚠️', info: '💡' };
    container.innerHTML = alerts.map((a) => {
      const title = a.petName ? `${a.petName} · ${a.category}` : a.category;
      return `<div class="alert-card ${levelClass[a.level] || 'alert-info'}">
        <div class="alert-icon">${levelIcon[a.level] || 'ℹ️'}</div>
        <div class="flex-1 min-w-0">
          <div class="alert-title">${title}</div>
          <div class="alert-message">${a.message}</div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function renderDiet() {
  if (!currentPetId) return;
  try {
    const [feedings, recommendation] = await Promise.all([
      api(`/pets/${currentPetId}/feedings`),
      api(`/pets/${currentPetId}/diet-recommendation`),
    ]);

    const tbody = $('#feedingRecordsTable');
    tbody.innerHTML = feedings.length === 0
      ? '<tr><td colspan="4" class="text-center py-8 text-gray-400">今日暂无喂食记录</td></tr>'
      : feedings.map((f) => `<tr>
        <td>${f.feeding_time.replace('T', ' ').slice(0, 16)}</td>
        <td>${f.food}</td>
        <td>${f.portion || '—'}</td>
        <td><button onclick="deleteFeeding(${f.id})" class="btn-delete">删除</button></td>
      </tr>`).join('');

    $('#calorieValue').textContent = recommendation.dailyCalories;
    $('#waterRecommendValue').textContent = recommendation.waterRecommendation;
    $('#waterTarget').textContent = recommendation.waterRecommendation;
    $('#waterCurrent').textContent = recommendation.todayWater;
    const pct = Math.min(100, recommendation.waterRecommendation > 0
      ? (recommendation.todayWater / recommendation.waterRecommendation) * 100
      : 0);
    $('#waterProgressBar').style.width = `${pct}%`;
    $('#waterPercent').textContent = `今日饮水完成 ${pct.toFixed(0)}%`;
    const bar = $('#waterProgressBar');
    if (pct < 50) {
      bar.className = 'h-3 rounded-full transition-all bg-orange-500';
    } else if (pct < 80) {
      bar.className = 'h-3 rounded-full transition-all bg-blue-400';
    } else {
      bar.className = 'h-3 rounded-full transition-all bg-blue-500';
    }
  } catch (err) {
    console.error(err);
  }
}

window.deleteFeeding = async function (id) {
  try {
    await api(`/feedings/${id}`, { method: 'DELETE' });
    showToast('已删除');
    renderDiet();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function renderExport() {
  if (!currentPetId) return;
  try {
    const summary = await api(`/pets/${currentPetId}/expenses/summary`);
    $('#expenseTotalValue').textContent = summary.total.toFixed(2);
    const labels = { medical: '医疗', medication: '用药', food: '食物' };
    const colors = ['#EF4444', '#F59E0B', '#10B981'];
    const catData = summary.categories || [];
    const ctx = $('#expenseChart');
    if (!ctx) return;
    if (expenseChart) expenseChart.destroy();
    if (catData.length === 0) {
      ctx.parentElement.innerHTML = '<div class="empty-state h-full flex flex-col items-center justify-center"><div class="empty-icon">💰</div><div class="empty-text">本月暂无花费记录</div></div>';
      return;
    }
    expenseChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: catData.map((c) => labels[c.category] || c.category),
        datasets: [{
          data: catData.map((c) => c.total),
          backgroundColor: colors.slice(0, catData.length),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: (c) => `¥${c.parsed.toFixed(2)}` },
          },
        },
      },
    });
  } catch (err) {
    console.error(err);
  }
}

function exportPdf() {
  if (!currentPetId) return showToast('请先选择宠物', 'warning');
  const url = `${API_BASE.replace('/api', '')}/api/pets/${currentPetId}/export`;
  window.open(url, '_blank');
}

async function generateShareLink() {
  if (!currentPetId) return showToast('请先选择宠物', 'warning');
  try {
    const data = await api(`/pets/${currentPetId}/share`, { method: 'POST', body: {} });
    const fullUrl = `${window.location.origin}/share.html?token=${data.token}`;
    $('#shareLinkUrl').value = fullUrl;
    $('#shareLinkResult').classList.remove('hidden');
    showToast('分享链接已生成');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyShareLink() {
  const input = $('#shareLinkUrl');
  input.select();
  document.execCommand('copy');
  showToast('链接已复制到剪贴板');
}

// ===== COMPARE =====
function renderComparePage() {
  const container = $('#comparePetCheckboxes');
  if (!container) return;
  if (pets.length === 0) {
    container.innerHTML = '<span class="text-sm text-gray-500">暂无宠物</span>';
    return;
  }
  container.innerHTML = pets.map(p => `
    <label class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-indigo-50 transition text-sm">
      <input type="checkbox" value="${p.id}" class="compare-checkbox" ${selectedCompareIds.includes(p.id) ? 'checked' : ''}>
      <span>${p.name}</span>
    </label>
  `).join('');

  $$('.compare-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.value);
      if (cb.checked) {
        if (selectedCompareIds.length < 3) {
          selectedCompareIds.push(id);
        } else {
          cb.checked = false;
          showToast('最多只能选择3只宠物', 'warning');
        }
      } else {
        selectedCompareIds = selectedCompareIds.filter(i => i !== id);
      }
      const btn = $('#btnCompare');
      if (btn) btn.disabled = selectedCompareIds.length < 2;
    });
  });

  const btn = $('#btnCompare');
  if (btn) btn.disabled = selectedCompareIds.length < 2;
}

async function doCompare() {
  if (selectedCompareIds.length < 2) {
    return showToast('请至少选择2只宠物', 'warning');
  }
  try {
    const data = await api(`/pets/compare?ids=${selectedCompareIds.join(',')}`);
    renderCompareResults(data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCompareResults(data) {
  const container = $('#compareResults');
  if (!container) return;

  const colors = ['#4F46E5', '#10B981', '#F59E0B'];
  const petNames = data.map(d => d.pet.name);

  const allDates = new Set();
  data.forEach(d => d.weights.forEach(w => allDates.add(w.recorded_date)));
  const sortedDates = Array.from(allDates).sort();

  const weightDatasets = data.map((d, i) => ({
    label: d.pet.name,
    data: sortedDates.map(date => {
      const w = d.weights.find(x => x.recorded_date === date);
      return w ? w.weight : null;
    }),
    borderColor: colors[i],
    backgroundColor: colors[i] + '20',
    borderWidth: 2.5,
    fill: false,
    tension: 0.35,
    pointBackgroundColor: colors[i],
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    spanGaps: true,
  }));

  const vaccineData = data.map(d => d.vaccineCoverage);
  const expenseData = data.map(d => d.monthlyExpense);

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">📈 体重变化对比</h3>
      <div class="relative" style="height: 280px;">
        <canvas id="compareWeightChart"></canvas>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">💉 疫苗覆盖率</h3>
        <div class="space-y-4">
          ${data.map((d, i) => `
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-gray-700">${d.pet.name}</span>
                <span class="text-sm font-bold" style="color: ${colors[i]}">${d.vaccineCoverage}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="h-2.5 rounded-full transition-all" style="width: ${d.vaccineCoverage}%; background: ${colors[i]}"></div>
              </div>
              <div class="text-xs text-gray-500 mt-1">已接种 ${d.vaccinatedCount} / ${d.recommendedVaccines.length} 种推荐疫苗</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">💰 本月花费对比</h3>
        <div class="relative" style="height: 220px;">
          <canvas id="compareExpenseChart"></canvas>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">📋 基本信息对比</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-gray-600">
              <th class="px-4 py-3 text-left">项目</th>
              ${data.map(d => `<th class="px-4 py-3 text-left">${d.pet.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-4 py-2.5 text-gray-500">种类</td>
              ${data.map(d => `<td class="px-4 py-2.5">${d.pet.species}</td>`).join('')}
            </tr>
            <tr>
              <td class="px-4 py-2.5 text-gray-500">品种</td>
              ${data.map(d => `<td class="px-4 py-2.5">${d.pet.breed || '未知'}</td>`).join('')}
            </tr>
            <tr>
              <td class="px-4 py-2.5 text-gray-500">年龄</td>
              ${data.map(d => `<td class="px-4 py-2.5">${d.pet.age.text}</td>`).join('')}
            </tr>
            <tr>
              <td class="px-4 py-2.5 text-gray-500">体重</td>
              ${data.map(d => `<td class="px-4 py-2.5">${d.pet.weight} kg</td>`).join('')}
            </tr>
            <tr>
              <td class="px-4 py-2.5 text-gray-500">生命阶段</td>
              ${data.map(d => `<td class="px-4 py-2.5">${d.pet.lifeStage}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const weightCtx = $('#compareWeightChart');
  if (weightCtx) {
    if (compareWeightChart) compareWeightChart.destroy();
    compareWeightChart = new Chart(weightCtx, {
      type: 'line',
      data: { labels: sortedDates, datasets: weightDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y} kg` },
          },
        },
        scales: {
          y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => `${v}kg` } },
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } } },
        },
      },
    });
  }

  const expenseCtx = $('#compareExpenseChart');
  if (expenseCtx) {
    if (compareExpenseChart) compareExpenseChart.destroy();
    compareExpenseChart = new Chart(expenseCtx, {
      type: 'bar',
      data: {
        labels: petNames,
        datasets: [{
          label: '本月花费 (元)',
          data: expenseData,
          backgroundColor: colors.slice(0, data.length),
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: (c) => `¥${c.parsed.y.toFixed(2)}` },
          },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => `¥${v}` } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

// ===== FAMILY =====
function renderFamilyPage() {
  renderFamilyTree();
  renderFamilyPetInfo();
}

async function renderFamilyTree() {
  const container = $('#familyTree');
  if (!container) return;
  if (!currentPetId) {
    container.innerHTML = `<div class="text-center text-gray-400 py-8"><p class="text-4xl mb-2">🌳</p><p>请先选择宠物查看家族树</p></div>`;
    return;
  }
  try {
    const tree = await api(`/pets/${currentPetId}/family`);
    container.innerHTML = buildFamilyTreeHtml(tree, 0);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="text-center text-gray-400 py-8"><p class="text-4xl mb-2">❌</p><p>加载家族树失败</p></div>`;
  }
}

function buildFamilyTreeHtml(node, level) {
  if (!node) return '';
  const speciesIcon = { '狗': '🐶', '猫': '🐱', '兔': '🐰', '鸟': '🐦', '其他': '🐹' }[node.species] || '🐾';
  const genderIcon = node.gender === 'male' ? '♂️' : '♀️';
  const isCurrent = node.id === currentPetId;
  
  let html = `
    <div class="family-tree-node ${isCurrent ? 'current' : ''}" style="margin-left: ${level * 24}px;">
      <div class="flex items-center gap-2 p-2 rounded-lg ${isCurrent ? 'bg-indigo-100 border border-indigo-300' : 'bg-gray-50'}">
        <span class="text-xl">${speciesIcon}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm ${isCurrent ? 'text-indigo-700' : 'text-gray-800'}">${node.name} ${genderIcon}</div>
          <div class="text-xs text-gray-500">${node.breed || '未知品种'} · ${node.age.text}</div>
        </div>
      </div>
    </div>
  `;

  if (node.father) {
    html = `<div class="mb-1"><span class="text-xs text-gray-400 ml-2">👨 父亲</span></div>` + buildFamilyTreeHtml(node.father, level + 1) + html;
  }
  if (node.mother) {
    html = `<div class="mb-1"><span class="text-xs text-gray-400 ml-2">👩 母亲</span></div>` + buildFamilyTreeHtml(node.mother, level + 1) + html;
  }

  if (node.children && node.children.length > 0) {
    html += `<div class="mt-2"><span class="text-xs text-gray-400 ml-2">👶 子代 (${node.children.length})</span></div>`;
    node.children.forEach(child => {
      html += buildFamilyTreeHtml(child, level + 1);
    });
  }

  return html;
}

function renderFamilyPetInfo() {
  const container = $('#familyPetInfo');
  if (!container) return;
  const pet = pets.find(p => p.id === currentPetId);
  if (!pet) {
    container.innerHTML = `<div class="text-center text-gray-400 py-8"><p class="text-4xl mb-2">🐾</p><p>请先选择宠物</p></div>`;
    return;
  }

  const father = pets.find(p => p.id === pet.father_id);
  const mother = pets.find(p => p.id === pet.mother_id);
  const speciesIcon = { '狗': '🐶', '猫': '🐱', '兔': '🐰', '鸟': '🐦', '其他': '🐹' }[pet.species] || '🐾';
  const genderIcon = pet.gender === 'male' ? '♂️' : '♀️';

  container.innerHTML = `
    <div class="text-center">
      <div class="text-5xl mb-3">${speciesIcon}</div>
      <h3 class="text-xl font-bold text-gray-800 mb-1">${pet.name} ${genderIcon}</h3>
      <p class="text-sm text-gray-500 mb-4">${pet.breed || '未知品种'} · ${pet.age.text}</p>
      
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">父亲</div>
          <div class="font-semibold text-sm text-blue-700">${father ? father.name : '未知'}</div>
        </div>
        <div class="bg-pink-50 rounded-lg p-3">
          <div class="text-xs text-gray-500 mb-1">母亲</div>
          <div class="font-semibold text-sm text-pink-700">${mother ? mother.name : '未知'}</div>
        </div>
      </div>

      <div class="text-left space-y-2 text-sm">
        <div class="flex justify-between py-1 border-b border-gray-100">
          <span class="text-gray-500">种类</span>
          <span class="font-medium">${pet.species}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-gray-100">
          <span class="text-gray-500">体重</span>
          <span class="font-medium">${pet.weight} kg</span>
        </div>
        <div class="flex justify-between py-1 border-b border-gray-100">
          <span class="text-gray-500">出生日期</span>
          <span class="font-medium">${pet.birth_date}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-gray-500">生命阶段</span>
          <span class="font-medium">${pet.lifeStage}</span>
        </div>
      </div>
    </div>
  `;
}

function loadParentSelectors() {
  const fatherSelect = $('#setParentsForm select[name="father_id"]');
  const motherSelect = $('#setParentsForm select[name="mother_id"]');
  const pet = pets.find(p => p.id === currentPetId);
  
  const malePets = pets.filter(p => p.gender === 'male' && p.id !== currentPetId);
  const femalePets = pets.filter(p => p.gender === 'female' && p.id !== currentPetId);

  fatherSelect.innerHTML = '<option value="">无</option>' + 
    malePets.map(p => `<option value="${p.id}" ${pet && pet.father_id === p.id ? 'selected' : ''}>${p.name}（${p.breed || p.species}）</option>`).join('');
  
  motherSelect.innerHTML = '<option value="">无</option>' + 
    femalePets.map(p => `<option value="${p.id}" ${pet && pet.mother_id === p.id ? 'selected' : ''}>${p.name}（${p.breed || p.species}）</option>`).join('');
}

// ===== SYMPTOMS =====
async function loadSymptomPresets() {
  if (symptomPresets.length > 0) return renderSymptomCheckboxes();
  try {
    symptomPresets = await api('/symptoms/presets');
    renderSymptomCheckboxes();
  } catch (err) {
    console.error(err);
  }
}

function renderSymptomCheckboxes() {
  const container = $('#symptomCheckboxes');
  if (!container) return;
  container.innerHTML = symptomPresets.map(s => `
    <label class="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded cursor-pointer hover:bg-rose-50 transition text-xs">
      <input type="checkbox" value="${s}" class="w-3.5 h-3.5">
      <span>${s}</span>
    </label>
  `).join('');
}

function setSeverityStars(value) {
  const stars = $$('#severityStars span');
  const input = $('#addSymptomForm input[name="severity"]');
  if (input) input.value = value;
  stars.forEach((star, i) => {
    if (i < value) {
      star.classList.remove('text-gray-300');
      star.classList.add('text-yellow-400');
    } else {
      star.classList.remove('text-yellow-400');
      star.classList.add('text-gray-300');
    }
  });
}

function initSeverityStars() {
  const container = $('#severityStars');
  if (!container) return;
  $$('#severityStars span').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.value);
      setSeverityStars(val);
    });
  });
}

async function renderSymptoms() {
  if (!currentPetId) return;
  const timeline = $('#symptomTimeline');
  const suggestionsDiv = $('#aiSuggestions');
  if (!timeline) return;

  try {
    const data = await api(`/pets/${currentPetId}/symptoms`);
    const { records, suggestions } = data;

    if (records.length === 0) {
      timeline.innerHTML = `<div class="text-center text-gray-400 py-8"><p class="text-4xl mb-2">🤒</p><p>暂无症状记录</p></div>`;
    } else {
      const grouped = {};
      records.forEach(r => {
        if (!grouped[r.recorded_date]) grouped[r.recorded_date] = [];
        grouped[r.recorded_date].push(r);
      });

      const dates = Object.keys(grouped).sort().reverse();
      timeline.innerHTML = dates.map(date => {
        const dayRecords = grouped[date];
        return `
          <div class="symptom-day">
            <div class="symptom-date" data-date="${date}">${date}</div>
            <div class="space-y-3">
              ${dayRecords.map(r => {
                const severityColor = r.severity >= 4 ? 'severe' : r.severity >= 3 ? 'moderate' : 'mild';
                const symptoms = r.symptoms.split(',');
                return `
                  <div class="symptom-card ${severityColor}">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1">
                        <div class="flex flex-wrap gap-1 mb-2">
                          ${symptoms.map(s => `<span class="symptom-tag">${s}</span>`).join('')}
                        </div>
                        ${r.custom_description ? `<p class="text-sm text-gray-600 mb-2">${r.custom_description}</p>` : ''}
                        ${r.photo_url ? `<img src="${r.photo_url}" class="w-20 h-20 object-cover rounded-lg mb-2" onerror="this.style.display='none'">` : ''}
                      </div>
                      <div class="flex-shrink-0 text-right">
                        <div class="text-yellow-500 text-sm">${'★'.repeat(r.severity)}${'☆'.repeat(5 - r.severity)}</div>
                        <div class="text-xs text-gray-400 mt-1">严重程度</div>
                        <button onclick="deleteSymptom(${r.id})" class="btn-delete mt-2 text-xs">删除</button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    if (suggestionsDiv && suggestions) {
      suggestionsDiv.innerHTML = suggestions.map(s => {
        const typeClass = { danger: 'bg-red-50 border-red-200 text-red-700', warning: 'bg-amber-50 border-amber-200 text-amber-700', info: 'bg-blue-50 border-blue-200 text-blue-700' }[s.type] || 'bg-gray-50 border-gray-200 text-gray-700';
        const icon = { danger: '🚨', warning: '⚠️', info: '💡' }[s.type] || '💡';
        return `
          <div class="p-3 rounded-lg border ${typeClass}">
            <div class="flex items-center gap-2 mb-1">
              <span>${icon}</span>
              <span class="font-semibold text-sm">${s.title}</span>
            </div>
            <p class="text-xs leading-relaxed">${s.description}</p>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// ===== ACTIVITY (Exercise & Sleep) =====
function setSleepQualityStars(value) {
  const stars = $$('#sleepQualityStars span');
  const input = $('#addSleepForm input[name="quality"]');
  if (input) input.value = value;
  stars.forEach((star, i) => {
    if (i < value) {
      star.classList.remove('text-gray-300');
      star.classList.add('text-indigo-400');
    } else {
      star.classList.remove('text-indigo-400');
      star.classList.add('text-gray-300');
    }
  });
}

function initSleepQualityStars() {
  const container = $('#sleepQualityStars');
  if (!container) return;
  $$('#sleepQualityStars span').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.value);
      setSleepQualityStars(val);
    });
  });
}

async function renderActivityPage() {
  if (!currentPetId) return;
  renderExercise();
  renderSleep();
}

async function renderExercise() {
  const statusDiv = $('#exerciseStatus');
  const listDiv = $('#exerciseList');
  const chartCtx = $('#exerciseChart');
  if (!chartCtx) return;

  try {
    const data = await api(`/pets/${currentPetId}/exercise`);
    const { records, recommendation, todayTotal, status, statusText, weekRecords } = data;

    const statusColor = { insufficient: 'bg-orange-100 text-orange-700 border-orange-200', normal: 'bg-green-100 text-green-700 border-green-200', excessive: 'bg-red-100 text-red-700 border-red-200' }[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    const statusIcon = { insufficient: '⚠️', normal: '✅', excessive: '🔥' }[status] || 'ℹ️';

    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="flex items-center justify-between p-3 rounded-lg border ${statusColor}">
          <div>
            <div class="font-semibold text-sm">今日运动状态：${statusText}</div>
            <div class="text-xs mt-0.5">今日已运动 <strong>${todayTotal}</strong> 分钟 · 推荐 ${recommendation.minMinutes}-${recommendation.maxMinutes} 分钟</div>
          </div>
          <div class="text-2xl">${statusIcon}</div>
        </div>
      `;
    }

    const weekDays = [];
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date('2026-06-13');
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecords = weekRecords.filter(r => r.recorded_date === dateStr);
      const totalMin = dayRecords.reduce((s, r) => s + r.duration_minutes, 0);
      weekDays.push(dateStr.slice(5));
      weekData.push(totalMin);
    }

    if (exerciseChart) exerciseChart.destroy();
    exerciseChart = new Chart(chartCtx, {
      type: 'bar',
      data: {
        labels: weekDays,
        datasets: [
          {
            label: '运动时长 (分钟)',
            data: weekData,
            backgroundColor: weekData.map(v => v >= recommendation.minMinutes ? '#10B981' : '#F59E0B'),
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: '推荐最低',
            data: Array(7).fill(recommendation.minMinutes),
            type: 'line',
            borderColor: '#9CA3AF',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 }, padding: 12 } },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: (c) => c.dataset.type === 'line' ? `${c.dataset.label}: ${c.parsed.y}分钟` : `${c.parsed.y} 分钟` },
          },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => `${v}分` } },
          x: { grid: { display: false } },
        },
      },
    });

    if (listDiv) {
      const typeNames = { walk: '散步', run: '跑步', swim: '游泳', play: '室内玩耍' };
      const typeIcons = { walk: '🚶', run: '🏃', swim: '🏊', play: '🎾' };
      const recent = records.slice(0, 10);
      listDiv.innerHTML = recent.length === 0
        ? '<div class="text-center text-gray-400 py-6"><p class="text-2xl mb-2">🏃</p><p class="text-sm">暂无运动记录</p></div>'
        : recent.map(r => `
          <div class="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
            <div class="text-xl">${typeIcons[r.exercise_type] || '🏃'}</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm text-gray-800">${typeNames[r.exercise_type] || r.exercise_type}</div>
              <div class="text-xs text-gray-500">${r.recorded_date}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="font-semibold text-sm text-emerald-600">${r.duration_minutes} 分钟</div>
              ${r.distance_km ? `<div class="text-xs text-gray-500">${r.distance_km} km</div>` : ''}
              <button onclick="deleteExercise(${r.id})" class="btn-delete mt-1 text-xs">删除</button>
            </div>
          </div>
        `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function renderSleep() {
  const summaryDiv = $('#sleepSummary');
  const listDiv = $('#sleepList');
  const chartCtx = $('#sleepChart');
  if (!chartCtx) return;

  try {
    const data = await api(`/pets/${currentPetId}/sleep`);
    const { records, weekRecords, avgQuality, avgHours } = data;

    if (summaryDiv) {
      summaryDiv.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center p-3 rounded-lg bg-indigo-50">
            <div class="text-2xl font-bold text-indigo-600">${avgHours}</div>
            <div class="text-xs text-gray-500 mt-1">平均睡眠时长 (小时)</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-purple-50">
            <div class="text-2xl font-bold text-purple-600">${avgQuality} <span class="text-lg">★</span></div>
            <div class="text-xs text-gray-500 mt-1">平均睡眠质量</div>
          </div>
        </div>
      `;
    }

    const weekDays = [];
    const weekHours = [];
    const weekQuality = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date('2026-06-13');
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecord = weekRecords.find(r => r.recorded_date === dateStr);
      weekDays.push(dateStr.slice(5));
      if (dayRecord) {
        const sleep = new Date(dayRecord.sleep_time);
        const wake = new Date(dayRecord.wake_time);
        if (wake < sleep) wake.setDate(wake.getDate() + 1);
        const hours = (wake - sleep) / (1000 * 60 * 60);
        weekHours.push(parseFloat(hours.toFixed(1)));
        weekQuality.push(dayRecord.quality);
      } else {
        weekHours.push(0);
        weekQuality.push(0);
      }
    }

    if (sleepChart) sleepChart.destroy();
    sleepChart = new Chart(chartCtx, {
      type: 'bar',
      data: {
        labels: weekDays,
        datasets: [
          {
            label: '睡眠时长 (小时)',
            data: weekHours,
            backgroundColor: '#818CF8',
            borderRadius: 6,
            borderSkipped: false,
            yAxisID: 'y',
          },
          {
            label: '睡眠质量',
            data: weekQuality,
            type: 'line',
            borderColor: '#A855F7',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#A855F7',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.35,
            fill: false,
            yAxisID: 'y1',
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 }, padding: 12 } },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { callback: (v) => `${v}h` },
            title: { display: true, text: '睡眠时长 (h)', font: { size: 11 }, color: '#6B7280' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            max: 5,
            grid: { display: false },
            ticks: { callback: (v) => v + '★' },
            title: { display: true, text: '质量', font: { size: 11 }, color: '#6B7280' },
          },
          x: { grid: { display: false } },
        },
      },
    });

    if (listDiv) {
      const recent = records.slice(0, 10);
      listDiv.innerHTML = recent.length === 0
        ? '<div class="text-center text-gray-400 py-6"><p class="text-2xl mb-2">😴</p><p class="text-sm">暂无睡眠记录</p></div>'
        : recent.map(r => {
            const sleepT = r.sleep_time.split(' ')[1]?.slice(0, 5) || r.sleep_time;
            const wakeT = r.wake_time.split(' ')[1]?.slice(0, 5) || r.wake_time;
            return `
              <div class="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                <div class="text-xl">😴</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm text-gray-800">${sleepT} - ${wakeT}</div>
                  <div class="text-xs text-gray-500">${r.recorded_date}</div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="text-purple-500 text-sm">${'★'.repeat(r.quality)}${'☆'.repeat(5 - r.quality)}</div>
                  <button onclick="deleteSleep(${r.id})" class="btn-delete mt-1 text-xs">删除</button>
                </div>
              </div>
            `;
          }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function init() {
  initNavigation();
  initModalHandlers();
  initFormHandlers();
  initSeverityStars();
  initSleepQualityStars();
  await loadPets();
}

document.addEventListener('DOMContentLoaded', init);
