import React, { useEffect, useRef, useState, useMemo } from 'react'
import { calculateShelves } from '../features/shelf.js'
import { solve } from '../solver.js'
import { renderSolution } from '../drawing.js'

type StockRow = { id: string; width_mm: number; height_mm: number; quantity: number; price?: number }

export default function CompleteShelfView() {
  const [cabinetHeight, setCabinetHeight] = useState(2000)
  const [shelfWidth, setShelfWidth] = useState(800)
  const [kickToe, setKickToe] = useState(100)
  const [topClear, setTopClear] = useState(0)
  const [thickness, setThickness] = useState(18)
  const [count, setCount] = useState(4)
  const [includeDecorative, setIncludeDecorative] = useState(true)
  const [decorHeight, setDecorHeight] = useState(250)

  const [stocks, setStocks] = useState<StockRow[]>([{ id: 'S1', width_mm: 2400, height_mm: 1220, quantity: 1, price: 0 }])
  const svgRef = useRef<HTMLDivElement | null>(null)
  const [lastSolution, setLastSolution] = useState<any>(null)
  const [status, setStatus] = useState<string>('Idle')
  const [autoRun, setAutoRun] = useState<boolean>(true)
  const debounceRef = useRef<number | null>(null)

  const shelfResult = useMemo(() => calculateShelves({
    cabinet_height_mm: cabinetHeight,
    shelf_width_mm: shelfWidth,
    kick_toe_mm: kickToe,
    shelf_count: count,
    top_clearance_mm: topClear,
    shelf_thickness_mm: thickness,
    decorative_top_height_mm: decorHeight,
    include_decorative_top: includeDecorative
  }), [cabinetHeight, shelfWidth, kickToe, count, topClear, thickness, decorHeight, includeDecorative])

  function addStock() {
    setStocks((s) => [...s, { id: `S${s.length+1}`, width_mm: 2400, height_mm: 1220, quantity: 1 }])
  }

  function updateStock(idx: number, patch: Partial<StockRow>) {
    setStocks((s) => s.map((r,i)=> i===idx ? {...r, ...patch} : r))
  }

  function runOptimizer() {
    if (!shelfWidth || !cabinetHeight) {
      setStatus('Invalid shelf dimensions')
      setLastSolution(null)
      if (svgRef.current) svgRef.current.innerHTML = '<p>Enter valid shelf dimensions.</p>'
      return
    }

    const pieces = shelfResult.pieces.map((p) => ({ id: p.name, width_mm: p.width_mm, height_mm: p.height_mm, quantity: p.quantity }))
    const input = { pieces, stocks: stocks.map(s => ({ id: s.id, width_mm: s.width_mm, height_mm: s.height_mm, quantity: s.quantity, price: s.price || 0 })) }

    try {
      setStatus('Solving...')
      const result = solve(input)
      const sol = result.solution
      setLastSolution(sol)
      if (svgRef.current) renderSolution(svgRef.current, sol, {})
      setStatus('Done')
    } catch (e) {
      console.error(e)
      setStatus('Error')
      setLastSolution(null)
    }
  }

  useEffect(()=>{
    if(svgRef.current) svgRef.current.innerHTML = '<p>No solution yet.</p>'
    if (autoRun) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => runOptimizer(), 300)
    }
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRun) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => runOptimizer(), 350)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [shelfResult, stocks, autoRun])

  return (
    <main className="shelf-complete layout">
      <section className="panel inputs">
        <h2>Complete Shelf → Cut Optimizer</h2>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <label style={{display:'inline-flex',alignItems:'center',gap:8}}><input type="checkbox" checked={autoRun} onChange={(e)=>setAutoRun(e.target.checked)} /> Auto-run</label>
          <div style={{color:'#666'}}>Status: {status}</div>
        </div>

        <div className="controls shelf-controls">
          <label>Cabinet height (mm): <input type="number" value={cabinetHeight} onChange={(e)=>setCabinetHeight(Number(e.target.value)||0)} /></label>
          <label>Shelf width (mm): <input type="number" value={shelfWidth} onChange={(e)=>setShelfWidth(Number(e.target.value)||0)} /></label>
          <label>Kick toe (mm): <input type="number" value={kickToe} onChange={(e)=>setKickToe(Number(e.target.value)||0)} /></label>
          <label>Top clearance (mm): <input type="number" value={topClear} onChange={(e)=>setTopClear(Number(e.target.value)||0)} /></label>
          <label>Shelf thickness (mm): <input type="number" value={thickness} onChange={(e)=>setThickness(Number(e.target.value)||0)} /></label>
          <label>Number of shelves: <input type="number" value={count} onChange={(e)=>setCount(Number(e.target.value)||0)} /></label>
          <label>Decorative top height (mm): <input type="number" value={decorHeight} onChange={(e)=>setDecorHeight(Number(e.target.value)||0)} /></label>
          <label><input type="checkbox" checked={includeDecorative} onChange={(e)=>setIncludeDecorative(e.target.checked)} /> Include decorative top</label>
        </div>

        <h3>Stocks</h3>
        <div className="editor-table">
          <table>
            <thead><tr><th>ID</th><th>Width</th><th>Height</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>
              {stocks.map((s,idx)=> (
                <tr key={idx}>
                  <td><input value={s.id} onChange={(e)=>updateStock(idx,{id:e.target.value})} /></td>
                  <td><input type="number" value={s.width_mm} onChange={(e)=>updateStock(idx,{width_mm: Number(e.target.value)||0})} /></td>
                  <td><input type="number" value={s.height_mm} onChange={(e)=>updateStock(idx,{height_mm: Number(e.target.value)||0})} /></td>
                  <td><input type="number" value={s.quantity} onChange={(e)=>updateStock(idx,{quantity: Number(e.target.value)||0})} /></td>
                  <td><input type="number" step="0.01" value={s.price||0} onChange={(e)=>updateStock(idx,{price: Number(e.target.value)||0})} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><button onClick={addStock}>Add stock</button></div>
        </div>

        <div style={{marginTop:12}}>
          <button onClick={runOptimizer}>Calculate cutting layout</button>
        </div>
      </section>

      <section className="panel preview">
        <h2>Layout Preview</h2>
        <div id="svg-container" ref={svgRef} className="svg-wrap"></div>
      </section>

      <section className="panel results">
        <h2>Pieces from shelf</h2>
        <div className="table-wrap">
          <table className="simple-table">
            <thead><tr><th>Piece</th><th>W (mm)</th><th>H (mm)</th><th>Qty</th></tr></thead>
            <tbody>
              {shelfResult.pieces.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td>{p.width_mm}</td><td>{p.height_mm}</td><td>{p.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Solution</h3>
        <pre>{lastSolution ? JSON.stringify(lastSolution.metrics, null, 2) : 'No solution yet.'}</pre>
      </section>
    </main>
  )
}

