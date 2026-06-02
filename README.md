# Wood Cutting Optimizer (Client)

This is a minimal client-side prototype for optimizing cutting boards into pieces.

Quick start

- Open `src/index.html` in a modern browser (Chrome/Edge/Firefox) to use the web UI.
- Use the *Load Sample* button to load the example dataset, then *Calculate* to compute a solution.

Dev (Vite + TypeScript)

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Then open the URL the Vite server prints (usually http://localhost:5173).

Run the solver test (Node.js required)

```bash
npm run test-solver
```

Notes

- The app runs entirely in the browser; heavy solves optionally run inside a Web Worker.
- Configurations are saved to `localStorage` in the browser.

# Corte de madera optimizado

