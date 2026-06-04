// 2D Guillotine-style packer (simple, conservative) in TypeScript
export function solve(input: any, progressCb?: (info: any) => void){
  const objective = input.objective || 'min_price';
  const allowRotation = input.allow_rotation !== false;
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

  type FitResult = { index: number; rotated: boolean; score: number };

  function findFitRect(board: any, pw: number, ph: number): FitResult | null{
    let best: FitResult | null = null;
    for(let i=0;i<board.freeRects.length;i++){
      const fr = board.freeRects[i];
      if(pw <= fr.w + 1e-9 && ph <= fr.h + 1e-9){
        const score = (fr.w * fr.h) - (pw * ph);
        if(!best || score < best.score) best = {index: i, rotated: false, score};
      }
      if(allowRotation && ph <= fr.w + 1e-9 && pw <= fr.h + 1e-9){
        const score = (fr.w * fr.h) - (pw * ph);
        if(!best || score < best.score) best = {index: i, rotated: true, score};
      }
    }
    return best;
  }

  type StockStrategy = 'min_price' | 'price_per_area' | 'min_waste' | 'max_area';

  function sortCandidates(candidates: any[], pw: number, ph: number, strategy: StockStrategy){
    const pieceArea = pw * ph;
    if(strategy === 'min_price'){
      candidates.sort((a:any,b:any)=> (a.price||0) - (b.price||0) || (b.width_mm*b.height_mm) - (a.width_mm*a.height_mm));
    } else if(strategy === 'price_per_area'){
      candidates.sort((a:any,b:any)=> ((a.price||0) / Math.max(1, a.width_mm*a.height_mm)) - ((b.price||0) / Math.max(1, b.width_mm*b.height_mm)) || (a.price||0) - (b.price||0));
    } else if(strategy === 'max_area'){
      candidates.sort((a:any,b:any)=> (b.width_mm*b.height_mm) - (a.width_mm*a.height_mm));
    } else {
      candidates.sort((a:any,b:any)=> ((a.width_mm*a.height_mm) - pieceArea) - ((b.width_mm*b.height_mm) - pieceArea));
    }
  }

  function runPack(strategy: StockStrategy, reportProgress: boolean){
    const stockCounts: Record<string,number> = {};
    for(const s of stocks) stockCounts[s.id] = s.quantity || 0;

    const boards: Array<any> = [];
    const unassigned: Array<any> = [];

    function createBoardFor(pw: number, ph: number, remainingPieces: any[]){
      const candidates = stocks.filter((s:any) => {
        if((stockCounts[s.id]||0) <= 0) return false;
        if(s.width_mm >= pw && s.height_mm >= ph) return true;
        if(allowRotation && s.width_mm >= ph && s.height_mm >= pw) return true;
        return false;
      });
      if(candidates.length === 0) return null;

      // For min_price, prefer candidate that fits the most remaining pieces per price
      if(strategy === 'min_price'){
        let bestCand: any = null;
        let bestScore = Infinity;
        for(const s of candidates){
          // simulate greedy packing of remaining pieces into this board
          const temp = { freeRects: [{x:0,y:0,w:s.width_mm,h:s.height_mm}] };
          let fitCount = 0;
          for(const rp of remainingPieces){
            const fit = findFitRect(temp, rp.width_mm, rp.height_mm);
            if(fit){
              const fr = temp.freeRects.splice(fit.index,1)[0];
              const placeW = fit.rotated ? rp.height_mm : rp.width_mm;
              const placeH = fit.rotated ? rp.width_mm : rp.height_mm;
              const right = {x: fr.x + placeW, y: fr.y, w: fr.w - placeW, h: placeH};
              const bottom = {x: fr.x, y: fr.y + placeH, w: fr.w, h: fr.h - placeH};
              if(right.w > 0 && right.h > 0) temp.freeRects.push(right);
              if(bottom.w > 0 && bottom.h > 0) temp.freeRects.push(bottom);
              temp.freeRects = pruneFreeRects(temp.freeRects);
              fitCount++;
            }
          }
          const score = fitCount > 0 ? ((s.price || 0) / fitCount) : Infinity;
          if(score < bestScore){ bestScore = score; bestCand = s; }
        }
        if(bestCand) {
          stockCounts[bestCand.id] = (stockCounts[bestCand.id]||0) - 1;
          const b = {stock_id: bestCand.id, stock_width_mm: bestCand.width_mm, stock_height_mm: bestCand.height_mm, placements: [], price: bestCand.price||0, freeRects: [{x:0,y:0,w:bestCand.width_mm,h:bestCand.height_mm}] };
          boards.push(b);
          return b;
        }
      }

      // fallback / other strategies: sort and pick first
      sortCandidates(candidates, pw, ph, strategy);
      const s = candidates[0];
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
        const fit = findFitRect(b, p.width_mm, p.height_mm);
        if(fit){
          const fr = b.freeRects.splice(fit.index,1)[0];
          const px = fr.x, py = fr.y;
          const placeW = fit.rotated ? p.height_mm : p.width_mm;
          const placeH = fit.rotated ? p.width_mm : p.height_mm;
          b.placements.push({piece_id: p.piece_id, width_mm: placeW, height_mm: placeH, x_mm: px, y_mm: py, rotated: fit.rotated});
          // split guillotine: right and bottom
          const right = {x: px + placeW, y: py, w: fr.w - placeW, h: placeH};
          const bottom = {x: px, y: py + placeH, w: fr.w, h: fr.h - placeH};
          if(right.w > 0 && right.h > 0) b.freeRects.push(right);
          if(bottom.w > 0 && bottom.h > 0) b.freeRects.push(bottom);
          b.freeRects = pruneFreeRects(b.freeRects);
          placed = true; break;
        }
      }
      if(!placed){
        const nb = createBoardFor(p.width_mm, p.height_mm, pieces.slice(pi));
        if(nb){
          const fit = findFitRect(nb, p.width_mm, p.height_mm);
          if(fit){
            const fr = nb.freeRects.splice(fit.index,1)[0];
            const placeW = fit.rotated ? p.height_mm : p.width_mm;
            const placeH = fit.rotated ? p.width_mm : p.height_mm;
            nb.placements.push({piece_id: p.piece_id, width_mm: placeW, height_mm: placeH, x_mm: fr.x, y_mm: fr.y, rotated: fit.rotated});
            const right = {x: fr.x + placeW, y: fr.y, w: fr.w - placeW, h: placeH};
            const bottom = {x: fr.x, y: fr.y + placeH, w: fr.w, h: fr.h - placeH};
            if(right.w > 0 && right.h > 0) nb.freeRects.push(right);
            if(bottom.w > 0 && bottom.h > 0) nb.freeRects.push(bottom);
            nb.freeRects = pruneFreeRects(nb.freeRects);
            placed = true;
          } else {
            unassigned.push(p);
          }
        } else {
          unassigned.push(p);
        }
      }
      // report progress
      if(reportProgress){
        try{ if(progressCb) progressCb({percent: Math.round(((pi+1)/pieces.length)*100), processed: pi+1, total: pieces.length}); }catch(e){}
      }
    }
    return {boards, unassigned};
  }

  function buildSolution(boards: any[]){
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

    return {boards: outBoards, metrics};
  }

  let resultBoards: any[] = [];
  let unassigned: any[] = [];
  let solution: any = null;

  if(objective === 'min_price'){
    // Exhaustive-ish search over possible board combinations (bounded) to find minimal total price
    const stockCountLimits = stocks.map(s => s.quantity || 0);
    const nStocks = stocks.length;
    const pieceCount = pieces.length;
    const maxBoards = Math.min(pieceCount, 7); // limit search depth for performance

    function tryPackWithBoards(boardIndices: number[]){
      // create boards objects
      const workBoards = boardIndices.map(idx => {
        const s = stocks[idx];
        return { stock_id: s.id, stock_width_mm: s.width_mm, stock_height_mm: s.height_mm, placements: [], price: s.price||0, freeRects: [{x:0,y:0,w:s.width_mm,h:s.height_mm}] };
      });
      // sort boards by area desc to improve packing success
      workBoards.sort((a,b)=> (b.stock_width_mm*b.stock_height_mm) - (a.stock_width_mm*a.stock_height_mm));

      // attempt to pack all pieces into these boards
      for(const p of pieces){
        let placed = false;
        for(const b of workBoards){
          const fit = findFitRect(b, p.width_mm, p.height_mm);
          if(fit){
            const fr = b.freeRects.splice(fit.index,1)[0];
            const placeW = fit.rotated ? p.height_mm : p.width_mm;
            const placeH = fit.rotated ? p.width_mm : p.height_mm;
            b.placements.push({piece_id: p.piece_id, width_mm: placeW, height_mm: placeH, x_mm: fr.x, y_mm: fr.y, rotated: fit.rotated});
            const right = {x: fr.x + placeW, y: fr.y, w: fr.w - placeW, h: placeH};
            const bottom = {x: fr.x, y: fr.y + placeH, w: fr.w, h: fr.h - placeH};
            if(right.w > 0 && right.h > 0) b.freeRects.push(right);
            if(bottom.w > 0 && bottom.h > 0) b.freeRects.push(bottom);
            b.freeRects = pruneFreeRects(b.freeRects);
            placed = true; break;
          }
        }
        if(!placed) return null;
      }
      return workBoards;
    }

    let bestSolution: {boards:any[], metrics:any} | null = null;

    // generate combinations with repetition (non-decreasing indices) of size k
    function genComb(n: number, k: number, start = 0, cur: number[] = []){
      if(cur.length === k){
        // check quantity limits
        const counts: Record<number, number> = {};
        for(const idx of cur) counts[idx] = (counts[idx]||0) + 1;
        for(const [idxStr, cnt] of Object.entries(counts)){
          const idx = Number(idxStr);
          const limit = stockCountLimits[idx] > 0 ? stockCountLimits[idx] : Infinity;
          if(cnt > limit) return;
        }
        const boards = tryPackWithBoards(cur);
        if(boards){
          const sol = buildSolution(boards);
          if(!bestSolution || sol.metrics.total_price < bestSolution.metrics.total_price || (sol.metrics.total_price === bestSolution.metrics.total_price && sol.metrics.total_waste_mm2 < bestSolution.metrics.total_waste_mm2)){
            bestSolution = sol;
          }
        }
        return;
      }
      for(let i = start; i < n; i++){
        cur.push(i);
        genComb(n, k, i, cur);
        cur.pop();
      }
    }

    for(let k=1;k<=maxBoards;k++){
      genComb(nStocks, k, 0, []);
      // if we found a solution with total_price less than any naive greedy, we can stop early
      if(bestSolution) break;
    }

    if(bestSolution){
      solution = bestSolution;
      unassigned = [];
    } else {
      // fallback to heuristic runs
      const runA = runPack('min_price', false);
      const runB = runPack('price_per_area', false);
      const solA = buildSolution(runA.boards);
      const solB = buildSolution(runB.boards);
      const pickB = (solB.metrics.total_price < solA.metrics.total_price) ||
        (solB.metrics.total_price === solA.metrics.total_price && solB.metrics.total_waste_mm2 < solA.metrics.total_waste_mm2) ||
        (solB.metrics.total_price === solA.metrics.total_price && solB.metrics.total_waste_mm2 === solA.metrics.total_waste_mm2 && solB.metrics.boards_used < solA.metrics.boards_used);
      if(pickB){
        resultBoards = runB.boards;
        unassigned = runB.unassigned;
      } else {
        resultBoards = runA.boards;
        unassigned = runA.unassigned;
      }
    }
  } else if(objective === 'min_source_boards'){
    const run = runPack('max_area', true);
    resultBoards = run.boards;
    unassigned = run.unassigned;
  } else {
    const run = runPack('min_waste', true);
    resultBoards = run.boards;
    unassigned = run.unassigned;
  }

  if(!solution) solution = buildSolution(resultBoards);

  if(progressCb) try{ progressCb({percent:100, processed: pieces.length, total: pieces.length}); }catch(e){}
  return {solution, unassigned};
}

export default {solve};
