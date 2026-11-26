import { getTasksTree } from '../data/tasks-store.js';
import { buildNavIndex } from '../store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { saveTasksTreeWithRecovery, isQuotaError } from '../utils/media-compaction.js';
import { timeToScore } from '../logic/task-metrics.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import { formatTaskDuration } from '../utils/format-time.js';

function saveErrorMessage(err, subject) {
  if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
    return 'Не хватает места для сохранения. Уменьши или удали фото.';
  }
  return `Не удалось сохранить ${subject}. Попробуй ещё раз.`;
}

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
    z-index: 2000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="task-cancel" type="button" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Добавить в «${folderName}»</h1>
      <button class="btn-save" id="task-save" type="button" style="padding: 8px 16px; font-size: 14px;">Добавить</button>
    </div>

    <div class="task-editor-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
      
      <!-- 1. Название (обязательное) -->
      <label class="input-label">Название <span style="color: var(--danger);">*</span></label>
      <input class="input-field" id="task-name" type="text" required placeholder="Например: помыть посуду" />
      <div id="name-error" style="display: none; color: var(--danger); font-size: 12px;">Название обязательно</div>

      <!-- 2. Описание отдельной модалкой -->
      <label class="input-label">Описание</label>
      <button class="input-field" id="task-desc-btn" type="button" style="text-align: left;">Добавить описание</button>
      <div id="task-desc-preview" style="display: none; font-size: 13px; color: var(--text-secondary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"></div>

      <!-- 3. Тип задачи -->
      <label class="input-label">Тип задачи <span style="color: var(--danger);">*</span></label>
      <div class="type-options">
        <label class="type-option">
          <span class="type-option-label">Одноразовая</span>
          <input type="checkbox" id="type-single" class="type-checkbox" />
          <span class="type-box" aria-hidden="true"></span>
        </label>
        <label class="type-option">
          <span class="type-option-label">Циклическая</span>
          <input type="checkbox" id="type-cyclic" class="type-checkbox" />
          <span class="type-box" aria-hidden="true"></span>
        </label>
      </div>
      <div id="type-error" style="display: none; color: var(--danger); font-size: 12px; text-align: center;">Выберите один тип задачи</div>

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

      <!-- 4. Фото -->
      <label class="input-label">Фото</label>
      <button class="input-field" id="task-image-btn" type="button" style="text-align: left;">Добавить фото</button>
      <div id="task-image-preview" style="margin-top: 8px;"></div>

      <!-- 5. Метрики: время — важность — сложность -->
      <div class="task-metrics-editor">
        <div class="task-metric-editor" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-main));">
          <div class="task-metric-label">Время</div>
          <div class="task-metric-row">
            <button type="button" id="time-minus" class="task-metric-btn">−</button>
            <span id="time-value" class="task-metric-value">20 мин</span>
            <button type="button" id="time-plus" class="task-metric-btn">+</button>
          </div>
        </div>

        <div class="task-metric-editor" style="color: var(--accent);">
          <div class="task-metric-label">Важность</div>
          <div class="task-metric-row">
            <button type="button" id="priority-minus" class="task-metric-btn">−</button>
            <span id="priority-value" class="task-metric-value">5.0</span>
            <button type="button" id="priority-plus" class="task-metric-btn">+</button>
          </div>
        </div>

        <div class="task-metric-editor" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">
          <div class="task-metric-label">Сложность</div>
          <div class="task-metric-row">
            <button type="button" id="difficulty-minus" class="task-metric-btn">−</button>
            <span id="difficulty-value" class="task-metric-value">5.0</span>
            <button type="button" id="difficulty-plus" class="task-metric-btn">+</button>
          </div>
        </div>
      </div>
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
  const difficultyDisplay = screen.querySelector('#difficulty-value');
  const timeDisplay = screen.querySelector('#time-value');
  let priorityValue = 5.0;
  let difficultyValue = 5.0;
  let timeMinutes = 20;

  // Описание — отдельной модалкой, без textarea в форме
  let descriptionValue = '';
  const descBtn = screen.querySelector('#task-desc-btn');
  const descPreview = screen.querySelector('#task-desc-preview');

  function refreshDescriptionUI() {
    descBtn.textContent = descriptionValue ? 'Редактировать описание' : 'Добавить описание';
    descPreview.textContent = descriptionValue;
    descPreview.style.display = descriptionValue ? '-webkit-box' : 'none';
  }

  descBtn.addEventListener('click', () => {
    import('./description-modal.js').then(({ openDescriptionModal }) => {
      openDescriptionModal(descriptionValue, (value) => {
        descriptionValue = value;
        refreshDescriptionUI();
      });
    });
  });
  refreshDescriptionUI();

  // Фото: камера / галерея / ссылка через общий пикер
  let currentImageData = '';
  const imgBtn = screen.querySelector('#task-image-btn');
  const imgPreview = screen.querySelector('#task-image-preview');

  function updateImgPreview(src) {
    imgPreview.innerHTML = src
      ? `<img src="${src}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border);" onerror="this.style.display='none'" />`
      : '';
  }

  function refreshImageButton() {
    imgBtn.textContent = currentImageData ? 'Заменить фото' : 'Добавить фото';
  }

  imgBtn.addEventListener('click', () => {
    import('./image-picker.js').then(({ openImagePicker }) => {
      openImagePicker(currentImageData, (src) => {
        currentImageData = src || '';
        updateImgPreview(currentImageData);
        refreshImageButton();
      });
    });
  });

  // Время: 20 мин по умолчанию, шаг зависит от величины
  function formatFormTime(minutes) {
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }

  function getTimeStep(value) {
    if (value < 10) return 1;
    if (value <= 60) return 5;
    return 10;
  }

  function refreshTime() {
    timeDisplay.textContent = formatFormTime(timeMinutes);
    applyMetricStyle(timeDisplay, timeToScore(timeMinutes));
  }

  timeDisplay.textContent = formatFormTime(timeMinutes);
  applyMetricStyle(timeDisplay, timeToScore(timeMinutes));

  screen.querySelector('#time-minus').addEventListener('click', () => {
    timeMinutes = Math.max(1, timeMinutes - getTimeStep(timeMinutes));
    refreshTime();
  });
  screen.querySelector('#time-plus').addEventListener('click', () => {
    timeMinutes = Math.min(7 * 24 * 60, timeMinutes + getTimeStep(timeMinutes));
    refreshTime();
  });

  function refreshPriority() {
    priorityDisplay.textContent = priorityValue.toFixed(1);
    applyMetricStyle(priorityDisplay, priorityValue);
  }

  function refreshDifficulty() {
    difficultyDisplay.textContent = difficultyValue.toFixed(1);
    applyMetricStyle(difficultyDisplay, difficultyValue);
  }

  screen.querySelector('#priority-minus').addEventListener('click', () => {
    priorityValue = Math.max(0, priorityValue - 0.5);
    refreshPriority();
  });
  screen.querySelector('#priority-plus').addEventListener('click', () => {
    priorityValue = Math.min(10, priorityValue + 0.5);
    refreshPriority();
  });

  screen.querySelector('#difficulty-minus').addEventListener('click', () => {
    difficultyValue = Math.max(0, difficultyValue - 0.5);
    refreshDifficulty();
  });
  screen.querySelector('#difficulty-plus').addEventListener('click', () => {
    difficultyValue = Math.min(10, difficultyValue + 0.5);
    refreshDifficulty();
  });

  refreshPriority();
  refreshDifficulty();

  // Чекбоксы (взаимоисключающие)
  typeSingle.addEventListener('change', () => {
    if (typeSingle.checked) {
      typeCyclic.checked = false;
      cyclicFields.style.display = 'none';
      singleFields.style.display = 'flex';
    } else {
      singleFields.style.display = 'none';
    }
    typeError.style.display = 'none';
  });

  typeCyclic.addEventListener('change', () => {
    if (typeCyclic.checked) {
      typeSingle.checked = false;
      cyclicFields.style.display = 'flex';
      singleFields.style.display = 'none';
    } else {
      cyclicFields.style.display = 'none';
    }
    typeError.style.display = 'none';
  });

  // Отмена
  screen.querySelector('#task-cancel').addEventListener('click', close);

  // Сохранение: click + touchend, чтобы на телефоне нажатие не терялось
  const saveBtn = screen.querySelector('#task-save');
  let saving = false;

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (saving) return;
    document.activeElement?.blur?.();

    const name = nameInput.value.trim();
    const desc = descriptionValue;

    // Валидация
    let hasError = false;
    if (!name) {
      nameInput.style.borderColor = 'var(--danger)';
      nameError.style.display = 'block';
      hasError = true;
    } else {
      nameInput.style.borderColor = '';
      nameError.style.display = 'none';
    }

    const isSingle = typeSingle.checked;
    const isCyclic = typeCyclic.checked;
    const type = isSingle && !isCyclic ? 'single' : (isCyclic && !isSingle ? 'cyclic' : null);
    if (!type) {
      typeError.style.display = 'block';
      hasError = true;
    } else {
      typeError.style.display = 'none';
    }

    if (hasError) return;

    saving = true;

    try {
      const priority = priorityValue;

      const intervalDays = parseInt(screen.querySelector('#task-interval-days').value) || 0;
      const intervalHours = parseInt(screen.querySelector('#task-interval-hours').value) || 0;
      const intervalMinutes = parseInt(screen.querySelector('#task-interval-minutes').value) || 0;
      const intervalTotalMinutes = intervalDays * 24 * 60 + intervalHours * 60 + intervalMinutes;

      const taskData = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name, desc, type, priority,
        difficulty: difficultyValue,
        timeScore: timeToScore(timeMinutes),
        image: currentImageData,
        duration: { estimated: timeMinutes, actual: null },
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
      await saveTasksTreeWithRecovery(tree);
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      saving = false;
      console.error('Не удалось сохранить задачу', err);
      alert(saveErrorMessage(err, 'задачу'));
    }
  }

  saveBtn.addEventListener('click', handleSave);
  saveBtn.addEventListener('touchend', handleSave, { passive: false });
}

