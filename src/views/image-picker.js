function escapeAttr(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Единый выбор фото: камера, галерея, URL или удаление.
 * @param {string} currentImage — текущая картинка (dataURL или URL)
 * @param {(src: string) => void} onSelect — вызывается с выбранным значением
 */
export function openImagePicker(currentImage, onSelect) {
  // Закрываем мобильную клавиатуру, чтобы первый тап по кнопкам не терялся
  document.activeElement?.blur?.();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay image-picker-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Фото</h2>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body" id="image-picker-body"></div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const body = overlay.querySelector('#image-picker-body');

  const cameraInput = document.createElement('input');
  cameraInput.type = 'file';
  cameraInput.accept = 'image/*';
  cameraInput.capture = 'environment';

  const galleryInput = document.createElement('input');
  galleryInput.type = 'file';
  galleryInput.accept = 'image/*';

  // Не display:none — на iOS так надёжнее срабатывает программный click()
  for (const input of [cameraInput, galleryInput]) {
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
  }

  overlay.append(cameraInput, galleryInput);

  const close = () => overlay.remove();

  function pickFile(input) {
    input.value = '';
    input.click();
  }

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      onSelect(e.target.result);
      close();
    };
    reader.readAsDataURL(file);
  }

  cameraInput.addEventListener('change', handleFile);
  galleryInput.addEventListener('change', handleFile);

  function renderMenu() {
    body.innerHTML = `
      <button class="btn-save image-picker-option" type="button" data-action="camera">Сделать фото</button>
      <button class="btn-save image-picker-option" type="button" data-action="gallery">Выбрать из галереи</button>
      <button class="btn-save image-picker-option" type="button" data-action="url">Вставить ссылку</button>
      ${currentImage ? '<button class="btn-save image-picker-option image-picker-danger" type="button" data-action="remove">Удалить фото</button>' : ''}
    `;

    body.querySelector('[data-action="camera"]').addEventListener('click', () => pickFile(cameraInput));
    body.querySelector('[data-action="gallery"]').addEventListener('click', () => pickFile(galleryInput));
    body.querySelector('[data-action="url"]').addEventListener('click', renderUrlStep);
    body.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
      onSelect('');
      close();
    });
  }

  function renderUrlStep() {
    const hasUrl = currentImage && /^https?:\/\//i.test(currentImage);
    body.innerHTML = `
      <label class="input-label">Ссылка на изображение</label>
      <input class="input-field" id="image-picker-url" type="url" inputmode="url" placeholder="https://..." value="${hasUrl ? escapeAttr(currentImage) : ''}" />
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button class="btn-save" type="button" data-action="back" style="flex: 1; background: var(--bg-panel); color: var(--text-main);">Назад</button>
        <button class="btn-save" type="button" data-action="apply" style="flex: 1;">Применить</button>
      </div>
    `;

    let applied = false;
    const applyUrl = () => {
      if (applied) return;
      const url = body.querySelector('#image-picker-url').value.trim();
      if (!url) return;
      applied = true;
      onSelect(url);
      close();
    };

    const applyBtn = body.querySelector('[data-action="apply"]');
    const urlInput = body.querySelector('#image-picker-url');

    body.querySelector('[data-action="back"]').addEventListener('click', renderMenu);
    applyBtn.addEventListener('click', applyUrl);
    applyBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      applyUrl();
    }, { passive: false });
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyUrl();
      }
    });
  }

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  renderMenu();
}
