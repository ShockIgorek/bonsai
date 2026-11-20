import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';

/**
 * Открывает модалку добавления задачи в указанную папку (по имени).
 * @param {string} folderName — имя папки, куда добавляем
 * @param {function} onSaved — колбэк после сохранения
 */
export function openAddTaskModal(folderName, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">Добавить в «${folderName}»</h2>
        <button class="modal-close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <label class="input-label">Название</label>
        <input class="input-field" id="task-name" type="text" placeholder="Например: помыть посуду" />
        <label class="input-label">Описание</label>
        <textarea class="input-field" id="task-desc" rows="2" placeholder="Коротко о задаче"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn-save" id="task-save">Добавить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#task-save').addEventListener('click', () => {
    const name = modal.querySelector('#task-name').value.trim();
    const desc = modal.querySelector('#task-desc').value.trim();
    if (!name) return;

    const tree = getTasksTree();

    function addToNode(node, targetName) {
      if (node.name === targetName) {
        if (!node.children) node.children = [];
        node.children.push({ name, desc });
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

/**
 * Открывает модалку редактирования задачи.
 * @param {object} task — объект задачи (из nav.byId)
 * @param {function} onSaved — колбэк после сохранения
 */
export function openEditTaskModal(task, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">Редактировать задачу</h2>
        <button class="modal-close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <label class="input-label">Название</label>
        <input class="input-field" id="task-name" type="text" value="${task.name}" />
        <label class="input-label">Описание</label>
        <textarea class="input-field" id="task-desc" rows="2">${task.desc || ''}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn-save" id="task-save">Сохранить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#task-save').addEventListener('click', () => {
    const newName = modal.querySelector('#task-name').value.trim();
    const newDesc = modal.querySelector('#task-desc').value.trim();
    if (!newName) return;

    const tree = getTasksTree();

    function findAndUpdate(node, oldName) {
      if (node.name === oldName) {
        node.name = newName;
        node.desc = newDesc;
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

/**
 * Открывает модалку удаления задачи.
 * @param {object} task — объект задачи
 * @param {function} onSaved — колбэк после удаления
 */
export function openDeleteTaskModal(task, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
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
  document.body.appendChild(modal);

  const close = () => modal.remove();

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#task-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#task-delete').addEventListener('click', () => {
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

/**
 * Открывает модалку добавления подзадачи (превращает лист в папку).
 */
export function openAddSubtaskModal(task, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">Подзадача для «${task.name}»</h2>
        <button class="modal-close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <label class="input-label">Название</label>
        <input class="input-field" id="subtask-name" type="text" placeholder="Например: помыть пол" />
        <label class="input-label">Описание</label>
        <textarea class="input-field" id="subtask-desc" rows="2" placeholder="Коротко о задаче"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn-save" id="subtask-save">Добавить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#subtask-save').addEventListener('click', () => {
    const name = modal.querySelector('#subtask-name').value.trim();
    const desc = modal.querySelector('#subtask-desc').value.trim();
    if (!name) return;

    const tree = getTasksTree();

    function findAndConvert(node, targetName) {
      if (node.name === targetName) {
        if (!node.children) node.children = [];
        node.children.push({ name, desc });
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
