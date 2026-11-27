import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import {
  createFullBackup,
  validateFullBackup,
  getBackupSummary,
  restoreFullBackup
} from '../data/backup-store.js';

function formatBackupDate(timestamp) {
  if (!timestamp) return 'дата неизвестна';
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Открывает бургер-меню (полноэкранный экран).
 */
export function openBurgerMenu() {
  const screen = document.createElement('div');
  screen.className = 'burger-screen';
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
    <div class="burger-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" id="burger-close" aria-label="Закрыть">←</button>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0; flex: 1;">Меню</h1>
    </div>

    <div class="burger-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 12px;">
      <button id="burger-log" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Лог выполнения
      </button>
      <button id="burger-archive" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Архив
      </button>

      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-muted); margin-top: 4px;">
        Полный бэкап
      </div>
      <button id="burger-full-backup" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Скачать полный бэкап (без фото)
      </button>
      <button id="burger-full-import" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Импорт полного бэкапа
      </button>
      <input type="file" id="burger-full-file-input" accept=".json,application/json" style="display: none;" />

      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-muted); margin-top: 4px;">
        Только задачи
      </div>
      <button id="burger-export" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Экспорт только задач
      </button>
      <button id="burger-import" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        Импорт только задач
      </button>
      <input type="file" id="burger-file-input" accept=".json,application/json" style="display: none;" />

      <!-- Разделитель -->
      <div style="flex: 1;"></div>

      <!-- Кнопка "Очистить всё" (внизу) -->
      <button id="burger-clear" class="btn-save" style="background: #e5484d; color: white; text-align: left; padding: 16px; font-size: 16px;">
        Очистить все задачи
      </button>
      <div style="padding-top: 4px; text-align: center; font-size: 11px; color: var(--text-muted);">
        сборка ${__BUILD_ID__}
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  screen.querySelector('#burger-log').addEventListener('click', () => {
    import('./log-view.js').then(module => module.openLogView());
  });

  screen.querySelector('#burger-archive').addEventListener('click', () => {
    import('./archive-view.js').then(module => module.openArchiveView({
      onRestored: () => {
        const mode = localStorage.getItem('bonsai-current-mode') || 'tinder';
        import('../router.js').then(router => router.showMainView(mode));
      }
    }));
  });

  // Вспомогательная функция для скачивания
  function downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function shareOrDownload(blob, fileName, title) {
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title,
          text: 'Сохрани файл в удобное место'
        }).catch(() => {
          downloadFile(blob, fileName);
        });
        return;
      }
    }

    downloadFile(blob, fileName);
  }

  function downloadJson(data, fileName, title) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    shareOrDownload(blob, fileName, title);
  }

  // Закрыть
  screen.querySelector('#burger-close').addEventListener('click', close);

  // Экспорт только задач
  screen.querySelector('#burger-export').addEventListener('click', () => {
    const tree = getTasksTree();

    function cleanTree(node) {
      if (node.image && node.image.startsWith('data:')) {
        node.image = '';
      }
      if (node.children) {
        node.children.forEach(cleanTree);
      }
    }
    cleanTree(tree);

    downloadJson(
      tree,
      `bonsai-tasks-${new Date().toISOString().slice(0, 10)}.json`,
      'Экспорт задач Bonsai'
    );
  });

  // Импорт только задач
  const fileInput = screen.querySelector('#burger-file-input');
  screen.querySelector('#burger-import').addEventListener('click', () => {
    fileInput.click();
  });

  // Экспорт полного бэкапа
  screen.querySelector('#burger-full-backup').addEventListener('click', () => {
    const backup = createFullBackup({ includeImages: false });
    downloadJson(
      backup,
      `bonsai-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'Полный бэкап Bonsai'
    );
  });

  // Импорт полного бэкапа
  const fullFileInput = screen.querySelector('#burger-full-file-input');
  screen.querySelector('#burger-full-import').addEventListener('click', () => {
    fullFileInput.click();
  });

  // Очистить всё (с подтверждением)
  screen.querySelector('#burger-clear').addEventListener('click', () => {
    const confirmText = prompt('Это удалит ВСЕ задачи безвозвратно.\nВведите слово "удалить" для подтверждения:');
    if (confirmText === 'удалить') {
      const emptyTree = { name: 'Мои задачи', children: [] };
      saveTasksTree(emptyTree);
      alert('Все задачи удалены.');
      close();
      location.reload();
    } else if (confirmText !== null) {
      alert('Отменено. Слово не совпало.');
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object' || !data.name) {
          alert('Ошибка: файл не похож на дерево задач Bonsai');
          return;
        }
        saveTasksTree(data);
        alert('Импорт успешен. Дерево задач загружено.');
        close();
        location.reload();
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  fullFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        const error = validateFullBackup(backup);
        if (error) {
          alert(error);
          return;
        }

        const summary = getBackupSummary(backup);
        const lines = [
          `Дата: ${formatBackupDate(summary.exportedAt)}`,
          `Фото: ${summary.includesImages ? 'включены' : 'не включены'}`,
          `Задач: ${summary.tasks}`,
          `Настроений: ${summary.moods}`,
          `Архив: ${summary.archive}`,
          `Лог: ${summary.log}`,
          '',
          'Текущие данные будут заменены.'
        ];

        if (!confirm(`Импортировать полный бэкап?\n\n${lines.join('\n')}`)) return;

        const restored = restoreFullBackup(backup);
        alert(`Импорт завершён.\nЗадач: ${restored.tasks}, настроений: ${restored.moods}.`);
        close();
        location.reload();
      } catch (err) {
        alert('Не удалось импортировать бэкап: ' + err.message);
      } finally {
        fullFileInput.value = '';
      }
    };

    reader.readAsText(file);
  });
}
