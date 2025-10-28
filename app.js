/*
  Revoks — прототип для решенческого интервью
  Вариант A: Таблица задач с прогнозами
  - Светлая тема, без сборки, без внешних зависимостей
  - Демо-данные по ипотечным программам
  - Поиск, сортировка, добавление задач, пояснение прогноза
*/

// ------------------ Утилиты ------------------
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

const storageKey = 'revoks_tasks_v1';
const storageUpdatedKey = 'revoks_last_updated_v1';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function formatDelta(v) {
  if (v === 0) return '<span class="delta zero">0</span>';
  const cls = v > 0 ? 'pos' : 'neg';
  const arrow = v > 0 ? '▴' : '▾';
  return `<span class="delta ${cls}"><span class="arrow">${arrow}</span>${v}</span>`;
}

function riskFromDelta(delta, estimate) {
  const ratio = estimate > 0 ? delta / estimate : 0;
  if (delta >= 4 || ratio >= 0.3) return { key: 'high', label: 'Высокий' };
  if (delta >= 1 || ratio >= 0.1) return { key: 'medium', label: 'Средний' };
  return { key: 'low', label: 'Низкий' };
}

// ------------------ Псевдо-ИИ прогноз ------------------

/*
  Эвристический прогноз на основе факторов:
  - complexity: low/medium/high → +0%/+10%/+25%
  - dependencies: low/medium/high → +0%/+7%/+20%
  - novelty: low/medium/high → +0%/+8%/+18%
  - flags: external_api +10%, integration +8%, regulatory +12%, mobile +6%, web +3%
  - similarity (0..1): если высокая похожесть ≥0.7 → -5%
  Доверительный интервал (±): зависит от суммарной неопределенности факторов.
*/
function predictForecast(task) {
  const est = Number(task.estimateDays || 0);
  let mul = 1;
  let reasons = [];

  const cplx = task.factors?.complexity || 'medium';
  if (cplx === 'medium') { mul += 0.10; reasons.push('Средняя сложность: +10%'); }
  if (cplx === 'high')   { mul += 0.25; reasons.push('Высокая сложность: +25%'); }

  const deps = task.factors?.dependencies || 'medium';
  if (deps === 'medium') { mul += 0.07; reasons.push('Средние зависимости: +7%'); }
  if (deps === 'high')   { mul += 0.20; reasons.push('Много зависимостей: +20%'); }

  const nov = task.factors?.novelty || 'medium';
  if (nov === 'medium') { mul += 0.08; reasons.push('Средняя новизна: +8%'); }
  if (nov === 'high')   { mul += 0.18; reasons.push('Высокая новизна: +18%'); }

  const flags = task.factors?.flags || {};
  if (flags.external_api) { mul += 0.10; reasons.push('Внешний API: +10%'); }
  if (flags.integration)  { mul += 0.08; reasons.push('Интеграция: +8%'); }
  if (flags.regulatory)   { mul += 0.12; reasons.push('Регуляторика: +12%'); }
  if (flags.mobile)       { mul += 0.06; reasons.push('Мобильная платформа: +6%'); }
  if (flags.web)          { mul += 0.03; reasons.push('Веб-интерфейс: +3%'); }

  const sim = typeof task.similarity === 'number' ? task.similarity : 0.5;
  if (sim >= 0.7) { mul -= 0.05; reasons.push('Высокая похожесть с историей: −5%'); }

  const forecast = Math.max(1, Math.round(est * mul));

  // Доверительный интервал: чем больше факторов, тем шире
  const uncertainty =
    (cplx === 'high' ? 2 : cplx === 'medium' ? 1 : 0) +
    (deps === 'high' ? 2 : deps === 'medium' ? 1 : 0) +
    (nov === 'high' ? 2 : nov === 'medium' ? 1 : 0) +
    (flags.external_api ? 1 : 0) + (flags.integration ? 1 : 0) +
    (flags.regulatory ? 2 : 0) + (flags.mobile ? 1 : 0) + (flags.web ? 0.5 : 0);

  const spread = Math.ceil(clamp(uncertainty, 0, 8) * 0.6 + forecast * 0.06);
  const range = { low: Math.max(1, forecast - spread), high: forecast + spread };

  return { forecastDays: forecast, range, reasons };
}

// ------------------ Данные ------------------

