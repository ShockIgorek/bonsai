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
  { id: 'amber', name: 'Amber' }
];

export function renderThemesScreen() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="themes-screen">
      <h1 class="themes-title">Выбери настроение</h1>
      <div class="themes-grid">
        ${THEMES.map(t => `
          <button class="theme-card" data-theme="${t.id}">
            <div class="theme-color" style="background: var(--bg-main); border: 2px solid var(--border);"></div>
            <span class="theme-name">${t.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  app.querySelectorAll('.theme-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      // Сохраняем выбор, чтобы не сбрасывался
      localStorage.setItem('bonsai-theme', theme);
    });
  });
}
