import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';

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
      <button id="burger-export" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        📤 Экспорт задач (JSON)
      </button>
      <button id="burger-import" class="btn-save" style="background: var(--bg-panel); color: var(--text-main); text-align: left; padding: 16px; font-size: 16px;">
        📥 Импорт задач (JSON)
      </button>
      <input type="file" id="burger-file-input" accept=".json,application/json" style="display: none;" />

      <!-- Разделитель -->
      <div style="flex: 1;"></div>

      <!-- Кнопка "Очистить всё" (внизу) -->
      <button id="burger-clear" class="btn-save" style="background: #e5484d; color: white; text-align: left; padding: 16px; font-size: 16px;">
        🗑️ Очистить все задачи
      </button>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const close = () => screen.remove();

  screen.querySelector('#burger-log').addEventListener('click', () => {
    import('./log-view.js').then(module => module.openLogView());
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

  // Закрыть
  screen.querySelector('#burger-close').addEventListener('click', close);

  // Экспорт
  screen.querySelector('#burger-export').addEventListener('click', () => {
    const tree = getTasksTree();
    console.log('ЭКСПОРТ: дерево =', tree);
    
    // Очищаем base64-картинки (они раздувают файл)
    function cleanTree(node) {
      if (node.image && node.image.startsWith('data:')) {
        node.image = ''; // убираем base64
      }
      if (node.children) {
        node.children.forEach(cleanTree);
      }
    }
    cleanTree(tree);
    
    const json = JSON.stringify(tree, null, 2);
    console.log('ЭКСПОРТ: JSON длина =', json.length);
    const blob = new Blob([json], { type: 'application/json' });
    const fileName = `bonsai-tasks-${new Date().toISOString().slice(0, 10)}.json`;

    // Пробуем Web Share API (для Android/iOS — нативно)
    console.log('ЭКСПОРТ: navigator.share =', !!navigator.share);
    console.log('ЭКСПОРТ: navigator.canShare =', !!navigator.canShare);
    
    // Пробуем Web Share API (для Android/iOS — нативно)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'application/json' });
      const canShare = navigator.canShare({ files: [file] });
      console.log('ЭКСПОРТ: canShare файла =', canShare);
      if (canShare) {
        navigator.share({
          files: [file],
          title: 'Экспорт задач Bonsai',
          text: 'Сохрани файл в удобное место'
        }).then(() => {
          console.log('ЭКСПОРТ: share успешен');
        }).catch((err) => {
          console.log('ЭКСПОРТ: share ошибка, используем fallback', err);
          // Fallback при ошибке share
          downloadFile(blob, fileName);
        });
        return;
      }
    }

    // Fallback: скачивание через ссылку
    console.log('ЭКСПОРТ: используем fallback (скачивание)');
    downloadFile(blob, fileName);
  });

  // Импорт
  const fileInput = screen.querySelector('#burger-file-input');
  screen.querySelector('#burger-import').addEventListener('click', () => {
    fileInput.click();
  });

  // Очистить всё (с подтверждением)
  screen.querySelector('#burger-clear').addEventListener('click', () => {
    const confirmText = prompt('Это удалит ВСЕ задачи безвозвратно.\nВведите слово "удалить" для подтверждения:');
    if (confirmText === 'удалить') {
      // Очищаем дерево до пустого корня
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
        // Простая валидация: должен быть объект с name и children (или хотя бы name)
        if (!data || typeof data !== 'object' || !data.name) {
          alert('Ошибка: файл не похож на дерево задач Bonsai');
          return;
        }
        saveTasksTree(data);
        alert('Импорт успешен! Дерево задач загружено.');
        close();
        // Перерисовываем текущий экран (если нужно — обнови вручную)
        location.reload();
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}
