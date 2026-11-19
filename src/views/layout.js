export function renderLayout({ showTabs = true, showHeader = true } = {}) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="layout">
      ${showHeader ? `
      <header class="header">
        <button class="burger-menu" aria-label="Меню">☰</button>
        <div class="logo">Bonsai</div>
        <div class="header-spacer"></div>
      </header>
      ` : ''}

      <main id="main-content" class="main-content"></main>

      ${showTabs ? `
      <nav class="tab-bar">
        <button class="tab-item active" data-view="tinder">🔥</button>
        <button class="tab-item" data-view="navigation">📁</button>
        <button class="tab-item" data-view="list">📋</button>
      </nav>
      ` : ''}
    </div>
  `;
}
