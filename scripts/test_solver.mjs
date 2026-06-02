import fs from 'fs/promises';
import { solve } from '../src/solver.ts';

async function main(){
  const dataUrl = new URL('../src/data/sample.json', import.meta.url);
  const raw = await fs.readFile(dataUrl, 'utf8');
  const input = JSON.parse(raw);
  const res = solve(input);
  console.log('Metrics:', JSON.stringify(res.solution.metrics, null, 2));
  if(res.unassigned && res.unassigned.length) console.log('Unassigned:', res.unassigned);
}

main().catch(err=>{ console.error(err); process.exit(1); });
