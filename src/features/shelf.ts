export type ShelfInputs = {
  cabinet_height_mm: number;
  shelf_width_mm: number;
  kick_toe_mm: number;
  shelf_count: number;
  top_clearance_mm: number;
  shelf_thickness_mm: number;
  decorative_top_height_mm: number;
  include_decorative_top: boolean;
};

export type ShelfPosition = {
  index: number;
  height_from_floor_mm: number;
  height_from_kick_toe_mm: number;
  distance_to_top_mm: number;
};

export type ShelfPiece = {
  name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  note?: string;
};

export type ShelfResult = {
  inputs: ShelfInputs;
  usable_height_mm: number;
  spacing_mm: number;
  shelves: ShelfPosition[];
  pieces: ShelfPiece[];
};

function clampInt(n: number, min: number, max: number): number {
  const v = Math.trunc(Number.isFinite(n) ? n : 0);
  return Math.max(min, Math.min(max, v));
}

function clampNum(n: number, min: number, max: number): number {
  const v = Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, v));
}

export function calculateShelves(raw: Partial<ShelfInputs>): ShelfResult {
  const cabinet_height_mm = clampNum(Number(raw.cabinet_height_mm), 1, 100000);
  const shelf_width_mm = clampNum(Number(raw.shelf_width_mm), 1, 100000);
  const kick_toe_mm = clampNum(Number(raw.kick_toe_mm), 0, 100000);
  const top_clearance_mm = clampNum(Number(raw.top_clearance_mm), 0, 100000);
  const shelf_thickness_mm = clampNum(Number((raw as any).shelf_thickness_mm), 0, 100000);
  const shelf_count = clampInt(Number(raw.shelf_count), 0, 200);
  const decorative_top_height_mm = clampNum(Number(raw.decorative_top_height_mm), 0, 100000);
  const include_decorative_top = Boolean(raw.include_decorative_top ?? true);

  const usable_height_mm = cabinet_height_mm - kick_toe_mm - top_clearance_mm;
  const safeUsable = Math.max(0, usable_height_mm);

  // account for shelf thickness including base and top boards:
  // Structure: base board + gap + shelf1 + gap + ... + shelfN + gap + top board
  // Total boards: base (1) + shelves (N) + top (1) = N+2
  // Total gaps: N+1
  const totalBoardThickness = (shelf_count + 2) * shelf_thickness_mm;
  let spacing_mm = 0;
  if (shelf_count > 0) {
    spacing_mm = (safeUsable - totalBoardThickness) / (shelf_count + 1);
    if (spacing_mm < 0) spacing_mm = 0;
  }

  const shelves: ShelfPosition[] = [];
  // Start from base board top: kick_toe + base_thickness, then add gap + shelf for each
  for (let i = 1; i <= shelf_count; i++) {
    // Position = base_thickness + (gap + shelf) * i
    const height_from_kick_toe_mm = shelf_thickness_mm + (spacing_mm + shelf_thickness_mm) * i;
    const height_from_floor_mm = kick_toe_mm + height_from_kick_toe_mm;
    const distance_to_top_mm = cabinet_height_mm - height_from_floor_mm;
    shelves.push({
      index: i,
      height_from_floor_mm,
      height_from_kick_toe_mm,
      distance_to_top_mm,
    });
  }

  const pieces: ShelfPiece[] = [
    { name: 'Base board', width_mm: shelf_width_mm, height_mm: shelf_thickness_mm, quantity: 1 },
    ...shelves.map((s) => ({ name: `Shelf ${s.index}`, width_mm: shelf_width_mm, height_mm: shelf_thickness_mm, quantity: 1 })),
    { name: 'Top board', width_mm: shelf_width_mm, height_mm: shelf_thickness_mm, quantity: 1 },
  ];

  if (include_decorative_top) {
    pieces.push({
      name: 'Decorative top',
      width_mm: shelf_width_mm,
      height_mm: decorative_top_height_mm || 250,
      quantity: 1,
      note: 'Width matches the shelf width',
    });
  }

  return {
    inputs: {
      cabinet_height_mm,
      shelf_width_mm,
      kick_toe_mm,
      shelf_count,
      top_clearance_mm,
      shelf_thickness_mm,
      decorative_top_height_mm: decorative_top_height_mm || 250,
      include_decorative_top,
    },
    usable_height_mm: safeUsable,
    spacing_mm,
    shelves,
    pieces,
  };
}

