import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';

/**
 * Открывает модалку добавления задачи в указанную папку (по имени).
 * @param {string} folderName — имя папки, куда добавляем
 * @param {function} onSaved — колбэк после сохранения
 */
export function openAddTaskModal(folderName, onSaved) {
  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="task-cancel" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Добавить в «${folderName}»</h1>
      <button class="btn-save" id="task-save" style="padding: 8px 16px; font-size: 14px;">Добавить</button>
    </div>

    <div class="task-editor-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
      
      <!-- Название (обязательное) -->
      <label class="input-label">Название <span style="color: #e5484d;">*</span></label>
      <input class="input-field" id="task-name" type="text" placeholder="Например: помыть посуду" />
      <div id="name-error" style="display: none; color: #e5484d; font-size: 12px;">Название обязательно</div>

      <label class="input-label">Описание</label>
      <textarea class="input-field" id="task-desc" rows="2" placeholder="Коротко о задаче"></textarea>

      <!-- Тип задачи (крупные чекбоксы) -->
      <label class="input-label">Тип задачи <span style="color: #e5484d;">*</span></label>
      <div style="display: flex; gap: 24px;">
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 16px; color: var(--text-main);">
          <input type="checkbox" id="type-single" style="width: 24px; height: 24px; cursor: pointer;" />
          Одноразовая
        </label>
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 16px; color: var(--text-main);">
          <input type="checkbox" id="type-cyclic" style="width: 24px; height: 24px; cursor: pointer;" />
          Циклическая
        </label>
      </div>
      <div id="type-error" style="display: none; color: #e5484d; font-size: 12px;">Выберите тип задачи</div>

      <!-- Картинка -->
      <label class="input-label">Картинка (URL или файл)</label>
      <input class="input-field" id="task-image-url" type="text" placeholder="https://... или /assets/..." />
      <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
        <span style="font-size: 12px; color: var(--text-secondary);">или</span>
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
      </div>
      <input type="file" id="task-image-file" accept="image/*" capture="environment" hidden />
      <button class="input-field" id="task-image-btn" type="button" style="text-align: left;">Загрузить фото или сделать снимок</button>
      <div id="task-image-preview" style="margin-top: 8px;"></div>

      <!-- Тип задачи (крупные чекбоксы) -->
      

      <!-- Поля для циклической -->
      <div id="task-cyclic-fields" style="display: none; flex-direction: column; gap: 8px;">
        <label class="input-label">Интервал</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input class="input-field" id="task-interval-days" type="number" value="1" min="0" style="flex: 1; text-align: center;" placeholder="0" />
          <span style="color: var(--text-secondary); font-size: 13px;">дн.</span>
          <input class="input-field" id="task-interval-hours" type="number" value="0" min="0" max="23" style="flex: 1; text-align: center;" placeholder="0" />
          <span style="color: var(--text-secondary); font-size: 13px;">ч.</span>
          <input class="input-field" id="task-interval-minutes" type="number" value="0" min="0" max="59" style="flex: 1; text-align: center;" placeholder="0" />
          <span style="color: var(--text-secondary); font-size: 13px;">мин.</span>
        </div>
      </div>

      <!-- Поля для одноразовой -->
      <div id="task-single-fields" style="display: none; flex-direction: column; gap: 8px;">
        <label class="input-label">Дедлайн (опционально)</label>
        <input class="input-field" id="task-deadline" type="date" />
      </div>

      <!-- Приоритет (по центру) -->
      <label class="input-label" style="text-align: center;">Приоритет (0.0 – 10.0)</label>
      <div style="display: flex; align-items: center; justify-content: center; gap: 24px;">
        <button type="button" id="priority-minus" style="background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-main); width: 48px; height: 48px; border-radius: 12px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">−</button>
        <span id="priority-value" style="font-size: 24px; font-weight: 800; color: var(--text-main); min-width: 60px; text-align: center;">5.0</span>
        <button type="button" id="priority-plus" style="background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-main); width: 48px; height: 48px; border-radius: 12px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
      </div>

      <label class="input-label">Время выполнения (в минутах, оценка)</label>
      <input class="input-field" id="task-duration" type="number" value="30" min="0" step="5" placeholder="Сколько времени займёт?" />
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  // Элементы
  const nameInput = screen.querySelector('#task-name');
  const nameError = screen.querySelector('#name-error');
  const typeSingle = screen.querySelector('#type-single');
  const typeCyclic = screen.querySelector('#type-cyclic');
  const typeError = screen.querySelector('#type-error');
  const cyclicFields = screen.querySelector('#task-cyclic-fields');
  const singleFields = screen.querySelector('#task-single-fields');
  const priorityDisplay = screen.querySelector('#priority-value');
  let priorityValue = 5.0;

  // Логика картинки
  let currentImageData = '';
  const imgUrlInput = screen.querySelector('#task-image-url');
  const imgFileInput = screen.querySelector('#task-image-file');
  const imgBtn = screen.querySelector('#task-image-btn');
  const imgPreview = screen.querySelector('#task-image-preview');

  function updateImgPreview(src) {
    imgPreview.innerHTML = src
      ? `<img src="${src}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border);" onerror="this.style.display='none'" />`
      : '';
  }

  imgUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    currentImageData = url;
    updateImgPreview(url);
  });

  imgBtn.addEventListener('click', () => imgFileInput.click());

  imgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImageData = event.target.result;
      updateImgPreview(currentImageData);
      imgUrlInput.value = '';
    };
    reader.readAsDataURL(file);
  });

  // Приоритет
  screen.querySelector('#priority-minus').addEventListener('click', () => {
    if (priorityValue > 0) { priorityValue = Math.max(0, priorityValue - 0.5); priorityDisplay.textContent = priorityValue.toFixed(1); }
  });
  screen.querySelector('#priority-plus').addEventListener('click', () => {
    if (priorityValue < 10) { priorityValue = Math.min(10, priorityValue + 0.5); priorityDisplay.textContent = priorityValue.toFixed(1); }
  });

  // Чекбоксы (взаимоисключающие)
  typeSingle.addEventListener('change', () => {
    if (typeSingle.checked) {
      typeCyclic.checked = false;
      cyclicFields.style.display = 'none';
      singleFields.style.display = 'flex';
      typeError.style.display = 'none';
    } else {
      singleFields.style.display = 'none';
    }
  });

  typeCyclic.addEventListener('change', () => {
    if (typeCyclic.checked) {
      typeSingle.checked = false;
      cyclicFields.style.display = 'flex';
      singleFields.style.display = 'none';
      typeError.style.display = 'none';
    } else {
      cyclicFields.style.display = 'none';
    }
  });

  // Отмена
  screen.querySelector('#task-cancel').addEventListener('click', close);

  // Сохранение
  screen.querySelector('#task-save').addEventListener('click', () => {
    const name = nameInput.value.trim();
    const desc = screen.querySelector('#task-desc').value.trim();

    // Валидация
    let hasError = false;
    if (!name) {
      nameInput.style.borderColor = '#e5484d';
      nameError.style.display = 'block';
      hasError = true;
    } else {
      nameInput.style.borderColor = '';
      nameError.style.display = 'none';
    }

    const type = typeSingle.checked ? 'single' : (typeCyclic.checked ? 'cyclic' : null);
    if (!type) {
      typeError.style.display = 'block';
      hasError = true;
    } else {
      typeError.style.display = 'none';
    }

    if (hasError) return;

    const priority = priorityValue;
    const durationEst = parseInt(screen.querySelector('#task-duration').value) || 30;

    const intervalDays = parseInt(screen.querySelector('#task-interval-days').value) || 0;
    const intervalHours = parseInt(screen.querySelector('#task-interval-hours').value) || 0;
    const intervalMinutes = parseInt(screen.querySelector('#task-interval-minutes').value) || 0;
    const intervalTotalMinutes = intervalDays * 24 * 60 + intervalHours * 60 + intervalMinutes;

    const taskData = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name, desc, type, priority,
      image: currentImageData,
      duration: { estimated: durationEst, actual: null },
      ...(type === 'cyclic' ? { interval: { totalMinutes: intervalTotalMinutes } } : { deadline: screen.querySelector('#task-deadline').value || null })
    };

    const tree = getTasksTree();
    function addToNode(node, targetName) {
      if (node.name === targetName) {
        if (!node.children) node.children = [];
        node.children.push(taskData);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addToNode(child, targetName)) return true;
        }
      }
      return false;
    }
    addToNode(tree, folderName);
    saveTasksTree(tree);
    close();
    if (typeof onSaved === 'function') onSaved();
  });
}

