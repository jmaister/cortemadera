// Simple SVG renderer for 2D packing solution (TypeScript)
export function renderSolution(container: HTMLElement | string, solution: any, options: any = {}): string{
  if(typeof container === 'string') container = document.getElementById(container) as HTMLElement;
  if(!container) return '';
  if(!solution || !Array.isArray(solution.boards) || solution.boards.length === 0){
    container.innerHTML = '<p>No solution to render.</p>';
    return '';
  }

  const boards = solution.boards;
  const maxWidth = Math.max(...boards.map((b: any) => b.stock_width_mm || 0));
  const scale = Math.min(900 / Math.max(maxWidth,1), 1);
  const baseGap = 24; // base vertical gap between boards
  const svgW = Math.round(maxWidth * scale + 200);

  // Small FNV-1a style hash for deterministic mapping
  function hashString(str: string){
    let h = 2166136261 >>> 0;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // Predefined palette of easily distinguishable colors (hex)
  const PALETTE = [
    '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf',
    '#393b79','#637939','#8c6d31','#843c39','#7b4173','#3182bd','#31a354','#756bb1','#636363','#e6550d'
  ];

  // Return a deterministic color from the palette based on piece id and its size.
  function colorForPiece(id: string, width: number, height: number){
    const key = `${id}:${Math.round(Number(width)||0)}x${Math.round(Number(height)||0)}`;
    const idx = hashString(key) % PALETTE.length;
    return PALETTE[idx];
  }

  // Track piece and stock counts for numbering duplicates
  const pieceCounts: Record<string, number> = {};
  const stockCounts: Record<string, number> = {};
  
  // Font sizes for labels; can be overridden via `options.labelFontSize` (pixels)
  const LABEL_FONT_PX = (options && typeof options.labelFontSize === 'number') ? options.labelFontSize : 18;
  const DIM_FONT_PX = Math.max(9, LABEL_FONT_PX - 2);

  // compute panel gap based on label size to avoid overlap between stacked boards
  const panelGap = Math.max(baseGap, LABEL_FONT_PX + 24);
  const svgH = boards.reduce((s:any,b:any)=> s + Math.round((b.stock_height_mm||0) * scale) + panelGap, 60);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  svg += `<style>.board{stroke:#333;fill:#f6f7fb}.piece{stroke:#222}.meta{font-size:${LABEL_FONT_PX}px;fill:#111;font-weight:bold}.dim-line{stroke:#111;stroke-width:0.8}.dim-text{font-size:${DIM_FONT_PX}px;fill:#111}</style>`;

  // Define hatch patterns for the palette to reduce solid ink usage when printing
  let defs = `<defs>`;
  for(let i=0;i<PALETTE.length;i++){
    const c = PALETTE[i];
    defs += `<pattern id="patt-${i}" patternUnits="userSpaceOnUse" width="8" height="8">`;
    defs += `<rect width="8" height="8" fill="white" fill-opacity="0"/>`;
    defs += `<path d="M-2 10 L10 -2" stroke="${c}" stroke-width="1.5" stroke-opacity="0.65"/>`;
    defs += `</pattern>`;
  }
  defs += `</defs>`;
  svg += defs;

  let yOff = 40;
  for(let i=0;i<boards.length;i++){
    const b = boards[i];
    const w = Math.round((b.stock_width_mm || 0) * scale);
    const h = Math.round((b.stock_height_mm || 0) * scale) || 40;
    
    // Number this stock board
    stockCounts[b.stock_id] = (stockCounts[b.stock_id] || 0) + 1;
    const stockLabel = b.stock_id.length === 2 && /^[A-Z]{2}$/.test(b.stock_id) 
      ? `${b.stock_id}${stockCounts[b.stock_id]}` 
      : b.stock_id;
    
    svg += `<g transform="translate(40,${yOff})">`;
    svg += `<rect class="board" x="0" y="0" width="${w}" height="${h}" rx="6"/>`;
    svg += `<text class="meta" x="${w+8}" y="16">${stockLabel} — waste ${b.waste_mm2} mm²</text>`;
    svg += `<text class="meta" x="${w+8}" y="34">${b.stock_width_mm}×${b.stock_height_mm} mm</text>`;

    /* Top dimension (width) */
    const topY = -10;
    svg += `<line class="dim-line" x1="0" y1="${topY}" x2="${w}" y2="${topY}" />`;
    svg += `<line class="dim-line" x1="0" y1="${topY - 4}" x2="0" y2="${topY + 4}" />`;
    svg += `<line class="dim-line" x1="${w}" y1="${topY - 4}" x2="${w}" y2="${topY + 4}" />`;
    svg += `<text class="dim-text" x="${Math.round(w/2)}" y="${topY - 6}" text-anchor="middle">${b.stock_width_mm} mm</text>`;

    /* Left dimension (height) */
    const leftX = -10;
    svg += `<line class="dim-line" x1="${leftX}" y1="0" x2="${leftX}" y2="${h}" />`;
    svg += `<line class="dim-line" x1="${leftX - 4}" y1="0" x2="${leftX + 4}" y2="0" />`;
    svg += `<line class="dim-line" x1="${leftX - 4}" y1="${h}" x2="${leftX + 4}" y2="${h}" />`;
    svg += `<text class="dim-text" x="${leftX - 6}" y="${Math.round(h/2)}" text-anchor="middle" transform="rotate(-90 ${leftX - 6} ${Math.round(h/2)})">${b.stock_height_mm} mm</text>`;

    // Track used areas to find waste
    const usedAreas = (b.placements || []).map((p:any) => ({
      x: p.x_mm || 0, y: p.y_mm || 0, w: p.width_mm || 0, h: p.height_mm || 0
    }));

    for(const p of (b.placements || [])){
      const x = Math.round((p.x_mm || 0) * scale);
      const y = Math.round((p.y_mm || 0) * scale);
      const pw = Math.max(1, Math.round((p.width_mm || 0) * scale));
      const ph = Math.max(1, Math.round((p.height_mm || 0) * scale));

      // Number duplicate pieces (increment first so each placement gets a unique index)
      pieceCounts[p.piece_id] = (pieceCounts[p.piece_id] || 0) + 1;
      const pieceLabel = p.piece_id && p.piece_id.length === 1 && /^[A-Z]$/.test(p.piece_id)
        ? `${p.piece_id}${pieceCounts[p.piece_id]}`
        : (p.piece_id || '');

      // Determine palette index and patterned fill
      const key = `${p.piece_id || ''}:${Math.round(p.width_mm||0)}x${Math.round(p.height_mm||0)}`;
      const paletteIdx = hashString(key) % PALETTE.length;
      const baseColor = PALETTE[paletteIdx];
      const fillUrl = `url(#patt-${paletteIdx})`;

      // Contrast for label text: compute brightness of baseColor
      const r = parseInt(baseColor.slice(1,3),16);
      const g = parseInt(baseColor.slice(3,5),16);
      const bcol = parseInt(baseColor.slice(5,7),16);
      const brightness = (0.299*r + 0.587*g + 0.114*bcol) / 255;
      const textFill = brightness > 0.6 ? '#111' : '#fff';
      const textStroke = textFill === '#fff' ? '#111' : '#fff';

      svg += `<g>`;
      svg += `<rect class="piece" x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fillUrl}" stroke="#333"/>`;
      svg += `<text class="meta" x="${x+6}" y="${y+LABEL_FONT_PX}">${pieceLabel} (${p.width_mm}×${p.height_mm}mm)</text>`;
      svg += `</g>`;
    }

    // Draw waste areas with measurements (simplified)
    if(b.waste_mm2 > 100) {
      // Find largest waste rectangle (right side)
      const rightWaste = b.stock_width_mm - Math.max(...usedAreas.map((a:any) => a.x + a.w), 0);
      const bottomWaste = b.stock_height_mm - Math.max(...usedAreas.map((a:any) => a.y + a.h), 0);
      
      if(rightWaste > 10) {
        const wx = Math.round((b.stock_width_mm - rightWaste) * scale);
        const ww = Math.round(rightWaste * scale);
        svg += `<rect x="${wx}" y="0" width="${ww}" height="${h}" fill="#fff3cd" opacity="0.3" stroke="#856404" stroke-dasharray="4"/>`;
        svg += `<text class="dim-text" x="${wx + ww/2}" y="${h/2}" text-anchor="middle">${Math.round(rightWaste)} mm</text>`;
      }
      if(bottomWaste > 10) {
        const wy = Math.round((b.stock_height_mm - bottomWaste) * scale);
        const wh = Math.round(bottomWaste * scale);
        svg += `<rect x="0" y="${wy}" width="${w}" height="${wh}" fill="#fff3cd" opacity="0.3" stroke="#856404" stroke-dasharray="4"/>`;
        svg += `<text class="dim-text" x="${w/2}" y="${wy + wh/2}" text-anchor="middle">${Math.round(bottomWaste)} mm</text>`;
      }
    }

    svg += `</g>`;
    yOff += h + panelGap;
  }
  svg += `</svg>`;

  container.innerHTML = svg;
  return svg;
}

export function getSvgString(container: HTMLElement | string, solution: any, options?: any){
  return renderSolution(container, solution, options);
}

export default { renderSolution, getSvgString };
