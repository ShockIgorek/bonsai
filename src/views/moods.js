export function renderMoodsScreen() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="moods-screen">
      <div class="moods-header">
        <button class="back-btn" aria-label="Назад">←</button>
        <h1 class="moods-title">Настроения</h1>
      </div>
      <div class="moods-grid">
        <!-- Карточка "Норма" -->
        <button class="mood-card" data-mood="default">
          <div class="mood-preview" style="background: var(--bg-card); border: 2px solid var(--border);">
            <span style="color: var(--text-main); font-size: 24px;">😐</span>
          </div>
          <span class="mood-name">Норма</span>
          <button class="edit-mood-btn" aria-label="Редактировать">✏️</button>
        </button>

        <!-- Карточка "+" -->
        <button class="mood-card add-mood" data-mood="add">
          <div class="mood-preview" style="background: var(--bg-panel); border: 2px dashed var(--border);">
            <span style="color: var(--text-muted); font-size: 32px;">+</span>
          </div>
          <span class="mood-name">Добавить</span>
        </button>
      </div>
    </div>
  `;

  // Кнопка "Назад" — возвращает на экран тем (для теста)
  main.querySelector('.back-btn')?.addEventListener('click', () => {
    import('./themes.js').then(m => m.renderThemesScreen());
  });
}