export function openEditTaskModal(task, onSaved) {
  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="task-cancel" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Редактировать</h1>
      <button class="btn-save" id="task-save" style="padding: 8px 16px; font-size: 14px;">Сохранить</button>
    </div>

    <div class="task-editor-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
      
      <label class="input-label">Название</label>
      <input class="input-field" id="task-name" type="text" value="${task.name}" />

      <label class="input-label">Описание</label>
      <textarea class="input-field" id="task-desc" rows="2">${task.desc || ''}</textarea>

      <!-- Картинка -->
      <label class="input-label">Картинка (URL или файл)</label>
      <input class="input-field" id="task-image-url" type="text" value="${task.image && task.image.startsWith('http') ? task.image : ''}" placeholder="https://..." />
      <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
        <span style="font-size: 12px; color: var(--text-secondary);">или</span>
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
      </div>
      <input type="file" id="task-image-file" accept="image/*" hidden />
      <button class="input-field" id="task-image-btn" type="button" style="text-align: left;">
        ${task.image && !task.image.startsWith('http') ? 'Заменить фото' : 'Загрузить фото'}
      </button>
      <div id="task-image-preview" style="margin-top: 8px;">
        ${task.image ? `<img src="${task.image}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" />` : ''}
      </div>

      <!-- Тип задачи -->
      <label class="input-label">Тип задачи</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: var(--text-main);">
          <input type="checkbox" id="type-single" style="width: 18px; height: 18px; cursor: pointer;" ${task.type === 'single' ? 'checked' : ''} />
          Одноразовая
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: var(--text-main);">
          <input type="checkbox" id="type-cyclic" style="width: 18px; height: 18px; cursor: pointer;" ${task.type === 'cyclic' ? 'checked' : ''} />
          Циклическая
        </label>
      </div>

      <!-- Поля для циклической -->
      <div id="task-cyclic-fields" style="display: ${task.type === 'cyclic' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
        <label class="input-label">Интервал</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input class="input-field" id="task-interval-days" type="number" value="${task.interval && task.interval.totalMinutes ? Math.floor(task.interval.totalMinutes / 1440) : 1}" min="0" style="flex: 1; text-align: center;" />
          <span style="color: var(--text-secondary); font-size: 13px;">дн.</span>
          <input class="input-field" id="task-interval-hours" type="number" value="${task.interval && task.interval.totalMinutes ? Math.floor((task.interval.totalMinutes % 1440) / 60) : 0}" min="0" max="23" style="flex: 1; text-align: center;" />
          <span style="color: var(--text-secondary); font-size: 13px;">ч.</span>
          <input class="input-field" id="task-interval-minutes" type="number" value="${task.interval && task.interval.totalMinutes ? task.interval.totalMinutes % 60 : 0}" min="0" max="59" style="flex: 1; text-align: center;" />
          <span style="color: var(--text-secondary); font-size: 13px;">мин.</span>
        </div>
      </div>

      <!-- Поля для одноразовой -->
      <div id="task-single-fields" style="display: ${task.type === 'single' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
        <label class="input-label">Дедлайн (опционально)</label>
        <input class="input-field" id="task-deadline" type="date" value="${task.deadline || ''}" />
      </div>

      <!-- Приоритет -->
      <label class="input-label" style="text-align: center;">Приоритет (0.0 – 10.0)</label>
      <div style="display: flex; align-items: center; justify-content: center; gap: 24px;">
        <button type="button" id="priority-minus" style="background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-main); width: 48px; height: 48px; border-radius: 12px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">−</button>
        <span id="priority-value" style="font-size: 24px; font-weight: 800; color: var(--text-main); min-width: 60px; text-align: center;">${task.priority !== undefined ? task.priority.toFixed(1) : '5.0'}</span>
        <button type="button" id="priority-plus" style="background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-main); width: 48px; height: 48px; border-radius: 12px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
      </div>

      <label class="input-label">Время выполнения (в минутах, оценка)</label>
      <input class="input-field" id="task-duration" type="number" value="${task.duration && task.duration.estimated ? task.duration.estimated : 30}" min="0" step="5" />
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  // Картинка
  let currentImageData = task.image || '';
  const imgUrlInput = screen.querySelector('#task-image-url');
  const imgFileInput = screen.querySelector('#task-image-file');
  const imgBtn = screen.querySelector('#task-image-btn');
  const imgPreview = screen.querySelector('#task-image-preview');

  function updateImgPreview(src) {
    imgPreview.innerHTML = src
      ? `<img src="${src}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border);" />`
      : '';
  }

  imgUrlInput.addEventListener('input', (e) => {
    currentImageData = e.target.value.trim();
    updateImgPreview(currentImageData);
  });

  imgBtn.addEventListener('click', () => imgFileInput.click());

  imgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImageData = event.target.result;
      updateImgPreview(currentImageData);
      imgUrlInput.value = '';
    };
    reader.readAsDataURL(file);
  });

  // Тип
  const typeSingle = screen.querySelector('#type-single');
  const typeCyclic = screen.querySelector('#type-cyclic');
  const cyclicFields = screen.querySelector('#task-cyclic-fields');
  const singleFields = screen.querySelector('#task-single-fields');

  typeSingle.addEventListener('change', () => {
    if (typeSingle.checked) {
      typeCyclic.checked = false;
      cyclicFields.style.display = 'none';
      singleFields.style.display = 'flex';
    }
  });

  typeCyclic.addEventListener('change', () => {
    if (typeCyclic.checked) {
      typeSingle.checked = false;
      cyclicFields.style.display = 'flex';
      singleFields.style.display = 'none';
    }
  });

  // Приоритет
  let priorityValue = task.priority !== undefined ? task.priority : 5.0;
  const priorityDisplay = screen.querySelector('#priority-value');
  screen.querySelector('#priority-minus').addEventListener('click', () => {
    if (priorityValue > 0) { priorityValue = Math.max(0, priorityValue - 0.5); priorityDisplay.textContent = priorityValue.toFixed(1); }
  });
  screen.querySelector('#priority-plus').addEventListener('click', () => {
    if (priorityValue < 10) { priorityValue = Math.min(10, priorityValue + 0.5); priorityDisplay.textContent = priorityValue.toFixed(1); }
  });

  // Сохранение
  screen.querySelector('#task-cancel').addEventListener('click', close);
  screen.querySelector('#task-save').addEventListener('click', () => {
    const name = screen.querySelector('#task-name').value.trim();
    const desc = screen.querySelector('#task-desc').value.trim();
    if (!name) return;

    const type = typeSingle.checked ? 'single' : (typeCyclic.checked ? 'cyclic' : 'single');
    const priority = priorityValue;
    const durationEst = parseInt(screen.querySelector('#task-duration').value) || 30;

    const intervalDays = parseInt(screen.querySelector('#task-interval-days').value) || 0;
    const intervalHours = parseInt(screen.querySelector('#task-interval-hours').value) || 0;
    const intervalMinutes = parseInt(screen.querySelector('#task-interval-minutes').value) || 0;
    const intervalTotalMinutes = intervalDays * 24 * 60 + intervalHours * 60 + intervalMinutes;

    const tree = getTasksTree();
    function findAndUpdate(node, oldName) {
      if (node.name === oldName) {
        node.name = name;
        node.desc = desc;
        node.image = currentImageData;
        node.type = type;
        node.priority = priority;
        node.duration = { estimated: durationEst, actual: node.duration ? node.duration.actual : null };
        if (type === 'cyclic') {
          node.interval = { totalMinutes: intervalTotalMinutes };
          delete node.deadline;
        } else {
          node.deadline = screen.querySelector('#task-deadline').value || null;
          delete node.interval;
        }
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndUpdate(child, oldName)) return true;
        }
      }
      return false;
    }

    findAndUpdate(tree, task.name);
    saveTasksTree(tree);
    close();
    if (typeof onSaved === 'function') onSaved();
  });
}