function fmtMm(v: number): string {
  if (!Number.isFinite(v)) return '';
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}`;
}

export function renderShelfSvg(container: HTMLElement, result: ShelfResult): void {
  const W = 1000;
  const H = 560;
  const pad = 40;
  // extra left margin to ensure outside labels are visible
  // increased to give more room for outside labels
  const leftMargin = 160;
  // increase right margin to accommodate wider right-hand columns
  const rightMargin = 300;

  const cabinetH = result.inputs.cabinet_height_mm;
  const cabinetW = result.inputs.shelf_width_mm;
  const kick = result.inputs.kick_toe_mm;

  const scaleY = (H - 2 * pad) / Math.max(1, cabinetH);
  const availableWidth = Math.max(80, W - 2 * pad - leftMargin - rightMargin);
  const scaleX = availableWidth / Math.max(1, cabinetW);
  const scale = Math.min(scaleX, 1.0);

  const drawW = cabinetW * scale;
  const drawH = cabinetH * scaleY;

  const x0 = pad + leftMargin;
  const y0 = pad;
  const leftLabelX = x0 - 12;

  // per-shelf label boxes removed by user request — only draw shelf rectangles

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<style>
    .cab{fill:#fff;stroke:#333;stroke-width:1.2}
    .shelf{stroke:#2b7cff;stroke-width:2}
    .shelfRect{fill:#2b7cff;stroke:#1a5fd1;stroke-width:1}
    .kick{fill:#f2f4f7;stroke:#333;stroke-width:1}
    .topclear{fill:#fff8e6;stroke:#333;stroke-width:1}
    .label{font-size:13px;fill:#111;font-weight:600}
    .muted{font-size:12px;fill:#666}
    .small{font-size:11px;fill:#444}
    .dim-line{stroke:#111;stroke-width:1}
    .dim-text{font-size:11px;fill:#111}
  </style>`;

  svg += `<defs>
    <marker id="arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#111"/>
    </marker>
  </defs>`;

  svg += `<rect class="cab" x="${x0}" y="${y0}" width="${drawW}" height="${drawH}" rx="6"/>`;

  if (kick > 0) {
    const kickH = kick * scaleY;
    svg += `<rect class="kick" x="${x0}" y="${y0 + drawH - kickH}" width="${drawW}" height="${kickH}"/>`;
    const yKickLabel = y0 + drawH - kickH + 14;
    svg += `<text class="muted" x="${leftLabelX}" y="${yKickLabel}" text-anchor="end">Kick toe: ${fmtMm(kick)} mm</text>`;
  }

  // render top clearance area (above the top board) if present
  const topClear = result.inputs.top_clearance_mm;
  if (topClear > 0) {
    const topH = topClear * scaleY;
    svg += `<rect class="topclear" x="${x0}" y="${y0}" width="${drawW}" height="${topH}"/>`;
    // place the Top clearance label at the top of the clearance area
    const centerXLocal = Math.round(x0 + drawW / 2);
    const topClearLabelY = y0 + topH / 2 + 4; // center vertically in the clearance area
    svg += `<text class="muted" x="${centerXLocal}" y="${topClearLabelY}" text-anchor="middle">Top clearance: ${fmtMm(topClear)} mm</text>`;
  }

  const thickness = result.inputs.shelf_thickness_mm;

  // Draw top board (below the top clearance area)
  // Top board top is at (cabinetH - topClear), bottom is at (cabinetH - topClear - thickness)
  const topBoardTop = cabinetH - topClear;
  const topBoardBottom = topBoardTop - thickness;
  if (thickness > 0) {
    const topBoardY = y0 + drawH - topBoardTop * scaleY;
    const topBoardH = Math.max(1, thickness * scaleY);
    svg += `<rect class="shelfRect" x="${x0}" y="${topBoardY}" width="${drawW}" height="${topBoardH}" rx="2"/>`;
  }

  // Draw base board (on top of kick toe)
  if (thickness > 0) {
    const baseBoardY = y0 + drawH - (kick + thickness) * scaleY;
    const baseBoardH = Math.max(1, thickness * scaleY);
    svg += `<rect class="shelfRect" x="${x0}" y="${baseBoardY}" width="${drawW}" height="${baseBoardH}" rx="2"/>`;
  }

  const shelfRegions = result.shelves.map((s) => ({
    top: s.height_from_floor_mm,
    bottom: Math.max(0, s.height_from_floor_mm - thickness),
    index: s.index,
  }));

  // Add top board and base board regions
  const topBoardRegion = { top: topBoardTop, bottom: topBoardBottom, index: -1 }; // -1 for top board
  const baseBoardRegion = { top: kick + thickness, bottom: kick, index: 0 }; // 0 for base board
  const allRegions = [baseBoardRegion, ...shelfRegions, topBoardRegion];

  for (const s of result.shelves) {
    const yTop = y0 + drawH - s.height_from_floor_mm * scaleY;
    const rectH = Math.max(1, thickness * scaleY);
    svg += `<rect class="shelfRect" x="${x0}" y="${yTop}" width="${drawW}" height="${rectH}" rx="2"/>`;

    // place shelf name + height centered above each shelf
    const shelfLabel = `Shelf ${s.index}: ${fmtMm(s.height_from_floor_mm)} mm`;
    const centerX = Math.round(x0 + drawW / 2);
    let shelfLabelY = Math.round(yTop - 6);
    const minShelfLabelY = y0 + 12;
    if (shelfLabelY < minShelfLabelY) shelfLabelY = minShelfLabelY;
    svg += `<text class="label" x="${centerX}" y="${shelfLabelY}" text-anchor="middle">${shelfLabel}</text>`;
  }

  // Draw segment measurements with arrows on the left side.
  const boundaries: number[] = [];
  boundaries.push(0);
  const kickTopMm = Math.max(0, result.inputs.kick_toe_mm);
  boundaries.push(kickTopMm);
  // include shelf bottoms and tops so we show shelf-thickness segments separately
  for (const r of allRegions) {
    if (r.bottom > 0 || r.top > 0) {
      boundaries.push(r.bottom);
      boundaries.push(r.top);
    }
  }
  const topClearStart = Math.max(0, cabinetH - result.inputs.top_clearance_mm);
  if (result.inputs.top_clearance_mm > 0) boundaries.push(topClearStart);
  boundaries.push(cabinetH);

  const uniqBoundaries = Array.from(new Set(boundaries)).sort((a, b) => a - b);
  const approxCharW = 6.5;

  function drawDimArrow(x: number, y1: number, y2: number, label: string, anchor: 'start' | 'end') {
    const yTop = Math.min(y1, y2);
    const yBot = Math.max(y1, y2);
    svg += `<line class="dim-line" x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`;

    const labelMid = (yTop + yBot) / 2;
    const labelW = Math.max(40, Math.round(label.length * approxCharW));
    const padX = 6;
    const padY = 4;
    const labelH = 14;
    const rectX = anchor === 'end' ? x - padX - labelW : x + padX;
    const textX = anchor === 'end' ? x - padX : x + padX;
    const rectY = labelMid - labelH / 2 - padY / 2;
    svg += `<rect x="${rectX}" y="${rectY}" width="${labelW}" height="${labelH + padY}" rx="3" fill="#fff" fill-opacity="0.9" stroke="#e0e0e0"/>`;
    svg += `<text class="dim-text" x="${textX}" y="${labelMid + 4}" text-anchor="${anchor}">${label}</text>`;
  }

  for (let i = 0; i < uniqBoundaries.length - 1; i++) {
    const h0 = uniqBoundaries[i];
    const h1 = uniqBoundaries[i + 1];
    const bucketH = Math.max(0, h1 - h0);
    if (bucketH <= 0) continue;
    const mid = (h0 + h1) / 2;

    // simplify left-side measurement labels to avoid duplicating shelf names
    let labelText = `${Math.round(bucketH)} mm`;
    if (result.inputs.top_clearance_mm > 0 && mid >= topClearStart) {
      labelText = `Top clearance: ${Math.round(bucketH)} mm`;
    } else if (mid <= kickTopMm) {
      labelText = `Floor to base: ${Math.round(bucketH)} mm`;
    } else {
      labelText = `${Math.round(bucketH)} mm`;
    }

    const y1 = y0 + drawH - h0 * scaleY;
    const y2 = y0 + drawH - h1 * scaleY;
    drawDimArrow(leftLabelX, y1, y2, labelText, 'end');
  }

  // Right side cumulative measurements.
  const rightXTop = x0 + drawW + 96;
  const rightXBottom = rightXTop + 220;
  const yTop = y0;
  const yBottom = y0 + drawH;

  svg += `<line class="dim-line" x1="${rightXTop}" y1="${yTop}" x2="${rightXTop}" y2="${yBottom}" marker-end="url(#arrow)"/>`;
  svg += `<line class="dim-line" x1="${rightXBottom}" y1="${yBottom}" x2="${rightXBottom}" y2="${yTop}" marker-end="url(#arrow)"/>`;

  svg += `<text class="small" x="${rightXTop}" y="${yTop - 10}" text-anchor="middle">Top -> bottom</text>`;
  svg += `<text class="small" x="${rightXBottom}" y="${yTop - 10}" text-anchor="middle">Bottom -> top</text>`;

  // Alternate text position (left/right of line) to prevent overlap
  for (let idx = 0; idx < uniqBoundaries.length; idx++) {
    const h = uniqBoundaries[idx];
    const y = y0 + drawH - h * scaleY;
    const tick = 6;
    svg += `<line class="dim-line" x1="${rightXTop - tick}" y1="${y}" x2="${rightXTop + tick}" y2="${y}"/>`;
    svg += `<line class="dim-line" x1="${rightXBottom - tick}" y1="${y}" x2="${rightXBottom + tick}" y2="${y}"/>`;

    const topDown = cabinetH - h;
    const bottomUp = h;

    // Alternate sides: even indices on right, odd on left
    const topAnchor = idx % 2 === 0 ? 'start' : 'end';
    const topX = idx % 2 === 0 ? rightXTop + tick + 4 : rightXTop - tick - 4;
    const bottomAnchor = idx % 2 === 0 ? 'start' : 'end';
    const bottomX = idx % 2 === 0 ? rightXBottom + tick + 4 : rightXBottom - tick - 4;

    svg += `<text class="dim-text" x="${topX}" y="${y + 4}" text-anchor="${topAnchor}">${fmtMm(topDown)} mm</text>`;
    svg += `<text class="dim-text" x="${bottomX}" y="${y + 4}" text-anchor="${bottomAnchor}">${fmtMm(bottomUp)} mm</text>`;
  }

  const centerX = Math.round(x0 + drawW / 2);
  const widthLabelY = y0 - 28;
  const heightLabelY = y0 - 10;
  const topLabelY = y0 - 6;
  const baseLabelY = y0 + drawH + 18;
  svg += `<text class="label" x="${centerX}" y="${widthLabelY}" text-anchor="middle">Width: ${fmtMm(cabinetW)} mm</text>`;
  svg += `<text class="label" x="${centerX}" y="${heightLabelY}" text-anchor="middle">Height: ${fmtMm(cabinetH)} mm</text>`;
  svg += `<text class="muted" x="${centerX}" y="${topLabelY}" text-anchor="middle">Top: ${fmtMm(cabinetH)} mm</text>`;
  svg += `<text class="muted" x="${centerX}" y="${baseLabelY}" text-anchor="middle">Base: ${fmtMm(kick)} mm</text>`;

  svg += `</svg>`;
  container.innerHTML = svg;
}

