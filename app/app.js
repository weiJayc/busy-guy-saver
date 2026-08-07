(function () {
  const state = {
    tasks: [],
    editingId: null,
    currentTags: { a: null, b: null, c: null, d: null },
    importedFileName: null,
    dirty: false,
  };

  const el = {
    storageStatusText: document.getElementById('storageStatusText'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    addTaskBtn: document.getElementById('addTaskBtn'),
    tabTasksBtn: document.getElementById('tabTasksBtn'),
    tabOverviewBtn: document.getElementById('tabOverviewBtn'),
    pageTasks: document.getElementById('pageTasks'),
    pageOverview: document.getElementById('pageOverview'),
    emptyState: document.getElementById('emptyState'),
    taskTable: document.getElementById('taskTable'),
    taskTableBody: document.getElementById('taskTableBody'),
    overviewEmptyState: document.getElementById('overviewEmptyState'),
    overviewContent: document.getElementById('overviewContent'),
    overviewPriority: document.getElementById('overviewPriority'),
    overviewGroups: document.getElementById('overviewGroups'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    taskName: document.getElementById('taskName'),
    axisGroups: document.getElementById('axisGroups'),
    downstreamField: document.getElementById('downstreamField'),
    downstreamDeadlineInput: document.getElementById('downstreamDeadlineInput'),
    suggestionPanel: document.getElementById('suggestionPanel'),
    cancelBtn: document.getElementById('cancelBtn'),
    saveBtn: document.getElementById('saveBtn'),
  };

  const AXIS_TITLES = {
    A: 'A · 期限 (deadline)',
    B: 'B · 型態 (mode)',
    C: 'C · 依賴 (dependency)',
    D: 'D · 主導權 (ownership)',
  };

  // 呈現用的分類順序與說明文字，依 4.2 節的 Allocation Type 定義，
  // 由「需要投入最多個人時間／最常駐」排到「最輕量／最一次性」。
  const ALLOCATION_ORDER = ['D1B1', 'D1B2', 'D2B1', 'D2B2', 'D3B1', 'D3B2'];
  const ALLOCATION_DESCRIPTIONS = {
    D1B1: '自己主導、需要長期反覆投入的大塊深度時間',
    D1B2: '自己主導、需要一次性的專注時段，做完就結束',
    D2B1: '需要與他人長期同步步調，個人時段與同步時段分開排',
    D2B2: '需要與他人安排一次討論拍板即可',
    D3B1: '常駐但輕量參與，只需定期關注進度',
    D3B2: '被動接收資訊，幾乎不需要主動排時間',
  };
  const ALLOCATION_RECURRING = { D1B1: true, D1B2: false, D2B1: true, D2B2: false, D3B1: true, D3B2: false };
  const U_ORDER = ['U1', 'U2', 'U3', 'U4'];

  function buildAxisGroups() {
    for (const axis of ['A', 'B', 'C', 'D']) {
      const key = axis.toLowerCase();
      const group = document.createElement('div');
      group.className = 'axis-group';
      group.dataset.axis = key;

      const heading = document.createElement('h3');
      heading.textContent = AXIS_TITLES[axis];
      group.appendChild(heading);

      const buttons = document.createElement('div');
      buttons.className = 'axis-buttons';

      for (const code of AXIS_ORDER[axis]) {
        const info = AXIS_LABELS[axis][code];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag-btn';
        btn.dataset.axis = key;
        btn.dataset.code = code;
        btn.title = info.desc;
        btn.innerHTML = `<span class="code">${code}</span><span class="label">${info.short}</span>`;
        btn.addEventListener('click', () => selectTag(key, code));
        buttons.appendChild(btn);
      }

      group.appendChild(buttons);
      el.axisGroups.appendChild(group);
    }
  }

  function selectTag(axisKey, code) {
    state.currentTags[axisKey] = code;
    el.axisGroups
      .querySelectorAll(`.tag-btn[data-axis="${axisKey}"]`)
      .forEach((btn) => btn.classList.toggle('selected', btn.dataset.code === code));
    updateDownstreamFieldVisibility();
    updateSuggestionPanel();
  }

  function isInv1Case() {
    return state.currentTags.a === 'A3' && state.currentTags.c === 'C1';
  }

  function updateDownstreamFieldVisibility() {
    el.downstreamField.classList.toggle('hidden', !isInv1Case());
    if (!isInv1Case()) el.downstreamDeadlineInput.value = '';
  }

  function currentTaskInput() {
    const { a, b, c, d } = state.currentTags;
    if (!a || !b || !c || !d) return null;
    const downstreamDeadline = isInv1Case() ? el.downstreamDeadlineInput.value || null : null;
    return { a, b, c, d, downstreamDeadline };
  }

  function renderStrategy(strategy) {
    if (typeof strategy === 'string') {
      return `<p class="strategy-text">${strategy}</p>`;
    }
    const rows = [];
    if ('sync' in strategy) {
      rows.push(`<p><strong>個人：</strong>${strategy.personal}</p>`);
      rows.push(`<p><strong>同步：</strong>${strategy.sync}</p>`);
    } else {
      rows.push(`<p><strong>個人：</strong>${strategy.personal}</p>`);
      rows.push(`<p><strong>關注：</strong>${strategy.watch}</p>`);
    }
    return rows.join('');
  }

  function updateSuggestionPanel() {
    const input = currentTaskInput();
    el.suggestionPanel.classList.remove('conflict');

    if (!input) {
      el.suggestionPanel.innerHTML = '<p class="suggestion-hint">選擇 A / B / C / D 四個標籤後，這裡會顯示建議策略。</p>';
      return;
    }

    const output = evaluateTask(input);
    renderOutputInto(el.suggestionPanel, output, buildTagCode(input.a, input.b, input.c, input.d));
  }

  function renderOutputInto(container, output, originalCode) {
    const hasHints = output.hints.length > 0;
    container.classList.toggle('conflict', hasHints);

    let normalizedNote = '';
    if (output.normalized) {
      const reason = output.deadline_date
        ? `已回填下游期限 ${output.deadline_date}，正規化為 A1`
        : 'INV-1：連鎖依賴不可能無期限，已降級正規化為 A2';
      normalizedNote = `<p class="normalized-note">${reason}</p>`;
    }

    const hintsHtml = hasHints
      ? `<div class="hints">${output.hints.map((h) => `<p class="hint-text">${h}</p>`).join('')}</div>`
      : '';

    container.innerHTML = `
      <p>
        <span class="suggestion-code">${originalCode}</span>
        ${output.normalized ? `<span class="arrow">→</span><span class="suggestion-code">${output.a_normalized}${output.b}${output.c}${output.d}</span>` : ''}
        <span class="badge badge-u">${U_LABELS[output.U]}</span>
        <span class="badge badge-alloc">${ALLOCATION_LABELS[output.allocation_type]}</span>
      </p>
      ${normalizedNote}
      ${renderStrategy(output.strategy)}
      ${hintsHtml}
    `;
  }

  function renderTaskList() {
    const hasTasks = state.tasks.length > 0;
    el.emptyState.classList.toggle('hidden', hasTasks);
    el.taskTable.classList.toggle('hidden', !hasTasks);
    el.taskTableBody.innerHTML = '';

    for (const task of state.tasks) {
      const output = evaluateTask(task);
      const originalCode = buildTagCode(task.a, task.b, task.c, task.d);
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = task.name;

      const tagTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'code-badge' + (output.hints.length ? ' conflict' : '');
      badge.textContent = originalCode;
      tagTd.appendChild(badge);
      if (output.normalized) {
        const arrow = document.createElement('span');
        arrow.className = 'normalized-arrow';
        arrow.textContent = ` → ${output.a_normalized}${task.b}${task.c}${task.d}`;
        tagTd.appendChild(arrow);
      }

      const uTd = document.createElement('td');
      uTd.textContent = U_LABELS[output.U];

      const strategyTd = document.createElement('td');
      strategyTd.className = 'strategy-cell';
      strategyTd.innerHTML = `<p class="alloc-label">${ALLOCATION_LABELS[output.allocation_type]}</p>${renderStrategy(output.strategy)}${
        output.hints.length ? `<div class="hints">${output.hints.map((h) => `<p class="hint-text">${h}</p>`).join('')}</div>` : ''
      }`;

      const actionsTd = document.createElement('td');
      actionsTd.className = 'row-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = '編輯';
      editBtn.addEventListener('click', () => openEditModal(task.id));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = '刪除';
      deleteBtn.addEventListener('click', () => deleteTask(task.id));
      actionsTd.append(editBtn, deleteBtn);

      tr.append(nameTd, tagTd, uTd, strategyTd, actionsTd);
      el.taskTableBody.appendChild(tr);
    }
  }

  function taskStrategyCardHtml(task, output) {
    const originalCode = buildTagCode(task.a, task.b, task.c, task.d);
    const normalizedNote = output.normalized
      ? `<p class="normalized-note">${
          output.deadline_date ? `已回填下游期限 ${output.deadline_date}，正規化為 A1` : 'INV-1：已降級正規化為 A2'
        }</p>`
      : '';
    const hintsHtml = output.hints.length
      ? `<div class="hints">${output.hints.map((h) => `<p class="hint-text">${h}</p>`).join('')}</div>`
      : '';
    return `
      <div class="overview-task-card">
        <p class="overview-task-name">${task.name} <span class="badge badge-u">${U_LABELS[output.U]}</span></p>
        <p class="overview-task-code">${originalCode}${output.normalized ? ` → ${output.a_normalized}${task.b}${task.c}${task.d}` : ''}</p>
        ${normalizedNote}
        ${renderStrategy(output.strategy)}
        ${hintsHtml}
      </div>
    `;
  }

  function renderOverview() {
    const hasTasks = state.tasks.length > 0;
    el.overviewEmptyState.classList.toggle('hidden', hasTasks);
    el.overviewContent.classList.toggle('hidden', !hasTasks);
    if (!hasTasks) return;

    const evaluated = state.tasks.map((task) => ({ task, output: evaluateTask(task) }));

    // 今日優先：U1（最高緊急層級）的任務，不分投入型態，先列出來。
    const urgent = evaluated.filter((e) => e.output.U === 'U1');
    if (urgent.length) {
      el.overviewPriority.classList.remove('hidden');
      el.overviewPriority.innerHTML = `
        <h2>🔥 最高緊急（U1）— 這些最先安排</h2>
        <div class="overview-task-grid">
          ${urgent.map((e) => taskStrategyCardHtml(e.task, e.output)).join('')}
        </div>
      `;
    } else {
      el.overviewPriority.classList.add('hidden');
      el.overviewPriority.innerHTML = '';
    }

    // 依投入型態（Allocation Type）分組：這個分組同時回答「常駐任務有哪些」
    // （-持續型／D1B1,D2B1,D3B1）與「花很多個人時間的任務有哪些」
    // （深度執行／D1B1,D1B2）。
    el.overviewGroups.innerHTML = ALLOCATION_ORDER.map((type) => {
      const members = evaluated
        .filter((e) => e.output.allocation_type === type)
        .sort((a, b) => U_ORDER.indexOf(a.output.U) - U_ORDER.indexOf(b.output.U));
      if (!members.length) return '';
      const recurringTag = ALLOCATION_RECURRING[type] ? '🔁 常駐' : '⚡ 一次性';
      return `
        <div class="overview-group">
          <h3>${ALLOCATION_LABELS[type]} <span class="badge">${type}</span> <span class="badge">${recurringTag}</span></h3>
          <p class="overview-group-desc">${ALLOCATION_DESCRIPTIONS[type]}</p>
          <div class="overview-task-grid">
            ${members.map((e) => taskStrategyCardHtml(e.task, e.output)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderTaskList();
    renderOverview();
  }

  function switchTab(tab) {
    const isTasks = tab === 'tasks';
    el.tabTasksBtn.classList.toggle('selected', isTasks);
    el.tabOverviewBtn.classList.toggle('selected', !isTasks);
    el.pageTasks.classList.toggle('hidden', !isTasks);
    el.pageOverview.classList.toggle('hidden', isTasks);
  }

  function resetAxisButtons() {
    el.axisGroups.querySelectorAll('.tag-btn').forEach((b) => b.classList.remove('selected'));
  }

  function openAddModal() {
    state.editingId = null;
    state.currentTags = { a: null, b: null, c: null, d: null };
    el.modalTitle.textContent = '新增任務';
    el.taskName.value = '';
    el.downstreamDeadlineInput.value = '';
    resetAxisButtons();
    updateDownstreamFieldVisibility();
    updateSuggestionPanel();
    el.modalOverlay.classList.remove('hidden');
    el.taskName.focus();
  }

  function openEditModal(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    state.editingId = id;
    state.currentTags = { a: task.a, b: task.b, c: task.c, d: task.d };
    el.modalTitle.textContent = '編輯任務';
    el.taskName.value = task.name;
    el.downstreamDeadlineInput.value = task.downstreamDeadline || '';
    el.axisGroups.querySelectorAll('.tag-btn').forEach((btn) => {
      btn.classList.toggle('selected', state.currentTags[btn.dataset.axis] === btn.dataset.code);
    });
    updateDownstreamFieldVisibility();
    updateSuggestionPanel();
    el.modalOverlay.classList.remove('hidden');
    el.taskName.focus();
  }

  function closeModal() {
    el.modalOverlay.classList.add('hidden');
  }

  function saveTask() {
    const name = el.taskName.value.trim();
    const input = currentTaskInput();

    if (!name) {
      alert('請輸入任務名稱。');
      return;
    }
    if (!input) {
      alert('請選擇完整的 A / B / C / D 四個標籤。');
      return;
    }

    const now = new Date().toISOString();

    if (state.editingId) {
      const task = state.tasks.find((t) => t.id === state.editingId);
      task.name = name;
      task.a = input.a;
      task.b = input.b;
      task.c = input.c;
      task.d = input.d;
      task.downstreamDeadline = input.downstreamDeadline;
      task.updatedAt = now;
    } else {
      state.tasks.push({
        id: crypto.randomUUID(),
        name,
        a: input.a,
        b: input.b,
        c: input.c,
        d: input.d,
        downstreamDeadline: input.downstreamDeadline,
        createdAt: now,
        updatedAt: now,
      });
    }

    markDirty();
    renderAll();
    closeModal();
  }

  function deleteTask(id) {
    if (!confirm('確定要刪除這個任務嗎？')) return;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    markDirty();
    renderAll();
  }

  function markDirty() {
    state.dirty = true;
    updateStorageStatus();
  }

  function updateStorageStatus() {
    const source = state.importedFileName ? `檔案：${state.importedFileName}` : '尚未匯入檔案（新任務清單）';
    const countText = `${state.tasks.length} 筆任務`;
    const dirtyText = state.dirty ? ' · 有未儲存的變更，請按「匯出」存檔' : '';
    el.storageStatusText.textContent = `${source} · ${countText}${dirtyText}`;
    el.storageStatusText.classList.toggle('dirty', state.dirty);
  }

  function handleExport() {
    exportTasksToFile(state.tasks);
    state.dirty = false;
    if (!state.importedFileName) state.importedFileName = 'tasks.json';
    updateStorageStatus();
  }

  async function handleImportFile(file) {
    if (state.dirty && !confirm('目前有未儲存的變更，匯入將會覆蓋它們，確定要繼續嗎？')) {
      return;
    }
    try {
      const tasks = await importTasksFromFile(file);
      state.tasks = tasks;
      state.importedFileName = file.name;
      state.dirty = false;
      updateStorageStatus();
      renderAll();
    } catch (err) {
      console.error(err);
      alert('匯入失敗，請確認選擇的是有效的 tasks.json。');
    }
  }

  function init() {
    buildAxisGroups();

    el.exportBtn.addEventListener('click', handleExport);
    el.importBtn.addEventListener('click', () => el.importFileInput.click());
    el.importFileInput.addEventListener('change', () => {
      const file = el.importFileInput.files[0];
      if (file) handleImportFile(file);
      el.importFileInput.value = '';
    });

    el.tabTasksBtn.addEventListener('click', () => switchTab('tasks'));
    el.tabOverviewBtn.addEventListener('click', () => switchTab('overview'));

    el.addTaskBtn.addEventListener('click', openAddModal);
    el.cancelBtn.addEventListener('click', closeModal);
    el.saveBtn.addEventListener('click', saveTask);
    el.downstreamDeadlineInput.addEventListener('input', updateSuggestionPanel);
    el.modalOverlay.addEventListener('click', (e) => {
      if (e.target === el.modalOverlay) closeModal();
    });
    window.addEventListener('beforeunload', (e) => {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    updateStorageStatus();
    renderAll();
  }

  init();
})();
