const THEMES = [
  { id: 'dark', name: 'Dark' },
  { id: 'light', name: 'Light' },
  { id: 'ember', name: 'Ember' },
  { id: 'ice', name: 'Ice' },
  { id: 'neon', name: 'Neon' },
  { id: 'vice', name: 'Vice' },
  { id: 'nuance', name: 'Nuance' },
  { id: 'noir', name: 'Noir' },
  { id: 'aqua', name: 'Aqua' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'amber', name: 'Amber' },
  { id: 'forest', name: 'Forest' }
];

export function renderThemesScreen() {
  const app = document.getElementById('main-content');
  if (!app) return;

  const savedTheme = localStorage.getItem('bonsai-theme') || 'bonsai';
  document.documentElement.setAttribute('data-theme', savedTheme);

  app.innerHTML = `
    <div class="themes-screen">
      <div class="themes-header-row">
        <button class="back-btn" aria-label="Назад">←</button>
        <h1 class="themes-title">Выбери тему</h1>
      </div>
      <div class="themes-list">
        ${THEMES.map(t => {
          const filter = getThemeFilter(t.id);
          return `
          <button class="theme-card" data-theme="${t.id}">
            <div class="theme-preview" data-theme="${t.id}">
              <div class="theme-bg" style="background: var(--bg-card);"></div>
              <div class="theme-preview-img" style="background-image: url('/assets/bonsai-preview.jpg'); filter: ${filter};"></div>
              
              <div class="theme-preview-overlay">
                <div class="theme-preview-header">
                  <span class="theme-preview-title">${t.name}</span>
                  <span class="theme-preview-badge"></span>
                </div>
                <div class="theme-preview-desc">Пример описания задачи</div>
                <div class="theme-preview-btn">Сделать</div>
              </div>
            </div>
          </button>
        `}).join('')}
      </div>
    </div>
  `;

  app.querySelector('.back-btn')?.addEventListener('click', () => {
    import('../router.js').then(m => m.showMoodsScreen());
  });

  app.querySelectorAll('.theme-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('bonsai-theme', theme);
      // Перерисовываем экран, чтобы превью и цвета обновились
      renderThemesScreen();
    });
  });
}

function getThemeFilter(themeId) {
  const filters = {
    'noir': 'grayscale(100%) contrast(1.2)',
    'ice': 'sepia(0.3) hue-rotate(180deg) saturate(1.5)',
    'neon': 'contrast(1.2) saturate(1.5) hue-rotate(300deg)',
    'vice': 'contrast(1.1) saturate(1.3) hue-rotate(240deg)',
    'ember': 'sepia(0.6) saturate(1.4) hue-rotate(-20deg)',
    'nuance': 'sepia(0.2) hue-rotate(300deg)',
    'aqua': 'hue-rotate(150deg) saturate(1.2)',
    'sunset': 'sepia(0.4) saturate(1.3) hue-rotate(-30deg)',
    'amber': 'sepia(0.5) saturate(1.2)',
    'bonsai': 'contrast(1.1) saturate(1.2)',
    'forest': 'hue-rotate(60deg) saturate(1.3)',
    'dark': 'none',
    'light': 'none'
  };
  return filters[themeId] || 'none';
}
