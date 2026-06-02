# Testing, Performance, and Extensibility Notes

## Testing

- Unit tests: isolate solver logic (`src/js/solver.js`) and test packing correctness, kerf handling, and objective behaviour. Use Node.js (ESM) or Jest with `jsdom` for DOM-related tests.
- Integration tests: load representative sample inputs and assert metrics (boards used, total waste) match expected values.
- Visual tests: render SVG outputs and verify no overlapping pieces and coordinates are within board bounds.

Quick script provided: `scripts/test_solver.mjs` runs the solver against `src/data/sample.json`.

## Performance

- Heuristics (FFD) are O(n * b) where n = pieces, b = boards. Should handle hundreds of pieces quickly in the browser.
- Use a Web Worker for larger inputs to avoid blocking the UI (implemented via `src/js/worker-solver.js`).
- Provide a time-limited improvement loop (the current implementation caps iterations) to keep runtime bounded.
- Consider WASM or server-side ILP for exact/large-scale optimization.

## Extensibility

- 2D packing: add a new solver module (e.g., `src/js/guillotine2d.js`) and a 2D renderer. Use `rectpack` heuristics or port an existing algorithm.
- Exact solvers: compile OR-Tools or another ILP solver to WASM and provide an optional high-quality mode.
- UI: replace table editor with a component framework (React/Preact/Vue) if the app grows.
- Persistence: add an optional backend to store named projects and job history.

## Known limitations

- Current solver is heuristic-only and may not find optimal layouts for some instances.
- Stock quantity handling is basic; consider supporting infinite stock or dynamic purchasing rules.
