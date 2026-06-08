import { useEffect, useState } from 'react';
import OptimizerView from './views/OptimizerView';
import ShelfView from './views/ShelfView';
import HomeView from './views/HomeView';
import CompleteShelfView from './views/CompleteShelfView';
import './css/styles.css';

export default function App() {
  const [route, setRoute] = useState<'home' | 'optimizer' | 'shelf' | 'shelf-complete'>('home');

  useEffect(() => {
    const handleHashChange = () => {
      const h = (location.hash || '').replace(/^#\/?/, '');
      setRoute(h as 'home' | 'optimizer' | 'shelf' | 'shelf-complete');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      <div className="header no-print">
        <div className="header-row">
          <h1>Wood Tools</h1>
          <nav className="nav">
            <a href="#/home" data-route="home">
              Home
            </a>
            <a href="#/optimizer" data-route="optimizer">
              Optimizer
            </a>
            <a href="#/shelf" data-route="shelf">
              Shelf Calculator
            </a>
            <a href="#/shelf-complete" data-route="shelf-complete">
              Shelf + Cut Optimizer
            </a>
          </nav>
        </div>
      </div>
      <section id="view-home" className={route === 'home' ? 'view active' : ''}>
        <HomeView />
      </section>
      <section id="view-optimizer" className={route === 'optimizer' ? 'view active' : ''}>
        <OptimizerView />
      </section>
      <section id="view-shelf" className={route === 'shelf' ? 'view active' : ''}>
        <ShelfView />
      </section>
      <section id="view-shelf-complete" className={route === 'shelf-complete' ? 'view active' : ''}>
        <CompleteShelfView />
      </section>
    </>
  );
}
