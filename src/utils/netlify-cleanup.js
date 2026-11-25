// Best-effort удаление служебных оверлеев Netlify (Deploy Preview Drawer/бейдж).
// Если элемент инжектится в закрытый shadow DOM или это расширение браузера —
// со страницы его убрать нельзя, тогда Drawer отключается в настройках Netlify.

const SELECTOR = [
  'div[id^="netlify"]',
  'div[class*="netlify"]',
  'netlify-drawer',
  'netlify-badge',
  'netlify-toolbar',
  '[data-netlify-drawer]',
  '[data-netlify-preview-banner]',
  '[data-netlify-badge]',
  'iframe[src*="netlify"]',
  'iframe[id*="netlify"]'
].join(',');

function cleanRoot(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  root.querySelectorAll(SELECTOR).forEach(el => el.remove());

  // На случай, если оверлей внутри открытого shadow root
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) cleanRoot(el.shadowRoot);
  });
}

export function initNetlifyCleanup() {
  cleanRoot(document);

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      cleanRoot(document);
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}