export function openEditTaskModal(task, onSaved) {
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const nav = buildNavIndex(getTasksTree());
  const effectivePriority = createPriorityResolver(nav, activeMoodId).resolve(task.id);
  const priorityHint = task.isLeaf
    ? 'Приоритет существующей задачи меняется через сравнение в Тиндере.'
    : 'Приоритет папки считается как среднее по её подзадачам.';

  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="task-cancel" type="button" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Редактировать</h1>
      <button class="btn-save" id="task-save" type="button" style="padding: 8px 16px; font-size: 14px;">Сохранить</button>
    </div>

    <div class="task-editor-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
      
      <label class="input-label">Название <span style="color: var(--danger);">*</span></label>
      <input class="input-field" id="task-name" type="text" required value="${task.name}" />
      <div id="name-error" style="display: none; color: var(--danger); font-size: 12px;">Название обязательно</div>

      <label class="input-label">Описание</label>
      <button class="input-field" id="task-desc-btn" type="button" style="text-align: left;">
        ${task.desc ? 'Редактировать описание' : 'Добавить описание'}
      </button>
      <div id="task-desc-preview" style="font-size: 13px; color: var(--text-secondary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${task.desc || ''}</div>

      <!-- Тип задачи -->
      <label class="input-label">Тип задачи <span style="color: var(--danger);">*</span></label>
      <div class="type-options">
        <label class="type-option">
          <span class="type-option-label">Одноразовая</span>
          <input type="checkbox" id="type-single" class="type-checkbox" ${task.type === 'single' ? 'checked' : ''} />
          <span class="type-box" aria-hidden="true"></span>
        </label>
        <label class="type-option">
          <span class="type-option-label">Циклическая</span>
          <input type="checkbox" id="type-cyclic" class="type-checkbox" ${task.type === 'cyclic' ? 'checked' : ''} />
          <span class="type-box" aria-hidden="true"></span>
        </label>
      </div>
      <div id="type-error" style="display: none; color: var(--danger); font-size: 12px; text-align: center;">Выберите один тип задачи</div>

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

      <!-- Фото -->
      <label class="input-label">Фото</label>
      <button class="input-field" id="task-image-btn" type="button" style="text-align: left;">
        ${task.image ? 'Заменить фото' : 'Добавить фото'}
      </button>
      <div id="task-image-preview" style="margin-top: 8px;">
        ${task.image ? `<img src="${task.image}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" onerror="this.style.display='none'" />` : ''}
      </div>

      <!-- Метрики: время — важность — сложность (только просмотр) -->
      <div class="task-metrics-editor">
        <div class="task-metric-editor" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-main));">
          <div class="task-metric-label">Время</div>
          <div class="task-metric-row task-metric-readonly">
            <span id="edit-time-value" class="task-metric-value">${formatTaskDuration(task.duration)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">Меняется замерами времени и тестированием.</div>
        </div>

        <div class="task-metric-editor" style="color: var(--accent);">
          <div class="task-metric-label">Важность</div>
          <div class="task-metric-row task-metric-readonly">
            <span id="edit-priority-value" class="task-metric-value">${effectivePriority.toFixed(1)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${priorityHint}</div>
        </div>

        <div class="task-metric-editor" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">
          <div class="task-metric-label">Сложность</div>
          <div class="task-metric-row task-metric-readonly">
            <span id="edit-difficulty-value" class="task-metric-value">${(task.difficulty !== undefined ? task.difficulty : 5.0).toFixed(1)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">Меняется при выполнении задачи и в тестировании.</div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  // Описание
  let descriptionValue = task.desc || '';
  const descBtn = screen.querySelector('#task-desc-btn');
  const descPreview = screen.querySelector('#task-desc-preview');

  function refreshDescriptionUI() {
    descBtn.textContent = descriptionValue ? 'Редактировать описание' : 'Добавить описание';
    descPreview.textContent = descriptionValue;
    descPreview.style.display = descriptionValue ? '-webkit-box' : 'none';
  }

  descBtn.addEventListener('click', () => {
    import('./description-modal.js').then(({ openDescriptionModal }) => {
      openDescriptionModal(descriptionValue, (value) => {
        descriptionValue = value;
        refreshDescriptionUI();
      });
    });
  });
  refreshDescriptionUI();

  // Метрики только для просмотра, стиль как в Тиндере
  applyMetricStyle(screen.querySelector('#edit-time-value'), task.timeScore);
  applyMetricStyle(screen.querySelector('#edit-priority-value'), effectivePriority);
  applyMetricStyle(screen.querySelector('#edit-difficulty-value'), task.difficulty);

  // Фото: камера / галерея / ссылка через общий пикер
  let currentImageData = task.image || '';
  const imgBtn = screen.querySelector('#task-image-btn');
  const imgPreview = screen.querySelector('#task-image-preview');

  function updateImgPreview(src) {
    imgPreview.innerHTML = src
      ? `<img src="${src}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border);" onerror="this.style.display='none'" />`
      : '';
  }

  function refreshImageButton() {
    imgBtn.textContent = currentImageData ? 'Заменить фото' : 'Добавить фото';
  }

  imgBtn.addEventListener('click', () => {
    import('./image-picker.js').then(({ openImagePicker }) => {
      openImagePicker(currentImageData, (src) => {
        currentImageData = src || '';
        updateImgPreview(currentImageData);
        refreshImageButton();
      });
    });
  });

  // Тип
  const typeSingle = screen.querySelector('#type-single');
  const typeCyclic = screen.querySelector('#type-cyclic');
  const typeError = screen.querySelector('#type-error');
  const cyclicFields = screen.querySelector('#task-cyclic-fields');
  const singleFields = screen.querySelector('#task-single-fields');

  typeSingle.addEventListener('change', () => {
    if (typeSingle.checked) {
      typeCyclic.checked = false;
      cyclicFields.style.display = 'none';
      singleFields.style.display = 'flex';
    } else {
      singleFields.style.display = 'none';
    }
    typeError.style.display = 'none';
  });

  typeCyclic.addEventListener('change', () => {
    if (typeCyclic.checked) {
      typeSingle.checked = false;
      cyclicFields.style.display = 'flex';
      singleFields.style.display = 'none';
    } else {
      cyclicFields.style.display = 'none';
    }
    typeError.style.display = 'none';
  });

  // Сохранение
  screen.querySelector('#task-cancel').addEventListener('click', close);
  const saveBtn = screen.querySelector('#task-save');
  let saving = false;

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (saving) return;
    document.activeElement?.blur?.();

    const nameInput = screen.querySelector('#task-name');
    const nameError = screen.querySelector('#name-error');
    const name = nameInput.value.trim();
    const desc = descriptionValue;

    if (!name) {
      nameInput.style.borderColor = 'var(--danger)';
      nameError.style.display = 'block';
      return;
    }
    nameInput.style.borderColor = '';
    nameError.style.display = 'none';

    const isSingle = typeSingle.checked;
    const isCyclic = typeCyclic.checked;
    const type = isSingle && !isCyclic ? 'single' : (isCyclic && !isSingle ? 'cyclic' : null);
    if (!type) {
      typeError.style.display = 'block';
      return;
    }
    typeError.style.display = 'none';

    saving = true;

    try {
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
      await saveTasksTreeWithRecovery(tree);
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      saving = false;
      console.error('Не удалось сохранить задачу', err);
      alert(saveErrorMessage(err, 'задачу'));
    }
  }

  saveBtn.addEventListener('click', handleSave);
  saveBtn.addEventListener('touchend', handleSave, { passive: false });
}

export function openDeleteTaskModal(task, onSaved) {
  const screen = document.createElement('div');
  screen.className = 'task-editor-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 2000;
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
        <button class="btn-save" id="task-cancel" type="button" style="background: var(--bg-panel); color: var(--text-main); flex: 1;">Отмена</button>
        <button class="btn-save" id="task-delete" type="button" style="background: #e5484d; color: white; flex: 1;">Удалить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  screen.querySelector('.modal-close').addEventListener('click', close);
  screen.querySelector('#task-cancel').addEventListener('click', close);
  screen.addEventListener('click', (e) => { if (e.target === screen) close(); });

  screen.querySelector('#task-delete').addEventListener('click', async () => {
    const tree = getTasksTree();
    const targetId = task.id;
    const targetName = task.name;

    function removeFromNode(node) {
      if (node.children) {
        const idx = node.children.findIndex(c =>
          targetId ? c.id === targetId : c.name === targetName
        );
        if (idx !== -1) {
          node.children.splice(idx, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeFromNode(child)) return true;
        }
      }
      return false;
    }

    removeFromNode(tree);

    try {
      await saveTasksTreeWithRecovery(tree);
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      console.error('Не удалось удалить задачу', err);
      alert(isQuotaError(err)
        ? 'Не хватает места для сохранения. Уменьши или удали фото.'
        : 'Не удалось удалить задачу. Попробуй ещё раз.');
    }
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
    z-index: 2000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;
  screen.innerHTML = `
    <div class="task-editor-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="subtask-cancel" type="button" aria-label="Назад">←</button>
      <h1 class="task-editor-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Подзадача для «${task.name}»</h1>
      <button class="btn-save" id="subtask-save" type="button" style="padding: 8px 16px; font-size: 14px;">Добавить</button>
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

  const saveBtn = screen.querySelector('#subtask-save');
  let saving = false;

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (saving) return;
    document.activeElement?.blur?.();

    const name = screen.querySelector('#subtask-name').value.trim();
    const desc = screen.querySelector('#subtask-desc').value.trim();
    if (!name) return;

    saving = true;

    try {
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
            difficulty: 5,
            timeScore: timeToScore(30),
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
      await saveTasksTreeWithRecovery(tree);
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      saving = false;
      console.error('Не удалось сохранить подзадачу', err);
      alert(saveErrorMessage(err, 'подзадачу'));
    }
  }

  saveBtn.addEventListener('click', handleSave);
  saveBtn.addEventListener('touchend', handleSave, { passive: false });
}
