import React, { useEffect } from 'react'
import { initOptimizer } from '../features/optimizer.js'

export default function OptimizerView() {
  useEffect(() => {
    try { initOptimizer(); } catch (e) { console.error(e); }
  }, []);

  return (
    <main className="layout">
      <section className="panel inputs">
        <h2 className="no-print">Input</h2>

        <div className="controls top-controls">
          <label>Kerf (mm): <input id="kerf" type="number" defaultValue={3} step="0.1" /></label>
          <label>Objective:
            <select id="objective">
              <option value="min_price" selected>Minimize Price</option>
              <option value="min_waste">Minimize Waste</option>
              <option value="min_cuts">Minimize Cuts</option>
              <option value="min_source_boards">Minimize Source Boards</option>
            </select>
          </label>
          <label><input id="chk-use-worker" type="checkbox" /> Use Web Worker</label>
          <label><input id="chk-auto-calc" type="checkbox" /> Auto-calc</label>
        </div>

        <div className="controls">
          <div className="buttons">
            <button id="btn-load-sample">Load Sample</button>
            <button id="btn-save-config">Save</button>
            <button id="btn-load-saved">Load Saved</button>
            <button id="btn-calc">Calculate</button>
          </div>
        </div>

        <div className="controls presets">
          <h3 className="no-print">Presets</h3>
          <div className="preset-controls">
            <div className="paste-area">
              <h4>Paste Pieces</h4>
              <textarea id="paste-pieces" placeholder="e.g.\n5 580x300\n2 580x100"></textarea>
              <div><button id="btn-import-pieces">Import Pieces</button></div>
            </div>

            <div className="paste-area">
              <h4>Paste Stocks / Prices</h4>
              <textarea id="paste-stocks" placeholder="e.g.\n2000x400 58.90\n2200x600 68.50"></textarea>
              <div><button id="btn-import-stocks">Import Stocks</button></div>
            </div>
          </div>
        </div>

        <div className="editor">
          <h3>Pieces</h3>
          <div className="editor-table">
            <table id="pieces-table">
              <thead><tr><th>ID</th><th>Width (mm)</th><th>Height (mm)</th><th>Quantity</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
            <button id="btn-add-piece" className="no-print">Add Piece</button>
          </div>

          <h3>Stocks</h3>
          <div className="editor-table">
            <table id="stocks-table">
              <thead><tr><th>ID</th><th>Width (mm)</th><th>Height (mm)</th><th>Quantity</th><th>Unlimited</th><th>Price</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
            <button id="btn-add-stock" className="no-print">Add Stock</button>
          </div>

          <h3 className="no-print">Raw JSON</h3>
          <textarea id="input-json" spellCheck={false}></textarea>
        </div>

        <div className="status-row no-print">
          <span id="status">Ready</span>
          <progress id="calc-progress" value={0} max={100} style={{width:'100%',display:'none',marginTop:8}}></progress>
          <span id="progress-text" style={{display:'inline-block',marginTop:6,color:'#666',fontSize:13}}></span>
        </div>
      </section>

      <section className="panel preview">
        <h2>Preview</h2>
        <div id="svg-container" className="svg-wrap"></div>
      </section>

      <section className="panel results no-print">
        <h2>Metrics</h2>
        <pre id="metrics">No results yet.</pre>
        <div className="exports">
          <button id="btn-export-json">Export JSON</button>
          <button id="btn-export-csv">Export CSV</button>
          <button id="btn-export-svg">Export SVG</button>
        </div>
      </section>
    </main>
  )
}
