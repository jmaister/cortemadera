// 2D Guillotine-style packer (simple, conservative) in TypeScript
export function solve(input: any, progressCb?: (info: any) => void){
  const objective = input.objective || 'min_price';
  const stocks = (input.stocks || []).map((s: any) => ({
    id: s.id,
    width_mm: s.width_mm,
    height_mm: s.height_mm,
    quantity: s.quantity || 0,
    price: s.price || 0
  }));
  const piecesIn = input.pieces || [];

  const pieces: Array<{piece_id:string, width_mm:number, height_mm:number}> = [];
  for(const p of piecesIn){
    const q = p.quantity || 1;
    for(let i=0;i<q;i++) pieces.push({piece_id: p.id, width_mm: p.width_mm, height_mm: p.height_mm});
  }

  // sort by area desc
  pieces.sort((a,b)=> (b.width_mm * b.height_mm) - (a.width_mm * a.height_mm));

  const stockCounts: Record<string,number> = {};
  for(const s of stocks) stockCounts[s.id] = s.quantity || 0;

  const boards: Array<any> = [];
  const unassigned: Array<any> = [];

  function pruneFreeRects(rects: any[]){
    let r = rects.filter((r:any)=> r.w > 0 && r.h > 0);
    // remove rects contained in others
    for(let i=r.length-1;i>=0;i--){
      for(let j=0;j<r.length;j++){
        if(i===j) continue;
        const a = r[i], b = r[j];
        if(a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9){
          r.splice(i,1); break;
        }
      }
    }
    return r;
  }

  function findFitRect(board: any, pw: number, ph: number){
    let bestIdx = -1; let bestScore = Infinity;
    for(let i=0;i<board.freeRects.length;i++){
      const fr = board.freeRects[i];
      if(pw <= fr.w + 1e-9 && ph <= fr.h + 1e-9){
        const score = (fr.w * fr.h) - (pw * ph);
        if(score < bestScore){ bestScore = score; bestIdx = i; }
      }
    }
    return bestIdx;
  }

  function createBoardFor(pw: number, ph: number){
    const candidates = stocks.filter((s:any) => s.width_mm >= pw && s.height_mm >= ph && (stockCounts[s.id]||0) > 0);
    if(candidates.length === 0) return null;
    let s: any;
    if(objective === 'min_price'){
      candidates.sort((a:any,b:any)=> (a.price||0) - (b.price||0));
      s = candidates[0];
    } else if(objective === 'min_source_boards'){
      candidates.sort((a:any,b:any)=> (b.width_mm*b.height_mm) - (a.width_mm*a.height_mm));
      s = candidates[0];
    } else {
      candidates.sort((a:any,b:any)=> (a.width_mm*a.height_mm) - (b.width_mm*b.height_mm));
      s = candidates[0];
    }
    stockCounts[s.id] = (stockCounts[s.id]||0) - 1;
    const b = {stock_id: s.id, stock_width_mm: s.width_mm, stock_height_mm: s.height_mm, placements: [], price: s.price||0, freeRects: [{x:0,y:0,w:s.width_mm,h:s.height_mm}] };
    boards.push(b);
    return b;
  }

  for(let pi=0; pi<pieces.length; pi++){
    const p = pieces[pi];
    let placed = false;
    // try existing boards
    for(const b of boards){
      const idx = findFitRect(b, p.width_mm, p.height_mm);
      if(idx >= 0){
        const fr = b.freeRects.splice(idx,1)[0];
        const px = fr.x, py = fr.y;
        b.placements.push({piece_id: p.piece_id, width_mm: p.width_mm, height_mm: p.height_mm, x_mm: px, y_mm: py});
        // split guillotine: right and bottom
        const right = {x: px + p.width_mm, y: py, w: fr.w - p.width_mm, h: p.height_mm};
        const bottom = {x: px, y: py + p.height_mm, w: fr.w, h: fr.h - p.height_mm};
        if(right.w > 0 && right.h > 0) b.freeRects.push(right);
        if(bottom.w > 0 && bottom.h > 0) b.freeRects.push(bottom);
        b.freeRects = pruneFreeRects(b.freeRects);
        placed = true; break;
      }
    }
    if(!placed){
      const nb = createBoardFor(p.width_mm, p.height_mm);
      if(nb){
        const fr = nb.freeRects.splice(0,1)[0];
        nb.placements.push({piece_id: p.piece_id, width_mm: p.width_mm, height_mm: p.height_mm, x_mm: fr.x, y_mm: fr.y});
        const right = {x: fr.x + p.width_mm, y: fr.y, w: fr.w - p.width_mm, h: p.height_mm};
        const bottom = {x: fr.x, y: fr.y + p.height_mm, w: fr.w, h: fr.h - p.height_mm};
        if(right.w > 0 && right.h > 0) nb.freeRects.push(right);
        if(bottom.w > 0 && bottom.h > 0) nb.freeRects.push(bottom);
        nb.freeRects = pruneFreeRects(nb.freeRects);
        placed = true;
      } else {
        unassigned.push(p);
      }
    }
    // report progress
    try{ if(progressCb) progressCb({percent: Math.round(((pi+1)/pieces.length)*100), processed: pi+1, total: pieces.length}); }catch(e){}
  }
 
  const outBoards = boards.map((b:any, idx:number)=>{
    const usedArea = b.placements.reduce((s:number,p:any)=> s + (p.width_mm * p.height_mm), 0);
    const stockArea = (b.stock_width_mm || 0) * (b.stock_height_mm || 0);
    const waste = Math.max(0, stockArea - usedArea);
    return {
      stock_id: b.stock_id,
      board_index: idx + 1,
      stock_width_mm: b.stock_width_mm,
      stock_height_mm: b.stock_height_mm,
      placements: b.placements,
      waste_mm2: Math.round(waste * 100) / 100,
      total_price: b.price || 0
    };
  });

  const metrics = {
    total_waste_mm2: outBoards.reduce((s:any,b:any)=> s + (b.waste_mm2 || 0), 0),
    boards_used: outBoards.length,
    total_price: outBoards.reduce((s:any,b:any)=> s + (b.total_price || 0), 0)
  };

  if(progressCb) try{ progressCb({percent:100, processed: pieces.length, total: pieces.length}); }catch(e){}
  return {solution: {boards: outBoards, metrics}, unassigned};
}

export default {solve};
