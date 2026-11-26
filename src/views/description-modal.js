function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Модалка описания задачи. На телефоне textarea в форме ведёт себя нестабильно,
 * поэтому описание редактируется отдельным экраном.
 */
export function openDescriptionModal(initialValue, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'description-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Описание</h2>
        <button class="btn-save" type="button" data-action="save" style="padding: 6px 12px; font-size: 13px;">Сохранить</button>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <textarea class="input-field" id="description-input" rows="8" placeholder="Коротко о задаче" style="min-height: 160px; resize: vertical; line-height: 1.4;">${escapeHtml(initialValue)}</textarea>
      </div>
      <div class="modal-footer" style="display: flex; gap: 8px;">
        <button class="btn-save" type="button" data-action="cancel" style="flex: 1; background: var(--bg-panel); color: var(--text-main);">Отмена</button>
        <button class="btn-save" type="button" data-action="save" style="flex: 1;">Сохранить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const textarea = overlay.querySelector('#description-input');
  const saveButtons = overlay.querySelectorAll('[data-action="save"]');
  const close = () => overlay.remove();
  let saving = false;

  function handleSave(e) {
    if (e) e.preventDefault();
    if (saving) return;
    document.activeElement?.blur?.();
    saving = true;
    onSave(textarea.value.trim());
    close();
  }

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  saveButtons.forEach(btn => {
    btn.addEventListener('click', handleSave);
    btn.addEventListener('touchend', handleSave, { passive: false });
  });

  textarea.focus();
}
