import React, { useEffect } from 'react'
import { initShelfCalculator } from '../features/shelf.js'

export default function ShelfView() {
  useEffect(() => {
    try { initShelfCalculator(); } catch (e) { console.error(e); }
  }, []);

  return (
    <main className="shelf-layout">
      <section className="panel shelf-inputs">
        <h2>Complete Shelf Calculator</h2>
        <p className="muted-block">Enter the cabinet dimensions and the calculator will show the shelf spacing, placement heights, and the pieces to cut in one view.</p>
        <div className="shelf-controls">
          <label>Shelf height (mm): <input id="shelf-cabinet-height" type="number" defaultValue={2000} step="1" /></label>
          <label>Shelf width (mm): <input id="shelf-width" type="number" defaultValue={800} step="1" /></label>
          <label>Kick toe (mm): <input id="shelf-kick-toe" type="number" defaultValue={100} step="1" /></label>
          <label>Top clearance (mm): <input id="shelf-top-clearance" type="number" defaultValue={0} step="1" /></label>
          <label>Shelf thickness (mm): <input id="shelf-thickness" type="number" defaultValue={18} step="0.1" /></label>
          <label>Number of shelves: <input id="shelf-count" type="number" defaultValue={4} step="1" min="0" /></label>
          <label>Decorative top height (mm): <input id="shelf-decorative-top-height" type="number" defaultValue={250} step="1" /></label>
          <label><input id="shelf-include-decorative-top" type="checkbox" defaultChecked /> Include decorative top piece</label>
        </div>
        <div id="shelf-summary" className="muted-block"></div>
      </section>

      <section className="panel shelf-preview">
        <h2>View</h2>
        <div id="shelf-svg" className="svg-wrap"></div>
      </section>

      <section className="panel shelf-results">
        <h2>Measurements</h2>
        <div className="table-wrap">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Shelf</th>
                <th>Height from floor (mm)</th>
                <th>Height from kick toe (mm)</th>
                <th>Distance to top (mm)</th>
                <th>Thickness (mm)</th>
              </tr>
            </thead>
            <tbody id="shelf-table-body"></tbody>
          </table>
        </div>

        <h3>Cut pieces</h3>
        <div className="table-wrap">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Piece</th>
                <th>Width (mm)</th>
                <th>Height (mm)</th>
                <th>Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="shelf-piece-table-body"></tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