const demoTasks = [
  {
    key: 'MORT-101',
    title: 'Ипотека с господдержкой: обновить условия по ставке',
    url: '',
    estimateDays: 3,
    type: 'improvement',
    similarity: 0.6,
    factors: { complexity: 'medium', dependencies: 'medium', novelty: 'medium', flags: { regulatory: true, web: true } }
  },
  {
    key: 'MORT-102',
    title: 'Интеграция расчёта платежа в мобильном приложении',
    url: '',
    estimateDays: 8,
    type: 'feature',
    similarity: 0.55,
    factors: { complexity: 'high', dependencies: 'high', novelty: 'medium', flags: { integration: true, mobile: true } }
  },
  {
    key: 'MORT-103',
    title: 'Подключение страхового калькулятора (партнёрский API) к анкете',
    url: '',
    estimateDays: 5,
    type: 'ft',
    similarity: 0.7,
    factors: { complexity: 'medium', dependencies: 'high', novelty: 'low', flags: { external_api: true, integration: true } }
  },
  {
    key: 'MORT-104',
    title: 'Семейная ипотека: добавление тарифов и ограничений',
    url: '',
    estimateDays: 10,
    type: 'epic',
    similarity: 0.45,
    factors: { complexity: 'high', dependencies: 'medium', novelty: 'high', flags: { regulatory: true, web: true } }
  },
  {
    key: 'MORT-105',
    title: 'Миграция справочников регионов для субсидий',
    url: '',
    estimateDays: 4,
    type: 'task',
    similarity: 0.8,
    factors: { complexity: 'medium', dependencies: 'medium', novelty: 'low', flags: { web: true } }
  },
  {
    key: 'MORT-106',
    title: 'Формирование PDF-оферты с динамическими параметрами',
    url: '',
    estimateDays: 6,
    type: 'doc',
    similarity: 0.5,
    factors: { complexity: 'medium', dependencies: 'medium', novelty: 'medium', flags: { web: true } }
  },
  {
    key: 'MORT-107',
    title: 'Предодобрение через БКИ (внешний API)',
    url: '',
    estimateDays: 7,
    type: 'bt',
    similarity: 0.65,
    factors: { complexity: 'medium', dependencies: 'high', novelty: 'medium', flags: { external_api: true } }
  },
  {
    key: 'MORT-108',
    title: 'Доработка витрины ставок на сайте (A/B)',
    url: '',
    estimateDays: 5,
    type: 'improvement',
    similarity: 0.75,
    factors: { complexity: 'low', dependencies: 'medium', novelty: 'medium', flags: { web: true } }
  },
  {
    key: 'MORT-109',
    title: 'Согласование изменений с юридическим департаментом',
    url: '',
    estimateDays: 2,
    type: 'task',
    similarity: 0.4,
    factors: { complexity: 'low', dependencies: 'high', novelty: 'medium', flags: { regulatory: true } }
  },
  {
    key: 'MORT-110',
    title: 'Обновление скоринговой модели для ИП',
    url: '',
    estimateDays: 12,
    type: 'spike',
    similarity: 0.35,
    factors: { complexity: 'high', dependencies: 'high', novelty: 'high', flags: { external_api: false, integration: true } }
  }
  ,
  {
    key: 'MORT-111',
    title: 'Исправление ошибки расчёта процентной ставки',
    url: '',
    estimateDays: 2,
    type: 'bug',
    similarity: 0.6,
    factors: { complexity: 'low', dependencies: 'medium', novelty: 'low', flags: { web: true } }
  }
];

function loadTasks() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return demoTasks.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return demoTasks.slice();
    return parsed;
  } catch {
    return demoTasks.slice();
  }
}

