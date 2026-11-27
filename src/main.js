import { demoTree } from '../data/demo-tree.js';
import { buildNavIndex } from './store.js';
import { initRouter } from './router.js';
import { initNetlifyCleanup } from './utils/netlify-cleanup.js';
import { registerSW } from 'virtual:pwa-register';

initNetlifyCleanup();

// autoUpdate: при выходе новой версии Workbox сам перезагрузит страницу.
// Периодическая проверка нужна, чтобы установленное PWA не жило
// со старым service worker неделями.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      registration.update().catch(() => {});
    };

    window.setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  },
  onRegisterError(error) {
    console.error('Не удалось зарегистрировать service worker', error);
  }
});

const navIndex = buildNavIndex(demoTree);
window.nav = navIndex;

initRouter();
