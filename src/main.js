import { demoTree } from '../data/demo-tree.js';
import { buildNavIndex } from './store.js';
import { initRouter } from './router.js';
import { initNetlifyCleanup } from './utils/netlify-cleanup.js';

initNetlifyCleanup();

const navIndex = buildNavIndex(demoTree);
window.nav = navIndex;

initRouter();