function saveTasks(tasks) {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function getLastUpdated() {
  const raw = localStorage.getItem(storageUpdatedKey);
  const t = raw ? Number(raw) : NaN;
  if (!Number.isFinite(t)) return null;
  return t;
}

function setLastUpdated(ts = Date.now()) {
  localStorage.setItem(storageUpdatedKey, String(ts));
}

function formatTimeAgo(ts) {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const d = Math.floor(hr / 24);
  return `${d} дн назад`;
}

// ------------------ Рендер ------------------

let state = {
  tasks: loadTasks(),
  search: '',
  sort: { key: 'key', dir: 'asc' },
  lastUpdated: null,
  riskFilter: 'all',
  viewMode: 'days', // 'days' | 'dates'
  expandedKey: null,
};

function computeView(tasks) {
  const enriched = tasks.map(t => {
    const pred = predictForecast(t);
    const delta = pred.forecastDays - Number(t.estimateDays || 0);
    const riskObj = riskFromDelta(delta, Number(t.estimateDays || 0));
    // Уверенность в данных на основе неопределенности и похожести
    const uncertainty = Math.abs(pred.range.high - pred.forecastDays); // чем больше, тем ниже доверие
    const sim = typeof t.similarity === 'number' ? t.similarity : 0.5;
    const confScore = Math.max(0, Math.min(100, Math.round(100 - (uncertainty * 3) + (sim * 20))));
    const confidence = confScore >= 70 ? 'Высокое' : confScore >= 45 ? 'Среднее' : 'Низкое';
    const riskRank = riskObj.key === 'low' ? 0 : riskObj.key === 'medium' ? 1 : 2;
    return { ...t, forecastDays: pred.forecastDays, range: pred.range, reasons: pred.reasons, delta, risk: riskRank, riskKey: riskObj.key, riskLabel: riskObj.label, confidence, confScore };
  });
  // Поиск
  const search = state.search.trim().toLowerCase();
  let filtered = !search ? enriched : enriched.filter(t =>
    t.key.toLowerCase().includes(search) || t.title.toLowerCase().includes(search)
  );
  // Фильтр по риску
  if (state.riskFilter !== 'all') {
    filtered = filtered.filter(t => t.riskKey === state.riskFilter);
  }
  // Сортировка
  const { key, dir } = state.sort;
  filtered.sort((a, b) => {
    const av = a[key]; const bv = b[key];
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), 'ru', { numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
  return filtered;
}

function render() {
  const tbody = qs('#tasksTbody');
  tbody.innerHTML = '';
  const view = computeView(state.tasks);
  qs('#emptyState').classList.toggle('hidden', view.length !== 0);

  for (const t of view) {
    const tr = document.createElement('tr');

    // Задача (ключ + название)
    const tdIssue = document.createElement('td');
    const stageKey = (t.stage || 'in_progress');
    const stageLabel = stageLabelFromKey(stageKey);
    const typeKey = (t.type || 'task');
    tdIssue.innerHTML = `
      <div class="issue">
        <div class="top">
          <span class="type-icon type-${escapeHtml(typeKey)}" title="${escapeHtml(typeLabelFromKey(typeKey))}" aria-label="${escapeHtml(typeLabelFromKey(typeKey))}">${typeIconSVG(typeKey)}</span>
          <span class="key">${escapeHtml(t.key)}</span>
          ${t.url ? `<a href="${escapeAttr(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a>` : `<span class="title">${escapeHtml(t.title)}</span>`}
        </div>
        <div class="meta">
          <span class="stage-badge stage-${escapeHtml(stageKey)}" title="Текущий этап">${escapeHtml(stageLabel)}</span>
        </div>
      </div>`;
    tr.appendChild(tdIssue);
    // Toggle details on clicking the top area (excluding links)
    const topEl = tdIssue.querySelector('.top');
    if (topEl) {
      topEl.style.cursor = 'pointer';
      topEl.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // don't toggle when clicking a link
        toggleDetails(t.key);
      });
    }

    // Оценка
    const tdEst = document.createElement('td');
    tdEst.className = 'num';
    tdEst.textContent = t.estimateDays;
    tr.appendChild(tdEst);

    // Прогноз: в днях или датами (две даты: Dev и Поставка)
    const tdFc = document.createElement('td');
    tdFc.className = 'num';
    if (state.viewMode === 'dates') {
      const pred = predictForecast(t);
      const devDays = pred.forecastDays;
      const devDate = addDaysToDate(new Date(), devDays);
      const isDevDone = isDevCompleted(stageKey);
      const delRange = deliveryRange(pred);
      const delLow = addDaysToDate(new Date(), delRange.low);
      const delHigh = addDaysToDate(new Date(), delRange.high);
      tdFc.classList.remove('num');
      tdFc.innerHTML = `
        <div class="forecast-lines">
          <div class="row"><span class="lbl">🧩 Разработка:</span> ${isDevDone ? `<span class="val">завершена</span> <span class="badge-mini">факт</span>` : `<span class="val" title="${devDays} дн">${formatDate(devDate)}</span> <span class="sub">(${devDays} дн)</span>`}</div>
          <div class="row"><span class="lbl">📦 Поставка (≈80%, ИИ):</span> <span class="val" title="надёжная дата">${formatDateRange(delLow, delHigh)}</span> ${confDot(t)}</div>
        </div>`;
    } else {
      tdFc.innerHTML = `${t.forecastDays} ${confDot(t)}`;
    }
    tr.appendChild(tdFc);

    // Δ
    const tdDelta = document.createElement('td');
    tdDelta.className = 'num';
    tdDelta.innerHTML = formatDelta(t.delta);
    tr.appendChild(tdDelta);

    // Риск
    const tdRisk = document.createElement('td');
    tdRisk.innerHTML = `<span class="risk ${t.riskKey}">${t.riskLabel}</span>`;
    tr.appendChild(tdRisk);

    tbody.appendChild(tr);

    // Details dropdown row
    if (state.expandedKey === t.key) {
      const trDet = document.createElement('tr');
      trDet.className = 'details-row';
      const td = document.createElement('td');
      const colSpan = qsa('#tasksTable thead th').length || 6;
      td.colSpan = colSpan;
      td.innerHTML = buildExplainHtml(t);
      trDet.appendChild(td);
      tbody.appendChild(trDet);
    }
  }
  
  // Заголовки сортировки
  qsa('th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    const isActive = th.dataset.key === state.sort.key;
    if (isActive) th.classList.add(state.sort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });

  // Обновить заголовок колонки прогноза под режим
  const hdrText = qs('#forecastColHeaderText');
  if (hdrText) hdrText.textContent = 'Прогноз (ИИ)';

  renderMeta();
}

// ------------------ Пояснения (минимальная интерпретация) ------------------

function showExplainPopover(anchorBtn, task) {
  const pop = qs('#explainPopover');
  const pred = predictForecast(task);
  const { key: riskKey, label: riskLabel } = riskFromDelta(pred.forecastDays - task.estimateDays, task.estimateDays);

  const chain = (task.bt || task.ft) ? `<div class="range">Цепочка: ${task.bt ? escapeHtml(task.bt) : 'БТ?'} → ${task.ft ? escapeHtml(task.ft) : 'ФТ?'} → ${escapeHtml(task.key)}</div>` : '';

  // Даты для объяснения
  const devDays = pred.forecastDays;
  const devDate = addDaysToDate(new Date(), devDays);
  const delRange = deliveryRange(pred);
  const delLow = addDaysToDate(new Date(), delRange.low);
  const delHigh = addDaysToDate(new Date(), delRange.high);
  const stageKey = (task.stage || 'in_progress');
  const stageLabel = stageLabelFromKey(stageKey);
  const isDevDone = isDevCompleted(stageKey);

  pop.innerHTML = `
    <div class="pop-title">${escapeHtml(task.key)} — Пояснение прогноза</div>
    ${chain}
    <div class="range">Текущий этап: ${escapeHtml(stageLabel)}</div>
    <div><strong>Прогноз:</strong> ${pred.forecastDays} дн <span class="risk ${riskKey}" style="margin-left:6px;">${riskLabel}</span></div>
    <div class="range">Доверительный интервал: ${pred.range.low}–${pred.range.high} дн</div>
    <div class="range">Правило ×2: ${task.estimateDays * 2} дн</div>
    <div class="range">Доверие к данным: ${task.confidence || '—'}</div>
    ${isDevDone ? `<div class="range">🧩 Разработка: завершена (этап: ${escapeHtml(stageLabel)})</div>` : `<div class="range">🧩 Разработка (ожидаемая): ${formatDate(devDate)} (${devDays} дн)</div>`}
    <div class="range">📦 Поставка (надёжная): ${formatDateRange(delLow, delHigh)} (≈80%)</div>
    <div class="factors">
      ${pred.reasons.map(r => `• ${escapeHtml(r)}`).join('<br/>')}
    </div>
    <div class="range">Сравнение с оценкой: ${task.estimateDays} → ${pred.forecastDays} (Δ ${pred.forecastDays - task.estimateDays} дн)</div>
  `;

  // позиционирование рядом с кнопкой
  const rect = anchorBtn.getBoundingClientRect();
  const pad = 8;
  const top = rect.bottom + pad + window.scrollY;
  const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 440);
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
  pop.classList.remove('hidden');

  // Закрытие по клику вне
  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorBtn) {
      pop.classList.add('hidden');
      document.removeEventListener('click', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('click', onDocClick), 0);
}

// Строим HTML для блока пояснения (inline dropdown)
function buildExplainHtml(task) {
  const pred = predictForecast(task);
  const { key: riskKey, label: riskLabel } = riskFromDelta(pred.forecastDays - task.estimateDays, task.estimateDays);
  const chain = (task.bt || task.ft) ? `<div class="range">Цепочка: ${task.bt ? escapeHtml(task.bt) : 'БТ?'} → ${task.ft ? escapeHtml(task.ft) : 'ФТ?'} → ${escapeHtml(task.key)}</div>` : '';
  const devDays = pred.forecastDays;
  const devDate = addDaysToDate(new Date(), devDays);
  const delRange = deliveryRange(pred);
  const delLow = addDaysToDate(new Date(), delRange.low);
  const delHigh = addDaysToDate(new Date(), delRange.high);
  const stageKey = (task.stage || 'in_progress');
  const stageLabel = stageLabelFromKey(stageKey);
  const isDevDone = isDevCompleted(stageKey);
  const confLabel = task.confidence || '—';
  const confScoreText = typeof task.confScore === 'number' ? ` (${task.confScore}%)` : '';

  return `
    <div class="details-card">
      <div class="pop-title">${escapeHtml(task.key)} — Пояснение прогноза</div>
      ${chain}
      <div class="range">Текущий этап: ${escapeHtml(stageLabel)}</div>
      <div><strong>Прогноз (ИИ):</strong> ${pred.forecastDays} дн <span class="risk ${riskKey}" style="margin-left:6px;">${riskLabel}</span> <span class="conf-dot ${confLabel==='Высокое'?'conf-high':confLabel==='Среднее'?'conf-medium':'conf-low'}" title="Уверенность: ${confLabel}${confScoreText}"></span></div>
      <div class="range">Доверительный интервал: ${pred.range.low}–${pred.range.high} дн</div>
      <div class="range">Правило ×2: ${task.estimateDays * 2} дн</div>
      <div class="range">${isDevDone ? '🧩 Разработка: завершена' : `🧩 Разработка (ожидаемая): ${formatDate(devDate)} (${devDays} дн)`}</div>
      <div class="range">📦 Поставка (≈80%, ИИ): ${formatDateRange(delLow, delHigh)}</div>
      <div class="factors" style="margin-top:8px;">
        ${pred.reasons.map(r => `• ${escapeHtml(r)}`).join('<br/>')}
      </div>
      <div class="range" style="margin-top:6px;">Сравнение с оценкой: ${task.estimateDays} → ${pred.forecastDays} (Δ ${pred.forecastDays - task.estimateDays} дн)</div>
    </div>
  `;
}

function toggleDetails(key) {
  state.expandedKey = state.expandedKey === key ? null : key;
  render();
}

// ------------------ Добавление задачи ------------------

function openAddModal() { qs('#addTaskDialog').showModal(); }

function handleAddSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const key = String(fd.get('key') || '').trim();
  const title = String(fd.get('title') || '').trim();
  const estimate = parseInt(String(fd.get('estimate') || '0'), 10);
  const url = String(fd.get('url') || '').trim();
  if (!key || !title || !estimate) return;

  const factors = {
    complexity: String(fd.get('complexity') || 'medium'),
    dependencies: String(fd.get('deps') || 'medium'),
    novelty: String(fd.get('novelty') || 'medium'),
    flags: {
      external_api: !!fd.get('external_api'),
      integration: !!fd.get('integration'),
      regulatory: !!fd.get('regulatory'),
      mobile: !!fd.get('mobile'),
      web: !!fd.get('web')
    }
  };

  const bt = String(fd.get('bt') || '').trim();
  const ft = String(fd.get('ft') || '').trim();
  const stage = String(fd.get('stage') || 'in_progress');
  const type = String(fd.get('type') || 'feature');

  state.tasks.push({ key, title, url, estimateDays: estimate, similarity: 0.6, factors, bt: bt || undefined, ft: ft || undefined, stage, type });
  saveTasks(state.tasks);
  setLastUpdated();
  state.lastUpdated = getLastUpdated();
  (form.closest('dialog')).close();
  form.reset();
  render();
}

// ------------------ Инициализация ------------------

function escapeHtml(str) {
  return String(str).replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function escapeAttr(str) { return escapeHtml(str); }

function init() {
  // Установить/прочитать время обновления
  const existing = getLastUpdated();
  if (!existing) setLastUpdated();
  state.lastUpdated = getLastUpdated();

  // Поиск
  qs('#searchInput').addEventListener('input', (e) => {
    state.search = e.currentTarget.value || '';
    render();
  });

  // Сортировка по клику на заголовки
  qsa('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.key = key; state.sort.dir = 'asc';
      }
      render();
    });
  });

  // Добавить задачу
  qs('#addTaskBtn').addEventListener('click', openAddModal);
  qs('#addTaskForm').addEventListener('submit', handleAddSubmit);

  // Сброс
  qs('#resetDataBtn').addEventListener('click', () => {
    if (!confirm('Сбросить к демонстрационным данным?')) return;
    state.tasks = demoTasks.slice();
    saveTasks(state.tasks);
    setLastUpdated();
    state.lastUpdated = getLastUpdated();
    render();
  });

  // Фильтр риска
  qs('#riskFilter').addEventListener('change', (e) => {
    state.riskFilter = e.currentTarget.value || 'all';
    render();
  });

  // Переключение режима отображения
  qs('#viewMode').addEventListener('change', (e) => {
    state.viewMode = e.currentTarget.value || 'days';
    render();
  });

  // Пояснение страницы
  qs('#pageInfoBtn').addEventListener('click', (e) => {
    showSimplePopover(e.currentTarget, `
      <div class="pop-title">Зачем эта страница</div>
      <div class="factors">Страница помогает руководителю понять, где сроки могут сорваться и почему: сравнение оценки и прогноза, риск и краткие факторы.</div>
    `);
  });

  // Источник прогноза
  qs('#sourceInfoBtn').addEventListener('click', (e) => {
    showSimplePopover(e.currentTarget, `
      <div class="pop-title">Источник прогноза</div>
      <div class="factors">Прогноз строится на истории завершения похожих задач из Jira и факторов (сложность, зависимости, новизна, интеграции). Демо-данные; модель ориентирована на контекст Дом.РФ. Лёгкий режим подключения: CSV/экспорт без установки плагинов.</div>
    `);
  });

  // Подсказка для заголовка «Прогноз (ИИ)»
  const forecastInfoBtn = qs('#forecastInfoBtn');
  if (forecastInfoBtn) {
    forecastInfoBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // не триггерить сортировку по клику на иконку
      showSimplePopover(e.currentTarget, `
        <div class=\"pop-title\">Что означает «Прогноз (ИИ)»</div>
        <div class=\"factors\">Считается ИИ по истории Jira и факторам задачи. Показывает отличие от оценки, диапазон (надёжность ≈80% для поставки) и риск.</div>
      `);
    });
  }

  // Демо-подсказки (AJTBD walkthrough)
  const demoPanel = qs('#demoPanel');
  qs('#demoToggleBtn').addEventListener('click', () => demoPanel.classList.toggle('hidden'));
  qs('#demoCloseBtn').addEventListener('click', () => demoPanel.classList.add('hidden'));

  // Обновление таймера «когда обновлено»
  setInterval(() => renderMeta(), 60 * 1000);

  render();
}

document.addEventListener('DOMContentLoaded', init);

// ------------------ Общие поповеры ------------------

function showSimplePopover(anchorBtn, html) {
  const pop = qs('#explainPopover');
  pop.innerHTML = html;
  const rect = anchorBtn.getBoundingClientRect();
  const pad = 8;
  const top = rect.bottom + pad + window.scrollY;
  const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 440);
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
  pop.classList.remove('hidden');
  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorBtn) {
      pop.classList.add('hidden');
      document.removeEventListener('click', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('click', onDocClick), 0);
}

function renderMeta() {
  const updated = state.lastUpdated || getLastUpdated();
  const el = qs('#metaUpdated');
  if (el) el.textContent = `Данные обновлены: ${formatTimeAgo(updated)}`;
}

// Маленький индикатор уверенности для ячейки прогноза
function confDot(t) {
  const label = t.confidence || '—';
  const cls = label === 'Высокое' ? 'conf-high' : label === 'Среднее' ? 'conf-medium' : 'conf-low';
  const score = typeof t.confScore === 'number' ? ` (${t.confScore}%)` : '';
  return `<span class="conf-dot ${cls}" title="Уверенность: ${label}${score}"></span>`;
}

// ------------------ Даты и окна ------------------

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function addDaysToDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatDate(d) {
  const day = d.getDate();
  const mon = MONTHS_RU[d.getMonth()];
  return `${day} ${mon}`;
}
function formatDateRange(a, b) {
  // если один месяц — компактная запись
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_RU[a.getMonth()]}`;
  return `${formatDate(a)} – ${formatDate(b)}`;
}
function deliveryRange(pred) {
  // Простая эвристика «надёжной поставки»: разработка + пост‑разработка
  // База: +2 дня; плюс надбавка от неопределённости и факторов
  const dev = pred.forecastDays;
  const uncertainty = Math.abs(pred.range.high - pred.forecastDays);
  const pad = 2 + Math.ceil(uncertainty * 0.6) + 2; // базовые 2 дня + доля от разброса + небольшой запас
  return { low: dev + 2, high: dev + pad };
}

// ------------------ Этапы задачи ------------------
const STAGES = [
  { key: 'backlog', label: 'До разработки' },
  { key: 'in_progress', label: 'В разработке' },
  { key: 'ready_for_test', label: 'Готово к тесту' },
  { key: 'testing', label: 'В тестировании' },
  { key: 'awaiting_acceptance', label: 'Ожидает приёмки' },
  { key: 'done', label: 'Done' },
];
const STAGE_ORDER = STAGES.reduce((acc, s, i) => { acc[s.key] = i; return acc; }, {});
function stageLabelFromKey(key) {
  const found = STAGES.find(s => s.key === key);
  return found ? found.label : 'В разработке';
}
function isDevCompleted(stageKey) {
  const ord = STAGE_ORDER[stageKey] ?? STAGE_ORDER['in_progress'];
  return ord >= STAGE_ORDER['ready_for_test'];
}

// ------------------ Типы задач ------------------
const TYPES = [
  { key: 'feature', label: 'Фича' },
  { key: 'task', label: 'Задача' },
  { key: 'bug', label: 'Баг' },
  { key: 'improvement', label: 'Улучшение' },
  { key: 'spike', label: 'Исследование' },
  { key: 'doc', label: 'Документация' },
  { key: 'epic', label: 'Эпик' },
  { key: 'bt', label: 'Бизнес‑требование' },
  { key: 'ft', label: 'Функциональное требование' },
];
function typeLabelFromKey(key) {
  const f = TYPES.find(t => t.key === key);
  return f ? f.label : 'Задача';
}
function typeIconSVG(key) {
  switch (key) {
    case 'task':
      // checkbox in square (task)
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3.5 9.5L6 10l-1.4 1.4L8.5 15l8-8L15 5.5l-6.5 7Z"/></svg>';
    case 'bt':
      // briefcase (business requirement)
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3h4a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm4 3V5h-4v1h4ZM6 11v1h12v-1H6Z"/></svg>';
    case 'ft':
      // sliders/settings (functional requirement)
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 7h12v2H4zM4 11h16v2H4zM4 15h10v2H4z"/></svg>';
    case 'bug':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 6V4h-4v2H7.5L6 7.5l1.5 1.5H10v2H7l-2-2l-1 1l1.6 1.6A5.99 5.99 0 0 0 5 14H3v2h2c.3 2.3 2 4.2 4.2 4.8c.5.1.8-.3.8-.8V14h4v6c0 .5.3.9.8.8c2.2-.6 3.9-2.5 4.2-4.8h2v-2h-2c-.1-1-.4-2-1-2.9L20 10l-1-1l-2 2h-3V9h2.5L18 7.5L16.5 6H14Z"/></svg>';
    case 'feature':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2Z"/></svg>';
    case 'improvement':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 13h4v6H5v-6Zm5-8h4v14h-4V5Zm5 4h4v10h-4V9Z"/></svg>';
    case 'spike':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 22l6-20l6 20l-6-4l-6 4Z"/></svg>';
    case 'doc':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12V8Zm0 2l4 4h-4ZM8 13h8v2H8Zm0 4h8v2H8Zm0-8h4v2H8Z"/></svg>';
    case 'epic':
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4l-6 4l1.5-7.5L2 9h7l3-7Z"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 21V8l-4 4l-1-1l6-6l6 6l-1 1l-4-4v13H9Z"/></svg>';
  }
}
