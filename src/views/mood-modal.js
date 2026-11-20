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

      <label class="input-label">Картинка</label>
      
      <input class="input-field" id="mood-image-url" type="text" value="${data.image && data.image.startsWith('http') ? data.image : ''}" placeholder="Вставь ссылку (URL) на картинку" />
      
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
        <span style="font-size: 12px; color: var(--text-secondary);">или</span>
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
      </div>

      <input type="file" id="mood-image-file" accept="image/*" capture="environment" hidden />
      <button class="input-field" id="mood-image-btn" type="button" style="text-align: left;">
        ${data.image && !data.image.startsWith('http') ? 'Заменить фото' : 'Загрузить фото или сделать снимок'}
      </button>
      
      <div id="mood-image-preview" style="margin-top:8px;">
        ${data.image ? `<img src="${data.image}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" />` : ''}
      </div>

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

  // Логика выбора картинки (URL или файл)
  let currentImageData = data.image || '';
  const imgUrlInput = screen.querySelector('#mood-image-url');
  const imgFileInput = screen.querySelector('#mood-image-file');
  const imgBtn = screen.querySelector('#mood-image-btn');
  const preview = screen.querySelector('#mood-image-preview');

  function updatePreview(src) {
    if (src) {
      preview.innerHTML = `<img src="${src}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" />`;
    } else {
      preview.innerHTML = '';
    }
  }

  // Ввод URL
  imgUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    currentImageData = url;
    updatePreview(url);
    // Если ввели URL, сбрасываем кнопку файла
    imgBtn.textContent = 'Загрузить фото или сделать снимок';
  });

  // Клик по кнопке файла
  imgBtn.addEventListener('click', () => imgFileInput.click());

  // Выбор файла
  imgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      currentImageData = event.target.result;
      updatePreview(currentImageData);
      // Очищаем поле URL, так как выбрали файл
      imgUrlInput.value = '';
      imgBtn.textContent = 'Заменить фото';
    };
    reader.readAsDataURL(file);
  });

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
      image: currentImageData,
      theme: data.theme // тема меняется отдельным экраном
    };
  }
}