export function initShelfCalculator(): void {
  const elHeight = document.getElementById('shelf-cabinet-height') as HTMLInputElement;
  const elWidth = document.getElementById('shelf-width') as HTMLInputElement;
  const elKick = document.getElementById('shelf-kick-toe') as HTMLInputElement;
  const elTop = document.getElementById('shelf-top-clearance') as HTMLInputElement;
  const elThickness = document.getElementById('shelf-thickness') as HTMLInputElement;
  const elCount = document.getElementById('shelf-count') as HTMLInputElement;
  const elDecorativeTop = document.getElementById('shelf-decorative-top-height') as HTMLInputElement;
  const elIncludeDecorativeTop = document.getElementById('shelf-include-decorative-top') as HTMLInputElement;
  const svg = document.getElementById('shelf-svg') as HTMLElement;
  const tableBody = document.getElementById('shelf-table-body') as HTMLElement;
  const pieceTableBody = document.getElementById('shelf-piece-table-body') as HTMLElement;
  const summary = document.getElementById('shelf-summary') as HTMLElement;

  const STORAGE_KEY = 'shelf_config_v1';

  function readInputs(): ShelfInputs {
    return {
      cabinet_height_mm: Number(elHeight.value) || 0,
      shelf_width_mm: Number(elWidth.value) || 0,
      kick_toe_mm: Number(elKick.value) || 0,
      shelf_count: Number(elCount.value) || 0,
      top_clearance_mm: Number(elTop.value) || 0,
      shelf_thickness_mm: Number(elThickness?.value) || 0,
      decorative_top_height_mm: Number(elDecorativeTop?.value) || 250,
      include_decorative_top: Boolean(elIncludeDecorativeTop?.checked ?? true),
    };
  }

  function writeInputs(v: ShelfInputs) {
    elHeight.value = String(v.cabinet_height_mm);
    elWidth.value = String(v.shelf_width_mm);
    elKick.value = String(v.kick_toe_mm);
    if (elThickness) elThickness.value = String(v.shelf_thickness_mm ?? 0);
    elCount.value = String(v.shelf_count);
    elTop.value = String(v.top_clearance_mm);
    if (elDecorativeTop) elDecorativeTop.value = String(v.decorative_top_height_mm ?? 250);
    if (elIncludeDecorativeTop) elIncludeDecorativeTop.checked = Boolean(v.include_decorative_top ?? true);
  }

  function render() {
    const raw = readInputs();
    const result = calculateShelves(raw);

    // basic validation message
    if (raw.cabinet_height_mm <= 0 || raw.shelf_width_mm <= 0) {
      summary.textContent = 'Enter cabinet height and shelf width.';
    } else if (result.usable_height_mm <= 0) {
      summary.textContent = 'Kick toe + top clearance must be less than cabinet height.';
    } else {
      const totalShelfThickness = result.inputs.shelf_thickness_mm * result.inputs.shelf_count;
      if (result.inputs.shelf_count > 0 && totalShelfThickness > result.usable_height_mm) {
        summary.textContent = 'Not enough usable height for shelf thickness; reduce shelf count or thickness.';
      } else {
        summary.textContent = `Usable height: ${fmtMm(result.usable_height_mm)} mm; gap: ${fmtMm(result.spacing_mm)} mm; thickness: ${fmtMm(result.inputs.shelf_thickness_mm)} mm; cut pieces: ${result.pieces.length}`;
      }
    }

    renderShelfSvg(svg, result);

    tableBody.innerHTML = '';
    for (const s of result.shelves) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.index}</td>
        <td>${fmtMm(s.height_from_floor_mm)}</td>
        <td>${fmtMm(s.height_from_kick_toe_mm)}</td>
        <td>${fmtMm(s.distance_to_top_mm)}</td>
        <td>${fmtMm(result.inputs.shelf_thickness_mm)}</td>`;
      tableBody.appendChild(tr);
    }

    pieceTableBody.innerHTML = '';
    for (const piece of result.pieces) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${piece.name}</td>
        <td>${fmtMm(piece.width_mm)}</td>
        <td>${fmtMm(piece.height_mm)}</td>
        <td>${piece.quantity}</td>
        <td>${piece.note || ''}</td>`;
      pieceTableBody.appendChild(tr);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.inputs));
    } catch {
      // ignore
    }
  }

  function onChange() {
    render();
  }

  [elHeight, elWidth, elKick, elTop, elCount, elThickness, elDecorativeTop, elIncludeDecorativeTop].forEach((el) => el.addEventListener('change', onChange));
  [elHeight, elWidth, elKick, elTop, elCount, elThickness, elDecorativeTop, elIncludeDecorativeTop].forEach((el) => el.addEventListener('input', onChange));

  // initial load
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as ShelfInputs;
      writeInputs(saved);
    } catch {
      // ignore
    }
  }

  render();
}

export default { initShelfCalculator, calculateShelves };