export function openDeleteTaskModal(task, onSaved) {
  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
  `;
  screen.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="max-width: 90vw; width: 400px; box-sizing: border-box; margin: 16px;">
      <div class="modal-header">
        <h2 class="modal-title">Удалить задачу?</h2>
        <button class="modal-close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-main); font-size: 15px;">
          Ты уверен, что хочешь удалить <strong>«${task.name}»</strong>?
          ${task.isLeaf ? '' : '<br/><span style="color: #e5484d; font-size: 13px;">Вместе с ней удалятся все вложенные задачи!</span>'}
        </p>
      </div>
      <div class="modal-footer" style="display: flex; gap: 8px; justify-content: space-between;">
        <button class="btn-save" id="task-cancel" style="background: var(--bg-panel); color: var(--text-main); flex: 1;">Отмена</button>
        <button class="btn-save" id="task-delete" style="background: #e5484d; color: white; flex: 1;">Удалить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  screen.querySelector('.modal-close').addEventListener('click', close);
  screen.querySelector('#task-cancel').addEventListener('click', close);
  screen.addEventListener('click', (e) => { if (e.target === screen) close(); });

  screen.querySelector('#task-delete').addEventListener('click', () => {
    const tree = getTasksTree();

    function removeFromNode(node, targetName) {
      if (node.children) {
        const idx = node.children.findIndex(c => c.name === targetName);
        if (idx !== -1) {
          node.children.splice(idx, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeFromNode(child, targetName)) return true;
        }
      }
      return false;
    }

    removeFromNode(tree, task.name);
    saveTasksTree(tree);
    close();
    if (typeof onSaved === 'function') onSaved();
  });
}

export function openAddSubtaskModal(task, onSaved) {
  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="subtask-cancel" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Подзадача для «${task.name}»</h1>
      <button class="btn-save" id="subtask-save" style="padding: 8px 16px; font-size: 14px;">Добавить</button>
    </div>

    <div class="task-editor-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
      <label class="input-label">Название</label>
      <input class="input-field" id="subtask-name" type="text" placeholder="Например: помыть пол" />
      <label class="input-label">Описание</label>
      <textarea class="input-field" id="subtask-desc" rows="2" placeholder="Коротко о задаче"></textarea>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  screen.querySelector('#subtask-cancel').addEventListener('click', close);

  screen.querySelector('#subtask-save').addEventListener('click', () => {
    const name = screen.querySelector('#subtask-name').value.trim();
    const desc = screen.querySelector('#subtask-desc').value.trim();
    if (!name) return;

    const tree = getTasksTree();

    function findAndConvert(node, targetName) {
      if (node.name === targetName) {
        if (!node.children) node.children = [];
        node.children.push({
          id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name,
          desc,
          type: 'single',
          priority: 5,
          image: '',
          duration: { estimated: 30, actual: null },
          deadline: null
        });
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndConvert(child, targetName)) return true;
        }
      }
      return false;
    }

    findAndConvert(tree, task.name);
    saveTasksTree(tree);
    close();
    if (typeof onSaved === 'function') onSaved();
  });
}
