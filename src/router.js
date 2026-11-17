export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;
  
  app.innerHTML = `
    <div style="padding: 20px; color: white; text-align: center;">
      <h1>Bonsai</h1>
      <p>Данные: ${window.nav.byId.size} узлов</p>
      <p>Корень: ${window.nav.byId.get(window.nav.rootId).name}</p>
    </div>
  `;
}
