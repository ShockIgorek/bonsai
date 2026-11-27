import { getMoodSorting } from '../logic/tinder-ranking.js';
import { SORTING_PRESETS, getDefaultPreset } from '../logic/sorting-presets.js';
import { saveMoodSorting } from '../data/mood-sorting.js';

const CRITERIA = [
  {
    key: 'importance',
    label: 'Важность',
    options: [
      { value: 1, label: 'Важнее' },
      { value: -1, label: 'Менее важное' }
    ]
  },
  {
    key: 'time',
    label: 'Скорость',
    options: [
      { value: -1, label: 'Короче' },
      { value: 1, label: 'Дольше' }
    ]
  },
  {
    key: 'difficulty',
    label: 'Сложность',
    options: [
      { value: -1, label: 'Проще' },
      { value: 1, label: 'Сложнее' }
    ]
  }
];

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function openSortingModal(mood, onSaved) {
  const current = getMoodSorting(mood);
  let weights = {
    importance: Math.round(current.weights.importance * 100),
    time: Math.round(current.weights.time * 100),
    difficulty: Math.round(current.weights.difficulty * 100)
  };
  let directions = { ...current.directions };
  let presetId = (mood.sorting && mood.sorting.presetId) || null;
  let saving = false;

  const overlay = document.createElement('div');
  overlay.className = 'completion-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card sorting-modal">
      <div class="modal-header">
        <h2 class="modal-title">Влияние на сортировку</h2>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>

      <div class="modal-body">
        <div style="font-size: 14px; color: var(--text-secondary);">
          Настроение: <strong style="color: var(--text-main);">${escapeHtml(mood.name)}</strong>
        </div>

        <div class="sorting-presets">
          ${SORTING_PRESETS.map(preset => `
            <button type="button" class="sorting-preset" data-preset="${escapeHtml(preset.id)}" title="${escapeHtml(preset.description)}">
              ${escapeHtml(preset.name)}
            </button>
          `).join('')}
        </div>

        <div class="sorting-criteria">
          ${CRITERIA.map(criterion => `
            <div class="sorting-criterion" data-criterion="${criterion.key}">
              <div class="sorting-criterion-head">
                <span class="sorting-criterion-label">${criterion.label}</span>
                <span class="sorting-criterion-value" data-weight-value="${criterion.key}">0%</span>
              </div>
              <input
                class="sorting-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                data-weight="${criterion.key}"
              />
              <div class="sorting-direction" data-direction-group="${criterion.key}">
                ${criterion.options.map(option => `
                  <button type="button" data-direction-value="${option.value}" data-direction-key="${criterion.key}">
                    ${option.label}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="sorting-sum" data-sorting-sum></div>

        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
          Чем выше вес, тем сильнее критерий влияет на порядок карточек.
          Направление задаёт, что считать лучшим: важное или менее важное, короткое или длинное, простое или сложное.
        </div>
      </div>

      <div class="modal-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn-save" type="button" data-action="reset" style="flex: 1; background: var(--bg-panel); color: var(--text-main);">Сбросить</button>
        <button class="btn-save" type="button" data-action="cancel" style="flex: 1; background: var(--bg-panel); color: var(--text-secondary);">Отмена</button>
        <button class="btn-save" type="button" data-action="save" style="flex: 1;">Сохранить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const sumEl = overlay.querySelector('[data-sorting-sum]');
  const close = () => overlay.remove();

  function refresh() {
    let total = 0;

    for (const criterion of CRITERIA) {
      const key = criterion.key;
      const value = Number(weights[key]) || 0;
      total += value;

      const slider = overlay.querySelector(`[data-weight="${key}"]`);
      if (slider) slider.value = String(value);

      const valueEl = overlay.querySelector(`[data-weight-value="${key}"]`);
      if (valueEl) valueEl.textContent = `${Math.round(value)}%`;

      overlay.querySelectorAll(`[data-direction-key="${key}"]`).forEach(button => {
        button.classList.toggle(
          'is-active',
          Number(button.dataset.directionValue) === directions[key]
        );
      });
    }

    overlay.querySelectorAll('[data-preset]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.preset === presetId);
    });

    sumEl.textContent = total === 100
      ? 'Сумма: 100%'
      : `Сумма: ${Math.round(total)}% · при сохранении проценты нормализуются`;
  }

  function applyPreset(preset) {
    weights = {
      importance: Math.round(preset.weights.importance * 100),
      time: Math.round(preset.weights.time * 100),
      difficulty: Math.round(preset.weights.difficulty * 100)
    };
    directions = { ...preset.directions };
    presetId = preset.id;
    refresh();
  }

  overlay.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const preset = SORTING_PRESETS.find(item => item.id === button.dataset.preset);
      if (preset) applyPreset(preset);
    });
  });

  overlay.querySelectorAll('[data-weight]').forEach(slider => {
    slider.addEventListener('input', () => {
      weights[slider.dataset.weight] = Number(slider.value) || 0;
      presetId = null;
      refresh();
    });
  });

  overlay.querySelectorAll('[data-direction-key]').forEach(button => {
    button.addEventListener('click', () => {
      directions[button.dataset.directionKey] = Number(button.dataset.directionValue);
      presetId = null;
      refresh();
    });
  });

  overlay.querySelector('[data-action="reset"]').addEventListener('click', () => {
    applyPreset(getDefaultPreset());
  });

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
    if (saving) return;
    saving = true;

    try {
      saveMoodSorting(mood.id, { weights, directions, presetId });
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      saving = false;
      console.error('Не удалось сохранить настройки сортировки', err);
      alert('Не удалось сохранить настройки сортировки. Попробуй ещё раз.');
    }
  });

  refresh();
}
