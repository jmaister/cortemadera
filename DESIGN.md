# Wood-Cutting Optimization — Design (Client-only HTML/JS)

## Overview

This document describes the design for a client-side web application (HTML + JavaScript) that optimizes cutting raw lumber into requested pieces. The MVP runs entirely in the browser — no server-side component is required. All computation, drawing, persistence, and export occur client-side.

Primary user flows:
- Edit pieces and stock configuration in the UI.
- Choose optimization objective (minimize waste, minimize cuts, minimize cost, minimize number of source pieces).
- Click "Calculate" to run the solver locally and display the solution and drawing.

## Scope & Assumptions

- MVP targets 1-dimensional cutting (linear lengths) because most lumber-length optimization is 1D. Design includes notes for 2D rectangular-sheet extension.
- Kerf (saw width) is configurable and applied to each cut.
- Pieces must fit entirely inside a stock board (no stitching).
- Rotation is only meaningful for 2D; for 1D rotation is not applicable.
- Calculations run synchronously for small inputs; large/long-running solves run in a Web Worker to avoid blocking the UI and provide progress updates.

## Goals and Features

- Input: pieces (size, quantity) and stock boards (length, quantity, price).
- Multiple optimization objectives selectable by the user.
- Solver uses heuristics implemented in JavaScript for speed; exact/ILP solvers require WASM or a backend and are considered optional future work.
- Output: a cutting plan (which pieces go on which stock, cut sequence), metrics, and a visual SVG drawing of cuts.
- Export: CSV cut-list, SVG/PDF drawing, JSON solution.

## Data model (JSON)

1D (length-based) input example:

```json
{
  "pieces": [
    {"id":"p1","length_mm":1200,"quantity":4},
    {"id":"p2","length_mm":300,"quantity":10}
  ],
  "stocks": [
    {"id":"s1","length_mm":4800,"quantity":10,"price":25.0},
    {"id":"s2","length_mm":3600,"quantity":5,"price":18.0}
  ],
  "kerf_mm": 3.0,
  "objective":"min_waste",
  "time_limit_seconds":30
}
```

2D (sheet/board) input example (extension):

```json
{
  "pieces": [
    {"id":"p1","w_mm":300,"h_mm":600,"quantity":2},
    {"id":"p2","w_mm":1200,"h_mm":400,"quantity":6}
  ],
  "stocks": [
    {"id":"s1","w_mm":2440,"h_mm":1220,"quantity":20,"price":45.0}
  ],
  "kerf_mm": 3.0,
  "allow_rotation": true,
  "objective":"min_source_boards"
}
```

Output schema (summary):

```json
{
  "solution": {
    "boards": [
      {
        "stock_id":"s1",
        "board_index":1,
        "cuts":[ {"piece_id":"p2","length_mm":300,"pos_mm":0}, ... ],
        "waste_mm":90,
        "total_price":25.0
      }
    ],
    "metrics": {"total_waste_mm":420, "total_cuts":12, "total_price":250.0, "boards_used":8}
  }
}
```

Each `cuts` entry contains the assigned piece id, its dimension, and the position (for drawing). For 2D the `pos` becomes `{x,y}` and width/height are present.

## Optimization objectives and scoring

- `min_waste` — minimize total leftover material.
- `min_cuts` — minimize total number of saw cuts (useful when cuts are costly or slow).
- `min_price` — minimize total purchase price given per-stock prices and limited stock quantities.
- `min_source_boards` — minimize number of source boards used (bin-packing objective).

Composite objectives and weighted scoring are supported in later versions (e.g., 70% waste + 30% price).

## Algorithms

General approach: treat the problem as a cutting-stock / bin-packing variant. Use heuristics for speed and exact methods for small instances.

1D solver options:
- Heuristic: First-Fit Decreasing (FFD) adapted to account for kerf. Sort pieces largest-first and place into the first stock remainder that fits (accounting for kerf per cut). Fast and usually good.
- Local improvement: after initial assignment, run local merges and re-packing to reduce number of boards or waste (best-fit swaps).
- Exact/ILP: for small to medium instances (e.g., <= 100 piece types, low multiplicity) use integer linear programming (column generation when needed). Use a time limit (configurable) and fallback to heuristic if time limit is exceeded.

2D solver (extension):
- Guillotine or MaxRects packing heuristics for fast results.
- ILP or guillotine-tree search for higher-quality solutions at small scale.

Notes on kerf and cuts:
- Kerf is consumed for each cut; when placing N pieces on a board, total kerf consumed = kerf_mm * (N - 1) for linear cuts (subject to arrangement). The solver must account for kerf when checking fit.

Objective-specific solver tweaks:
- `min_cuts`: penalize assignments that produce many small fragments; prefer assignments with fewer pieces per board but arranged to minimize cut count.
- `min_price`: treat price as cost per board used; solver will prefer using cheaper stock first. If stock quantity is limited, treat as hard constraint.

## Drawing / Visualization

- Representation: the solver produces absolute positions for each piece on a source board.
- For 1D: draw each board as a horizontal bar of length = stock length; draw vertical cut lines and color segments per piece.
- For 2D: generate an SVG with rectangles for pieces and cut lines.
- UI features: zoom/pan, hover tooltips showing piece id/size, highlight waste segments, toggle kerf lines on/off, click a board to expand a printable cut-list.

