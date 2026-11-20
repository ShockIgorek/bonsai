import { updateMood, addMood } from '../data/moods-store.js';

/**
 * Открывает полноэкранный редактор настроения.
 * @param {object|null} mood — если null, создаём новое
 * @param {function} onSaved — колбэк после сохранения/удаления
 */
export function openMoodModal(mood, onSaved) {
  const isEdit = !!mood;
  const data = mood || { name: '', description: '', image: '', theme: 'bonsai' };

  const screen = document.createElement('div');
  screen.className = 'mood-editor-screen';
  screen.innerHTML = `
    <div class="mood-editor-header">
      <button class="back-btn" data-action="cancel" aria-label="Назад">←</button>
      <h1 class="mood-editor-title">${isEdit ? 'Редактировать' : 'Новое настроение'}</h1>
      <button class="btn-save" data-action="save">Сохранить</button>
    </div>

    <div class="mood-editor-body">
      <label class="input-label">Название</label>
      <input class="input-field" id="mood-name" type="text" value="${data.name}" placeholder="Например: Устал" />

      <label class="input-label">Описание</label>
      <textarea class="input-field" id="mood-desc" rows="3" placeholder="Коротко о настроении">${data.description || ''}</textarea>

      <label class="input-label">Картинка (URL или локальный путь)</label>
      <input class="input-field" id="mood-image" type="text" value="${data.image || ''}" placeholder="https://... или /assets/..." />
      <div id="mood-image-preview" style="margin-top:8px;"></div>

      <label class="input-label">Тема оформления</label>
      <button class="input-field mood-theme-btn" id="mood-theme-btn" type="button">
        <span id="mood-theme-name">${data.theme || 'bonsai'}</span>
        <span aria-hidden="true">›</span>
      </button>
    </div>

    ${isEdit ? `
    <div class="mood-editor-footer">
      <button class="btn-danger" data-action="delete">Удалить настроение</button>
    </div>
    ` : ''}
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  // Превью картинки
  const imgInput = screen.querySelector('#mood-image');
  const preview = screen.querySelector('#mood-image-preview');
  const renderPreview = () => {
    const v = imgInput.value.trim();
    preview.innerHTML = v
      ? `<img src="${v}" alt="preview" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" onerror="this.style.display='none'"/>`
      : '';
  };
  imgInput.addEventListener('input', renderPreview);
  renderPreview();

  // Кнопка "Тема" → экран выбора тем с контекстом
  screen.querySelector('#mood-theme-btn').addEventListener('click', () => {
    // Сначала сохраним текущие поля, чтобы не потерять при переходе
    const patch = readPatch();
    if (isEdit) {
      updateMood(mood.id, patch);
    } else {
      // Если создаём новое — сохраним его сразу, чтобы был id для выбора темы
      const created = addMood(patch);
      // Пересоздаём модалку с уже созданным настроением
      close();
      if (typeof onSaved === 'function') onSaved();
      import('./themes.js').then(m => m.renderThemesScreen({ forMoodId: created.id }));
      return;
    }
    close();
    if (typeof onSaved === 'function') onSaved();
    import('./themes.js').then(m => m.renderThemesScreen({ forMoodId: mood.id }));
  });

  // Кнопка "Сохранить"
  screen.querySelector('[data-action="save"]').addEventListener('click', () => {
    const patch = readPatch();
    if (isEdit) {
      updateMood(mood.id, patch);
    } else {
      addMood(patch);
    }
    close();
    if (typeof onSaved === 'function') onSaved();
  });

  // Кнопка "Назад" = отмена
  screen.querySelector('[data-action="cancel"]').addEventListener('click', close);

  // Кнопка "Удалить"
  screen.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!confirm('Удалить это настроение?')) return;
    import('../data/moods-store.js').then(({ getMoods, saveMoods }) => {
      const moods = getMoods().filter(m => m.id !== mood.id);
      saveMoods(moods);
      // Если удалили активное — сбросим на default
      if (localStorage.getItem('bonsai-active-mood') === mood.id) {
        localStorage.removeItem('bonsai-active-mood');
      }
      close();
      if (typeof onSaved === 'function') onSaved();
    });
  });

  function readPatch() {
    return {
      name: screen.querySelector('#mood-name').value.trim() || 'Без названия',
      description: screen.querySelector('#mood-desc').value.trim(),
      image: imgInput.value.trim(),
      theme: data.theme // тема меняется отдельным экраном
    };
  }
}
