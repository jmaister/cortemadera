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
  // options (can be used to tweak print rendering)
  const opts = options || {};
  const gapMultiplier = (typeof opts.gapMultiplier === 'number') ? opts.gapMultiplier : 1;
  const strokeMultiplier = (typeof opts.strokeMultiplier === 'number') ? opts.strokeMultiplier : 1;
  const patternScale = (typeof opts.patternScale === 'number') ? opts.patternScale : 1;

  const baseGap = 24; // base vertical gap between boards (will be multiplied by gapMultiplier)
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
    '#8c6d31','#3182bd','#31a354','#756bb1','#e6550d'
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
  
  // Font sizes for labels; can be overridden via `opts.labelFontSize` (pixels)
  const LABEL_FONT_PX = (typeof opts.labelFontSize === 'number') ? opts.labelFontSize : 18;
  const DIM_FONT_PX = Math.max(9, LABEL_FONT_PX - 2);
  // approximate average character width (used to size text background rects)
  const CHAR_W = Math.max(6, Math.round(LABEL_FONT_PX * 0.58));

  // compute panel gap based on label size to avoid overlap between stacked boards
  const panelGap = Math.max(baseGap, LABEL_FONT_PX + 24) * gapMultiplier;
  // Prepare footer summary data (counts of stock sizes and total price) so we can
  // reserve space at the bottom of the SVG before rendering boards.
  const stockSizeCounts: Record<string, number> = {};
  const stockSizePrice: Record<string, number> = {};
  for(const bb of boards){
    const key = `${bb.stock_width_mm}x${bb.stock_height_mm}`;
    stockSizeCounts[key] = (stockSizeCounts[key] || 0) + 1;
    if(typeof stockSizePrice[key] === 'undefined'){
      stockSizePrice[key] = Number(bb.total_price || bb.price || 0);
    }
  }
  const stockKeys = Object.keys(stockSizeCounts).sort((a,b)=>{
    const [aw,ah] = a.split('x').map((v)=>Number(v)||0);
    const [bw,bh] = b.split('x').map((v)=>Number(v)||0);
    if(aw === bw) return bh - ah;
    return bw - aw;
  });
  const totalPriceVal = (solution && solution.metrics && typeof solution.metrics.total_price === 'number')
    ? solution.metrics.total_price
    : boards.reduce((s:any,bb:any)=> s + (bb.total_price || 0), 0);
  const nfPrice = new Intl.NumberFormat('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const summaryLineCount = 1 + 1 + stockKeys.length; // price line + header + each stock type
  const lineHeight = LABEL_FONT_PX + 6;
  const summaryHeight = Math.max(48, summaryLineCount * lineHeight + 12);
  const svgH = boards.reduce((s:any,b:any)=> s + Math.round((b.stock_height_mm||0) * scale) + panelGap, 60) + summaryHeight;

  // stroke widths adjusted by multiplier to make printed lines thicker
  const boardStroke = (1.0 * strokeMultiplier).toFixed(2);
  const pieceStroke = (0.9 * strokeMultiplier).toFixed(2);
  const dimLineStroke = (0.8 * strokeMultiplier).toFixed(2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  // make board background white and keep other typography styles
  svg += `<style>.board{stroke:#333;stroke-width:${boardStroke}px;fill:#fff;stroke-linejoin:round;stroke-linecap:round}.piece{stroke:#222;stroke-width:${pieceStroke}px;stroke-linejoin:round;stroke-linecap:round}.meta{font-size:${LABEL_FONT_PX}px;fill:#111;font-weight:bold}.dim-line{stroke:#111;stroke-width:${dimLineStroke}px}.dim-text{font-size:${DIM_FONT_PX}px;fill:#111}</style>`;

  // Define hatch patterns for the palette to reduce solid ink usage when printing
  let defs = `<defs>`;
  const pattSize = Math.max(6, Math.round(8 * patternScale));
  for(let i=0;i<PALETTE.length;i++){
    const c = PALETTE[i];
    defs += `<pattern id="patt-${i}" patternUnits="userSpaceOnUse" width="${pattSize}" height="${pattSize}">`;
    defs += `<rect width="${pattSize}" height="${pattSize}" fill="white" fill-opacity="0"/>`;
    defs += `<path d="M-2 ${pattSize + 2} L ${pattSize + 2} -2" stroke="${c}" stroke-width="${(1.5*strokeMultiplier).toFixed(2)}" stroke-opacity="0.65"/>`;
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
    // stock labels: show stock id, waste percent on its own line, and dimensions below
    const stockArea = (b.stock_width_mm || 0) * (b.stock_height_mm || 0);
    const wastePct = (stockArea > 0 && Number(b.waste_mm2)) ? (Number(b.waste_mm2) / stockArea) * 100 : 0;
    const wastePctStr = `${parseFloat(wastePct.toFixed(1))}%`;
    const stockLine1 = `${stockLabel}`;
    const stockLine2 = `Waste: ${wastePctStr}`;
    const stockLine3 = `${b.stock_width_mm}×${b.stock_height_mm} mm`;
    const stockLine1W = Math.max(40, Math.round(stockLine1.length * CHAR_W));
    const stockLine2W = Math.max(40, Math.round(stockLine2.length * CHAR_W));
    const stockLine3W = Math.max(40, Math.round(stockLine3.length * CHAR_W));
    const sideRectH = LABEL_FONT_PX + 6;
    const sideGap = Math.max(4, Math.round(LABEL_FONT_PX * 0.15));
    const sideTextY1 = LABEL_FONT_PX + 2;
    const sideTextY2 = sideTextY1 + sideRectH + sideGap;
    const sideTextY3 = sideTextY2 + sideRectH + sideGap;
    const sideTextX = w + 8;
    const sideRectX = sideTextX - 4;
    svg += `<rect x="${sideRectX}" y="${sideTextY1 - LABEL_FONT_PX - 2}" width="${stockLine1W + 8}" height="${sideRectH}" rx="3" fill="#fff" />`;
    svg += `<text class="meta" x="${sideTextX}" y="${sideTextY1}">${stockLine1}</text>`;
    svg += `<rect x="${sideRectX}" y="${sideTextY2 - LABEL_FONT_PX - 2}" width="${stockLine2W + 8}" height="${sideRectH}" rx="3" fill="#fff" />`;
    svg += `<text class="meta" x="${sideTextX}" y="${sideTextY2}">${stockLine2}</text>`;
    svg += `<rect x="${sideRectX}" y="${sideTextY3 - LABEL_FONT_PX - 2}" width="${stockLine3W + 8}" height="${sideRectH}" rx="3" fill="#fff" />`;
    svg += `<text class="meta" x="${sideTextX}" y="${sideTextY3}">${stockLine3}</text>`;

    /* Top dimension (width) */
    const topY = -10;
    svg += `<line class="dim-line" x1="0" y1="${topY}" x2="${w}" y2="${topY}" />`;
    svg += `<line class="dim-line" x1="0" y1="${topY - 4}" x2="0" y2="${topY + 4}" />`;
    svg += `<line class="dim-line" x1="${w}" y1="${topY - 4}" x2="${w}" y2="${topY + 4}" />`;
    const topDimLabel = `${b.stock_width_mm} mm`;
    const topDimW = Math.max(24, Math.round(topDimLabel.length * CHAR_W));
    const topDimX = Math.round(w/2 - topDimW/2);
    svg += `<rect x="${topDimX}" y="${(topY - 6) - LABEL_FONT_PX - 2}" width="${topDimW + 8}" height="${LABEL_FONT_PX + 6}" rx="2" fill="#fff" />`;
    svg += `<text class="dim-text" x="${Math.round(w/2)}" y="${topY - 6}" text-anchor="middle">${topDimLabel}</text>`;

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

      const pieceLabelText = `${pieceLabel} (${p.width_mm}×${p.height_mm}mm)`;
      const pieceLabelW = Math.max(24, Math.round(pieceLabelText.length * CHAR_W) + 8);
      svg += `<g>`;
      svg += `<rect class="piece" x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fillUrl}" stroke="#333"/>`;
      // add small white background behind piece label (limit width to piece width - padding)
      const labelBgWidth = Math.min(pieceLabelW, Math.max(24, pw - 8));
      svg += `<rect x="${x+4}" y="${y + 2}" width="${labelBgWidth}" height="${LABEL_FONT_PX + 6}" rx="2" fill="#fff" />`;
      svg += `<text class="meta" x="${x+6}" y="${y+LABEL_FONT_PX}" fill="${textFill}">${pieceLabelText}</text>`;
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

  // Footer summary block: Total price and stocks-needed list
  svg += `<g transform="translate(40,${yOff})">`;
  let footerY = LABEL_FONT_PX + 2;
  svg += `<text class="meta" x="0" y="${footerY}">Precio total: ${nfPrice.format(totalPriceVal)}</text>`;
  footerY += lineHeight;
  svg += `<text class="meta" x="0" y="${footerY}">Taleros necesarios:</text>`;
  footerY += lineHeight;
  for(const key of stockKeys){
    const count = stockSizeCounts[key];
    const perPrice = stockSizePrice[key] || 0;
    const lineTotal = Number(perPrice) * Number(count);
    svg += `<text class="meta" x="8" y="${footerY}">${key} mm Cantidad: ${count} Precio: ${nfPrice.format(perPrice)} Total: ${nfPrice.format(lineTotal)}</text>`;
    footerY += lineHeight;
  }
  svg += `</g>`;
  yOff += summaryHeight;
  svg += `</svg>`;

  container.innerHTML = svg;
  return svg;
}

export function getSvgString(container: HTMLElement | string, solution: any, options?: any){
  return renderSolution(container, solution, options);
}

export default { renderSolution, getSvgString };
