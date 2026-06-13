const API_BASE = window.location.port === '3448'
  ? 'http://localhost:8448/api'
  : '/api';

let currentPetId = null;
let pets = [];
let weightChart = null;
let expenseChart = null;

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

async function init() {
  initNavigation();
  initModalHandlers();
  initFormHandlers();
  await loadPets();
}

document.addEventListener('DOMContentLoaded', init);
