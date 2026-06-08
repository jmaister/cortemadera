import { solve } from './solver.js'

self.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data;
  if(!msg) return;
  if(msg.type === 'solve'){
    try{
      const result = solve(msg.input, (prog:any) => { (self as any).postMessage({type: 'progress', progress: prog}); });
      (self as any).postMessage({type: 'result', result});
    }catch(err:any){
      (self as any).postMessage({type: 'error', error: String(err)});
    }
  } else if(msg.type === 'terminate'){
    (self as any).close();
  }
});
