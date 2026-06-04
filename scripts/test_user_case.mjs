import { solve } from '../src/solver.ts';

const input = {
  pieces: [
    { id: 'A', width_mm: 2200, height_mm: 400, quantity: 2 },
    { id: 'B', width_mm: 564, height_mm: 380, quantity: 5 },
    { id: 'C', width_mm: 564, height_mm: 400, quantity: 2 },
    { id: 'D', width_mm: 564, height_mm: 100, quantity: 2 }
  ],
  stocks: [
    { id: 's2000x600', width_mm: 2000, height_mm: 600, quantity: 9999, price: 89.99 },
    { id: 's2400x600', width_mm: 2400, height_mm: 600, quantity: 9999, price: 105.00 },
    { id: 's2000x500', width_mm: 2000, height_mm: 500, quantity: 9999, price: 67.99 },
    { id: 's2400x400', width_mm: 2400, height_mm: 400, quantity: 9999, price: 82.49 },
    { id: 's2400x300', width_mm: 2400, height_mm: 300, quantity: 9999, price: 55.99 }
  ],
  kerf_mm: 0,
  allow_rotation: true
};

function runObjective(obj){
  const inp = JSON.parse(JSON.stringify(input));
  inp.objective = obj;
  const res = solve(inp);
  console.log('\nObjective:', obj);
  console.log('Metrics:', JSON.stringify(res.solution.metrics, null, 2));
  for(const b of res.solution.boards){
    console.log(`Board ${b.board_index} (${b.stock_id} ${b.stock_width_mm}x${b.stock_height_mm}) price=${b.total_price} waste=${b.waste_mm2}`);
    for(const p of b.placements || []){
      console.log('  ', p.piece_id, `${p.width_mm}x${p.height_mm}`, p.rotated ? 'rotated' : '');
    }
  }
  if(res.unassigned && res.unassigned.length) console.log('Unassigned:', res.unassigned);
}

runObjective('min_price');
runObjective('min_waste');
runObjective('min_source_boards');
