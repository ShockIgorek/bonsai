import { demoTree } from '../data/demo-tree.js';
import { buildNavIndex } from './store.js';
import { initRouter } from './router.js';

const navIndex = buildNavIndex(demoTree);
window.nav = navIndex;

initRouter();
