(function () {
  const state = {
    handle: null,
    tasks: [],
    editingId: null,
    currentTags: { A: null, B: null, C: null, D: null },
  };

  const el = {
    connectBtn: document.getElementById('connectBtn'),
    fileStatusText: document.getElementById('fileStatusText'),
    addTaskBtn: document.getElementById('addTaskBtn'),
    unsupportedNotice: document.getElementById('unsupportedNotice'),
    emptyState: document.getElementById('emptyState'),
    taskTable: document.getElementById('taskTable'),
    taskTableBody: document.getElementById('taskTableBody'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    taskName: document.getElementById('taskName'),
    axisGroups: document.getElementById('axisGroups'),
    suggestionPanel: document.getElementById('suggestionPanel'),
    cancelBtn: document.getElementById('cancelBtn'),
    saveBtn: document.getElementById('saveBtn'),
  };

  function buildAxisGroups() {
    const axisTitles = {
      A: 'A · 期限 (deadline)',
      B: 'B · 型態 (mode)',
      C: 'C · 依賴 (dependency)',
      D: 'D · 主導權 (ownership)',
    };

    for (const axis of ['A', 'B', 'C', 'D']) {
      const group = document.createElement('div');
      group.className = 'axis-group';
      group.dataset.axis = axis;

      const heading = document.createElement('h3');
      heading.textContent = axisTitles[axis];
      group.appendChild(heading);

      const buttons = document.createElement('div');
      buttons.className = 'axis-buttons';

      for (const code of AXIS_ORDER[axis]) {
        const info = AXIS_LABELS[axis][code];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag-btn';
        btn.dataset.axis = axis;
        btn.dataset.code = code;
        btn.title = info.desc;
        btn.innerHTML = `<span class="code">${code}</span><span class="label">${info.short}</span>`;
        btn.addEventListener('click', () => selectTag(axis, code));
        buttons.appendChild(btn);
      }

      group.appendChild(buttons);
      el.axisGroups.appendChild(group);
    }
  }

  function selectTag(axis, code) {
    state.currentTags[axis] = code;
    el.axisGroups
      .querySelectorAll(`.tag-btn[data-axis="${axis}"]`)
      .forEach((btn) => btn.classList.toggle('selected', btn.dataset.code === code));
    updateSuggestionPanel();
  }

  function updateSuggestionPanel() {
    const { A, B, C, D } = state.currentTags;
    el.suggestionPanel.classList.remove('conflict');

    if (!A || !B || !C || !D) {
      el.suggestionPanel.innerHTML = '<p class="suggestion-hint">選擇 A / B / C / D 四個標籤後，這裡會顯示建議策略。</p>';
      return;
    }

    const code = buildCode(state.currentTags);
    const combo = lookup(code);
    if (!combo) {
      el.suggestionPanel.innerHTML = `<p class="suggestion-hint">找不到組合 ${code} 的資料。</p>`;
      return;
    }

    el.suggestionPanel.classList.toggle('conflict', combo.isConflict);
    el.suggestionPanel.innerHTML = `
      <p><span class="suggestion-code">${code}</span> — ${combo.scenario}</p>
      <p>${combo.strategy}</p>
    `;
  }

  function renderTaskList() {
    const hasTasks = state.tasks.length > 0;
    el.emptyState.classList.toggle('hidden', hasTasks);
    el.taskTable.classList.toggle('hidden', !hasTasks);
    el.taskTableBody.innerHTML = '';

    for (const task of state.tasks) {
      const combo = lookup(task.code);
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = task.name;

      const codeTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'code-badge' + (combo && combo.isConflict ? ' conflict' : '');
      badge.textContent = task.code;
      codeTd.appendChild(badge);

      const strategyTd = document.createElement('td');
      strategyTd.textContent = combo ? combo.strategy : '(未知組合)';

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

      tr.append(nameTd, codeTd, strategyTd, actionsTd);
      el.taskTableBody.appendChild(tr);
    }
  }

  function openAddModal() {
    state.editingId = null;
    state.currentTags = { A: null, B: null, C: null, D: null };
    el.modalTitle.textContent = '新增任務';
    el.taskName.value = '';
    el.axisGroups.querySelectorAll('.tag-btn').forEach((b) => b.classList.remove('selected'));
    updateSuggestionPanel();
    el.modalOverlay.classList.remove('hidden');
    el.taskName.focus();
  }

  function openEditModal(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    state.editingId = id;
    state.currentTags = { ...task.tags };
    el.modalTitle.textContent = '編輯任務';
    el.taskName.value = task.name;
    el.axisGroups.querySelectorAll('.tag-btn').forEach((btn) => {
      btn.classList.toggle('selected', task.tags[btn.dataset.axis] === btn.dataset.code);
    });
    updateSuggestionPanel();
    el.modalOverlay.classList.remove('hidden');
    el.taskName.focus();
  }

  function closeModal() {
    el.modalOverlay.classList.add('hidden');
  }

  async function saveTask() {
    const name = el.taskName.value.trim();
    const { A, B, C, D } = state.currentTags;

    if (!name) {
      alert('請輸入任務名稱。');
      return;
    }
    if (!A || !B || !C || !D) {
      alert('請選擇完整的 A / B / C / D 四個標籤。');
      return;
    }

    const tags = { A, B, C, D };
    const code = buildCode(tags);
    const now = new Date().toISOString();

    if (state.editingId) {
      const task = state.tasks.find((t) => t.id === state.editingId);
      task.name = name;
      task.tags = tags;
      task.code = code;
      task.updatedAt = now;
    } else {
      state.tasks.push({
        id: crypto.randomUUID(),
        name,
        tags,
        code,
        createdAt: now,
        updatedAt: now,
      });
    }

    await persist();
    renderTaskList();
    closeModal();
  }

  async function deleteTask(id) {
    if (!confirm('確定要刪除這個任務嗎？')) return;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    await persist();
    renderTaskList();
  }

  async function persist() {
    if (!state.handle) return;
    await writeTasks(state.handle, { version: 1, tasks: state.tasks });
  }

  async function connectToFile() {
    try {
      const handle = state.handle || (await pickNewOrExistingFile());
      const granted = await verifyPermission(handle, true);
      if (!granted) {
        setFileStatus('權限被拒絕，請重新連接。', false);
        return;
      }
      state.handle = handle;
      await saveHandle(handle);
      const data = await readTasks(handle);
      state.tasks = data.tasks || [];
      setFileStatus(`已連接：${handle.name}`, true);
      renderTaskList();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      setFileStatus('連接檔案時發生錯誤。', false);
    }
  }

  function setFileStatus(text, connected, buttonLabel) {
    el.fileStatusText.textContent = text;
    el.addTaskBtn.disabled = !connected;
    el.connectBtn.textContent = buttonLabel || (connected ? '更換檔案' : '選擇 / 建立 tasks.json');
  }

  async function init() {
    if (!isFileSystemAccessSupported) {
      el.unsupportedNotice.classList.remove('hidden');
      el.connectBtn.disabled = true;
      return;
    }

    buildAxisGroups();
    el.connectBtn.addEventListener('click', connectToFile);
    el.addTaskBtn.addEventListener('click', openAddModal);
    el.cancelBtn.addEventListener('click', closeModal);
    el.saveBtn.addEventListener('click', saveTask);
    el.modalOverlay.addEventListener('click', (e) => {
      if (e.target === el.modalOverlay) closeModal();
    });

    const storedHandle = await loadHandle();
    if (storedHandle) {
      state.handle = storedHandle;
      const granted = await verifyPermission(storedHandle, false);
      if (granted) {
        const data = await readTasks(storedHandle);
        state.tasks = data.tasks || [];
        setFileStatus(`已連接：${storedHandle.name}`, true);
        renderTaskList();
        return;
      }
      setFileStatus('請點擊重新連接先前的 tasks.json', false, '重新連接 tasks.json');
      return;
    }

    setFileStatus('尚未連接檔案', false);
  }

  init();
})();
