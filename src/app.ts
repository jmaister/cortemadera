import { solve } from './solver'
import { renderSolution, getSvgString } from './drawing'

export function initApp(): void{
  const inputArea = document.getElementById('input-json') as HTMLTextAreaElement;
  const btnCalc = document.getElementById('btn-calc') as HTMLButtonElement;
  const btnLoadSample = document.getElementById('btn-load-sample') as HTMLButtonElement;
  const btnSaveConfig = document.getElementById('btn-save-config') as HTMLButtonElement;
  const btnLoadSaved = document.getElementById('btn-load-saved') as HTMLButtonElement;
  const pastePiecesArea = document.getElementById('paste-pieces') as HTMLTextAreaElement | null;
  const btnImportPieces = document.getElementById('btn-import-pieces') as HTMLButtonElement | null;
  const pasteStocksArea = document.getElementById('paste-stocks') as HTMLTextAreaElement | null;
  const btnImportStocks = document.getElementById('btn-import-stocks') as HTMLButtonElement | null;
  const svgContainer = document.getElementById('svg-container') as HTMLElement;
  const metricsPre = document.getElementById('metrics') as HTMLElement;
  const piecesTable = document.getElementById('pieces-table')!.querySelector('tbody') as HTMLElement;
  const stocksTable = document.getElementById('stocks-table')!.querySelector('tbody') as HTMLElement;
  const btnAddPiece = document.getElementById('btn-add-piece') as HTMLButtonElement;
  const btnAddStock = document.getElementById('btn-add-stock') as HTMLButtonElement;
  const chkUseWorker = document.getElementById('chk-use-worker') as HTMLInputElement;
  const chkAutoCalc = document.getElementById('chk-auto-calc') as HTMLInputElement;
  const statusEl = document.getElementById('status') as HTMLElement;
  const progressEl = document.getElementById('calc-progress') as HTMLProgressElement | null;
  const progressText = document.getElementById('progress-text') as HTMLElement | null;

  let lastSolution: any = null;
  let worker: Worker | null = null;
  let autoCalcTimer: any = null;

  function setStatus(text: string){ statusEl.textContent = text; }

  function setProgress(percent: number | null, label?: string){
    if(!progressEl || !progressText) return;
    if(percent === null){ progressEl.style.display = 'none'; progressText.textContent = ''; return; }
    progressEl.style.display = 'block';
    progressEl.value = Math.max(0, Math.min(100, percent));
    progressText.textContent = label ? label : `${Math.round(percent)}%`;
  }

  function downloadBlob(blob: Blob, filename: string){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function createPieceRow(id = '', width = '', height = '', qty = 1){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="p-id" value="${id}"></td>
      <td><input class="p-width" type="number" value="${width}"></td>
      <td><input class="p-height" type="number" value="${height}"></td>
      <td><input class="p-qty" type="number" value="${qty}"></td>
      <td><button class="rm">Remove</button></td>`;
    (tr.querySelector('.rm') as HTMLButtonElement).addEventListener('click', ()=>{ tr.remove(); triggerAutoCalc(); updateJsonFromTables(); });
    // Add change listeners to all inputs
    tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', ()=>{ triggerAutoCalc(); updateJsonFromTables(); }));
    piecesTable.appendChild(tr);
  }

  function createStockRow(id = '', width = '', height = '', qty = 0, price = 0, unlimited = true){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="s-id" value="${id}"></td>
      <td><input class="s-width" type="number" value="${width}"></td>
      <td><input class="s-height" type="number" value="${height}"></td>
      <td><input class="s-qty" type="number" value="${qty}"></td>
      <td><input class="s-unlimited" type="checkbox" ${unlimited ? 'checked' : ''}></td>
      <td><input class="s-price" type="number" step="0.01" value="${price}"></td>
      <td><button class="rm">Remove</button></td>`;
    (tr.querySelector('.rm') as HTMLButtonElement).addEventListener('click', ()=>{ tr.remove(); triggerAutoCalc(); updateJsonFromTables(); });
    // Add change listeners to all inputs
    tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', ()=>{ triggerAutoCalc(); updateJsonFromTables(); }));
    // Disable quantity input when unlimited is checked
    const unlimitedChk = tr.querySelector('.s-unlimited') as HTMLInputElement;
    const qtyInput = tr.querySelector('.s-qty') as HTMLInputElement;
    unlimitedChk.addEventListener('change', ()=>{ qtyInput.disabled = unlimitedChk.checked; });
    if(unlimited) qtyInput.disabled = true;
    stocksTable.appendChild(tr);
  }

  function clearTables(){ piecesTable.innerHTML = ''; stocksTable.innerHTML = ''; }

  function readTables(){
    const pieces: any[] = [];
    let pieceCounter = 1;
    for(const r of Array.from(piecesTable.querySelectorAll('tr'))){
      let id = (r.querySelector('.p-id') as HTMLInputElement).value || '';
      const width = Number((r.querySelector('.p-width') as HTMLInputElement).value) || 0;
      const height = Number((r.querySelector('.p-height') as HTMLInputElement).value) || 0;
      const qty = parseInt((r.querySelector('.p-qty') as HTMLInputElement).value) || 1;
      if(width>0 && height>0 && qty>0) {
        if(!id) id = `piece-${pieceCounter++}`;
        pieces.push({id, width_mm: width, height_mm: height, quantity: qty});
      }
    }
    const stocks: any[] = [];
    let stockCounter = 1;
    for(const r of Array.from(stocksTable.querySelectorAll('tr'))){
      let id = (r.querySelector('.s-id') as HTMLInputElement).value || '';
      const width = Number((r.querySelector('.s-width') as HTMLInputElement).value) || 0;
      const height = Number((r.querySelector('.s-height') as HTMLInputElement).value) || 0;
      let qty = parseInt((r.querySelector('.s-qty') as HTMLInputElement).value) || 0;
      const unlimited = (r.querySelector('.s-unlimited') as HTMLInputElement)?.checked || false;
      const price = parseFloat((r.querySelector('.s-price') as HTMLInputElement).value) || 0;
      if(width>0 && height>0) {
        if(!id) id = `stock-${stockCounter++}`;
        // If unlimited is checked, set quantity to a very high number
        if(unlimited) qty = 9999;
        stocks.push({id, width_mm: width, height_mm: height, quantity: qty, price});
      }
    }
    return {pieces, stocks};
  }

  function updateJsonFromTables(){
    const data = readTables();
    const obj = {pieces: data.pieces, stocks: data.stocks, kerf_mm: parseFloat((document.getElementById('kerf') as HTMLInputElement).value)||0, objective: (document.getElementById('objective') as HTMLSelectElement).value};
    inputArea.value = JSON.stringify(obj, null, 2);
  }

  function populateTablesFromInput(obj: any){
    clearTables();
    const pieces = obj.pieces || [];
    for(const p of pieces) createPieceRow(p.id || p.piece_id || '', p.width_mm || p.width || 0, p.height_mm || p.height || 0, p.quantity || 1);
    const stocks = obj.stocks || [];
    for(const s of stocks) {
      const hasQty = Object.prototype.hasOwnProperty.call(s, 'quantity');
      const unlimited = !hasQty || (s.quantity >= 9999);
      const qty = unlimited ? 0 : (s.quantity || 0);
      createStockRow(s.id || '', s.width_mm || s.width || 0, s.height_mm || s.height || 0, qty, s.price || 0, unlimited);
    }
    inputArea.value = JSON.stringify(obj, null, 2);
  }

  async function loadSample(){
    try{
      const res = await fetch('data/sample.json');
      const j = await res.json();
      populateTablesFromInput(j);
      setStatus('Sample loaded');
      triggerAutoCalc();
    }catch(e){ setStatus('Failed to load sample'); }
  }

  

  function parsePiecesText(text: string){
    if(!text) return 0;
    const lines = text.split(/\r?\n/);
    let added = 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for(const raw of lines){
      const line = raw.trim(); if(!line) continue;
      const parts = line.split(/\s+/);
      let qty = 1; let dimToken = '';
      if(parts.length >= 2 && /^\d+$/.test(parts[0]) && /[x×X]/.test(parts[1])){ qty = parseInt(parts[0]); dimToken = parts[1]; }
      else if(parts.length >= 1 && /[x×X]/.test(parts[0])){ dimToken = parts[0]; }
      else continue;
      const m = dimToken.match(/^(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)$/);
      if(!m) continue;
      const w = Math.round(Number(m[1])); const h = Math.round(Number(m[2]));
      const id = alphabet[added % alphabet.length] || 'P';
      createPieceRow(id, w, h, qty);
      added++;
    }
    if(added) { updateJsonFromTables(); triggerAutoCalc(); setStatus(`Imported ${added} piece lines`); }
    return added;
  }

  function parseStocksText(text: string){
    if(!text) return 0;
    const lines = text.split(/\r?\n/);
    let added = 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for(const raw of lines){
      const line = raw.trim(); if(!line) continue;
      const parts = line.split(/\s+/);
      // expect: SIZE PRICE [QTY]
      let dimToken = parts[0]; let price = 0; let qty = 0; let unlimited = true;
      if(parts.length >= 2) price = parseFloat(parts[1]) || 0;
      if(parts.length >= 3 && /^\d+$/.test(parts[2])) { qty = parseInt(parts[2]); unlimited = false; }
      const m = dimToken.match(/^(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)$/);
      if(!m) continue;
      const w = Math.round(Number(m[1])); const h = Math.round(Number(m[2]));
      const id = alphabet[added % alphabet.length] + alphabet[added % alphabet.length];
      createStockRow(id, w, h, qty, price, unlimited);
      added++;
    }
    if(added){ updateJsonFromTables(); triggerAutoCalc(); setStatus(`Imported ${added} stock lines`); }
    return added;
  }

  function saveConfig(){
    try{ const obj = JSON.parse(inputArea.value); localStorage.setItem('woodcut_config', JSON.stringify(obj)); setStatus('Config saved'); }catch(e){ setStatus('Invalid JSON, not saved'); }
  }

  function loadSaved(){
    try{ const raw = localStorage.getItem('woodcut_config'); if(!raw){ setStatus('No saved config'); return; } const obj = JSON.parse(raw); populateTablesFromInput(obj); setStatus('Saved config loaded'); triggerAutoCalc(); }catch(e){ setStatus('Failed to load saved config'); }
  }

  function triggerAutoCalc(){ if(chkAutoCalc.checked){ clearTimeout(autoCalcTimer); autoCalcTimer = setTimeout(()=> btnCalc.click(), 350); } else { updateJsonFromTables(); } }

  btnAddPiece.addEventListener('click', ()=>{ createPieceRow('', '', '', 1); updateJsonFromTables(); });
  btnAddStock.addEventListener('click', ()=>{ createStockRow('', '', '', 0, 0, true); updateJsonFromTables(); });
  btnLoadSample.addEventListener('click', loadSample);
  if(btnImportPieces && pastePiecesArea) btnImportPieces.addEventListener('click', ()=> parsePiecesText(pastePiecesArea.value));
  if(btnImportStocks && pasteStocksArea) btnImportStocks.addEventListener('click', ()=> parseStocksText(pasteStocksArea.value));
  btnSaveConfig.addEventListener('click', saveConfig);
  btnLoadSaved.addEventListener('click', loadSaved);
  
  // Auto-calc when objective or kerf changes
  (document.getElementById('objective') as HTMLSelectElement).addEventListener('change', triggerAutoCalc);
  (document.getElementById('kerf') as HTMLInputElement).addEventListener('change', triggerAutoCalc);

  function useWorker(){
    if(!worker){
      worker = new Worker(new URL('./worker-solver.ts', import.meta.url), {type: 'module'});
      worker.addEventListener('message', (e: MessageEvent)=>{
        const msg = e.data;
        if(msg.type === 'result'){
          const result = msg.result;
          lastSolution = result.solution;
          renderSolution(svgContainer, lastSolution, {});
          
          // Enhanced metrics with stock summary (grouped by size)
          const sizeCounts: Record<string, number> = {};
          for(const b of lastSolution.boards) {
            const key = `${b.stock_width_mm}x${b.stock_height_mm}`;
            sizeCounts[key] = (sizeCounts[key] || 0) + 1;
          }
          const stockSummary = Object.entries(sizeCounts).map(([size, count]) => `  ${size} mm quantity: ${count}`).join('\n');
          
          metricsPre.textContent = JSON.stringify(lastSolution.metrics, null, 2);
          metricsPre.textContent += '\n\nStocks Needed:\n' + stockSummary;
          if(result.unassigned && result.unassigned.length){ metricsPre.textContent += '\n\nUnassigned pieces:\n' + JSON.stringify(result.unassigned, null, 2); }
          setStatus('Done (worker)');
          setProgress(null);
        } else if(msg.type === 'error'){
          setStatus('Worker error: ' + msg.error);
          setProgress(null);
        } else if(msg.type === 'progress'){
          const p = msg.progress;
          let pct = 0; if(typeof p === 'number') pct = p; else if(p && typeof p === 'object' && p.percent!=null) pct = p.percent;
          setProgress(pct);
        }
      });
    }
  }

  btnCalc.addEventListener('click', ()=>{
    const input = (()=>{ try{ return JSON.parse(inputArea.value); }catch(e){ return null; } })();
    if(!input){ setStatus('Invalid JSON input'); alert('Invalid JSON input'); return; }
    input.kerf_mm = parseFloat((document.getElementById('kerf') as HTMLInputElement).value) || 0;
    input.objective = (document.getElementById('objective') as HTMLSelectElement).value || 'min_price';

    setStatus('Solving...');
    setProgress(0);
    if(chkUseWorker.checked){ useWorker(); worker!.postMessage({type: 'solve', input}); setStatus('Solving (worker)...'); }
    else {
      try{
        const result = solve(input, (prog:any) => {
          let pct = 0; if(typeof prog === 'number') pct = prog; else if(prog && typeof prog === 'object' && prog.percent!=null) pct = prog.percent;
          setProgress(pct);
        });
        lastSolution = result.solution;
        renderSolution(svgContainer, lastSolution, {});
        
        // Enhanced metrics with stock summary (grouped by size)
        const sizeCounts: Record<string, number> = {};
        for(const b of lastSolution.boards) {
          const key = `${b.stock_width_mm}x${b.stock_height_mm}`;
          sizeCounts[key] = (sizeCounts[key] || 0) + 1;
        }
        const stockSummary = Object.entries(sizeCounts).map(([size, count]) => `  ${size} mm quantity: ${count}`).join('\n');
        
        metricsPre.textContent = JSON.stringify(lastSolution.metrics, null, 2);
        metricsPre.textContent += '\n\nStocks Needed:\n' + stockSummary;
        if(result.unassigned && result.unassigned.length){ metricsPre.textContent += '\n\nUnassigned pieces:\n' + JSON.stringify(result.unassigned, null, 2); }
        setStatus('Done');
      }catch(e:any){ setStatus('Error: '+e.message); }
      finally{ setProgress(null); }
    }
    try{ localStorage.setItem('woodcut_config', inputArea.value); }catch(e){}
  });

  document.getElementById('btn-export-json')!.addEventListener('click', ()=>{ if(!lastSolution) return alert('No solution to export'); const b = new Blob([JSON.stringify(lastSolution, null, 2)], {type:'application/json'}); downloadBlob(b, 'solution.json'); });
  document.getElementById('btn-export-csv')!.addEventListener('click', ()=>{ if(!lastSolution) return alert('No solution to export'); let rows = ['board_index,stock_id,piece_id,width_mm,height_mm,x_mm,y_mm']; for(const b of lastSolution.boards){ for(const p of b.placements || []){ rows.push([b.board_index,b.stock_id,p.piece_id,p.width_mm,p.height_mm,p.x_mm,p.y_mm].join(',')); } } const b = new Blob([rows.join('\n')], {type:'text/csv'}); downloadBlob(b, 'cutlist.csv'); });
  document.getElementById('btn-export-svg')!.addEventListener('click', ()=>{ if(!lastSolution) return alert('No solution to export'); const svg = getSvgString(svgContainer, lastSolution, {}); const b = new Blob([svg], {type:'image/svg+xml'}); downloadBlob(b, 'layout.svg'); });

  (function init(){
    const raw = localStorage.getItem('woodcut_config');
    if(raw){
      try{
        const obj = JSON.parse(raw);
        populateTablesFromInput(obj);
        setStatus('Loaded saved config');
      }catch(e){
        loadSample();
      }
    } else {
      loadSample();
    }
  })();
}

export default { initApp };
