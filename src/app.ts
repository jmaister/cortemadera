import { initOptimizer } from './features/optimizer.js';
import { initShelfCalculator } from './features/shelf.js';

type Route = 'home' | 'optimizer' | 'shelf';

function parseRouteFromHash(): Route {
  const h = (location.hash || '').replace(/^#\/?/, '');
  if (h === 'optimizer') return 'optimizer';
  if (h === 'shelf') return 'shelf';
  return 'home';
}

function showRoute(route: Route) {
  const views = [
    { route: 'home', id: 'view-home' },
    { route: 'optimizer', id: 'view-optimizer' },
    { route: 'shelf', id: 'view-shelf' },
  ] as const;
  for (const v of views) {
    const el = document.getElementById(v.id);
    if (!el) continue;
    el.classList.toggle('active', v.route === route);
  }

  document.querySelectorAll('[data-route]')?.forEach((a) => {
    const r = (a as HTMLElement).getAttribute('data-route');
    (a as HTMLElement).classList.toggle('active', r === route);
  });
}

export function initApp(): void {
  let optimizerInitialized = false;
  let shelfInitialized = false;

  function ensureInitialized(route: Route) {
    if (route === 'optimizer' && !optimizerInitialized) {
      initOptimizer();
      optimizerInitialized = true;
    }
    if (route === 'shelf' && !shelfInitialized) {
      initShelfCalculator();
      shelfInitialized = true;
    }
  }

  function render() {
    const route = parseRouteFromHash();
    showRoute(route);
    ensureInitialized(route);
  }

  window.addEventListener('hashchange', render);
  render();
}

export default { initApp };