Drawing generation options (client-side):
- The client generates the coordinate layout and renders an interactive SVG/Canvas for responsiveness and interactivity.
- For heavy drawing or export, generate an SVG string in `js/drawing.js` and offer it as a downloadable file.

## UI / UX

Main screen layout (MVP):
- Left column: Inputs
  - Pieces table (add/edit rows, import CSV)
  - Stocks table (stock sizes, quantity, price)
  - Kerf and global options
- Top center: Controls
  - Objective selector (dropdown)
  - Solver type/time limit
  - `Calculate` button (user clicks after each change)
- Center: Visual preview area (SVG)
- Right column: Results & metrics
  - Boards used, total waste, total cuts, total price
  - Export buttons (CSV/SVG/PDF/JSON)

Interaction rules:
- After editing inputs, the user must click `Calculate` to recompute.
- Show a progress indicator while solving and a clear timeout/error message if the solver exceeds time limits.
- Offer a toggle for "auto-calc" (optional) that re-runs on every change (useful for small datasets only).


## Client-only architecture and file layout

This project is a static single-page app. All functionality runs in the browser; the app consists of a small set of static files and optional Web Worker for long-running solves.

Suggested files and responsibilities:
- `index.html` — single-page UI and controls.
- `css/styles.css` — styling.
- `js/app.js` — UI wiring, state management, input validation, and event handling.
- `js/solver.js` — core solver (FF D + local improvements) as an ES module.
- `js/worker-solver.js` — optional Web Worker wrapper that imports `solver.js` and posts progress/best-so-far messages.
- `js/drawing.js` — SVG layout and rendering helpers.
- `data/samples/*.json` — example input datasets.

Runtime flow:
- `app.js` validates user input and calls `solve(input)` from `solver.js`.
- For small jobs, `solve` runs in the main thread and returns a solution object. For large jobs, `app.js` spawns `worker-solver.js` which runs `solve` in a worker and posts periodic updates.
- `drawing.js` renders the returned `solution.boards` as SVG and provides a CSV/SVG/JSON export UI using client-side Blob downloads.

Persistence and sharing:
- Save/load configurations using `localStorage` and import/export JSON files for sharing.

Notes on advanced solvers:
- Exact integer programming or OR-Tools require either a WASM build or a server-side component. For the pure client MVP we implement high-quality heuristics in JavaScript and optionally integrate WASM later.

## Technology choices


## Technology choices

- Vanilla ES Modules and modern browser APIs for zero-build MVP and fast iteration.
- Optional lightweight frameworks: Preact, Vue, or React if the project grows in complexity.
- Drawing: native SVG (DOM) or `d3` for convenience; plain SVG is sufficient for the MVP.
- For production packaging, a static build (Vite/parcel) is optional if using a framework.

## Performance and heuristics

- Heuristic solves are fast in JS for typical small-to-medium inputs; use a Web Worker for larger inputs to keep UI responsive.
- Provide a time-limited, best-so-far mode: the worker posts intermediate solutions so the UI shows progress.

## Testing and validation

- Browser-based unit tests (Jest with jsdom or browser-run tests) for the solver and drawing coordinate correctness.
- Integration smoke tests in the browser for representative sample datasets.

## Performance and heuristics

- Default mode: run fast heuristic (FFD + local improvement) and return results under 1s for typical small jobs.
- When user selects high-quality or exact solver, impose a configurable time limit (e.g., 30s) and show intermediate / best-so-far solution.
- Cache recent solves by hash of input to avoid re-computation.

## Testing and validation

- Unit tests for:
  - Fit-checking (kerf-aware), packing heuristics, and objective calculations.
  - SVG/layout generation (coordinates are inside board, no overlap).
- Integration tests with representative datasets (small/medium/large).

## Exports & integrations

- CSV cut lists (board id, piece id, piece length, cut order).
- SVG/PDF drawings for shop printing.
- JSON for programmatic consumption.

## Example quick scenario

- Input: pieces 4×1200mm, 10×300mm; stocks 10×4800mm @ $25.
- Objective: `min_waste`.
- Expected output: assignment of pieces into boards with minimal total leftover, SVG showing cut lines and a CSV with per-board cut lists.

## Roadmap / Implementation tasks (client-first)

1. Implement input model and validators in `js/app.js` and sample JSON files.
2. Implement 1D heuristic solver in `js/solver.js` (FFD + local improvement).
3. Implement `js/drawing.js` to produce an SVG layout for the solution.
4. Wire up `index.html` and UI controls in `js/app.js`.
5. Add Web Worker wrapper `js/worker-solver.js` for long-running solves and progress updates.
6. Add client-side exports (CSV/SVG/JSON) and sample datasets.
7. Add tests and performance notes.

## Open questions / decisions for the user

- Do you want the MVP to focus strictly on 1D-length cutting, or should I implement 2D sheet cutting from the start?
- Preferred stack for frontend (plain JS vs React)?
- Any constraints on stock sourcing (infinite stock vs limited quantities) or price models (bulk discounts)?

---

If you'd like, I can next: implement the 1D heuristic solver, scaffold the API in `agent/main.py`, or produce a small interactive HTML preview. Tell me which task to start.
