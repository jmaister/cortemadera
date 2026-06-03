export type ShelfInputs = {
  cabinet_height_mm: number;
  shelf_width_mm: number;
  kick_toe_mm: number;
  shelf_count: number;
  top_clearance_mm: number;
};

export type ShelfPosition = {
  index: number;
  height_from_floor_mm: number;
  height_from_kick_toe_mm: number;
  distance_to_top_mm: number;
};

export type ShelfResult = {
  inputs: ShelfInputs;
  usable_height_mm: number;
  spacing_mm: number;
  shelves: ShelfPosition[];
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
  const shelf_count = clampInt(Number(raw.shelf_count), 0, 200);

  const usable_height_mm = cabinet_height_mm - kick_toe_mm - top_clearance_mm;
  const safeUsable = Math.max(0, usable_height_mm);

  const spacing_mm = shelf_count > 0 ? safeUsable / (shelf_count + 1) : 0;

  const shelves: ShelfPosition[] = [];
  for (let i = 1; i <= shelf_count; i++) {
    const height_from_kick_toe_mm = spacing_mm * i;
    const height_from_floor_mm = kick_toe_mm + height_from_kick_toe_mm;
    const distance_to_top_mm = cabinet_height_mm - height_from_floor_mm;
    shelves.push({
      index: i,
      height_from_floor_mm,
      height_from_kick_toe_mm,
      distance_to_top_mm,
    });
  }

  return {
    inputs: {
      cabinet_height_mm,
      shelf_width_mm,
      kick_toe_mm,
      shelf_count,
      top_clearance_mm,
    },
    usable_height_mm: safeUsable,
    spacing_mm,
    shelves,
  };
}

function fmtMm(v: number): string {
  if (!Number.isFinite(v)) return '';
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}`;
}

export function renderShelfSvg(container: HTMLElement, result: ShelfResult): void {
  const W = 520;
  const H = 520;
  const pad = 40;

  const cabinetH = result.inputs.cabinet_height_mm;
  const cabinetW = result.inputs.shelf_width_mm;
  const kick = result.inputs.kick_toe_mm;

  const scaleY = (H - 2 * pad) / Math.max(1, cabinetH);
  const scaleX = (W - 2 * pad) / Math.max(1, cabinetW);
  const scale = Math.min(scaleX, 1.0);

  const drawW = cabinetW * scale;
  const drawH = cabinetH * scaleY;

  const x0 = pad;
  const y0 = pad;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<style>
    .cab{fill:#fff;stroke:#333;stroke-width:1.2}
    .shelf{stroke:#2b7cff;stroke-width:2}
    .kick{fill:#f2f4f7;stroke:#333;stroke-width:1}
    .label{font-size:12px;fill:#111}
    .muted{font-size:11px;fill:#666}
  </style>`;

  svg += `<rect class="cab" x="${x0}" y="${y0}" width="${drawW}" height="${drawH}" rx="6"/>`;

  if (kick > 0) {
    const kickH = kick * scaleY;
    svg += `<rect class="kick" x="${x0}" y="${y0 + drawH - kickH}" width="${drawW}" height="${kickH}"/>`;
    svg += `<text class="muted" x="${x0 + 6}" y="${y0 + drawH - kickH + 14}">Kick toe: ${fmtMm(kick)} mm</text>`;
  }

  for (const s of result.shelves) {
    const y = y0 + drawH - s.height_from_floor_mm * scaleY;
    svg += `<line class="shelf" x1="${x0}" y1="${y}" x2="${x0 + drawW}" y2="${y}"/>`;

    // render a small label box inside the cabinet near the shelf line
    const labelX = x0 + 8;
    const labelPadding = 6;
    const labelText = `#${s.index}: ${fmtMm(s.height_from_floor_mm)} mm`;
    const subText = `to top: ${fmtMm(s.distance_to_top_mm)} mm`;
    // approximate text width
    const approxCharW = 7;
    const bgW = Math.min(Math.max(100, (labelText.length + subText.length) * approxCharW * 0.5), Math.max(80, drawW - 16));
    const bgH = 26;
    let labelTop = y - bgH - 6;
    const minTop = y0 + 6;
    if (labelTop < minTop) labelTop = minTop;

    svg += `<rect x="${labelX - 4}" y="${labelTop}" width="${bgW}" height="${bgH}" rx="4" fill="#ffffff" fill-opacity="0.9" stroke="#e0e0e0"/>`;
    svg += `<text class="label" x="${labelX}" y="${labelTop + 14}"> ${labelText}</text>`;
    svg += `<text class="muted" x="${labelX}" y="${labelTop + 14 + 12}">${subText}</text>`;
  }

  // Draw bucket heights on the right side: compartments between kick top, shelves, and cabinet top
  const boundaries: number[] = [];
  const kickTopMm = Math.max(0, result.inputs.kick_toe_mm);
  boundaries.push(kickTopMm);
  for (const s of result.shelves) boundaries.push(s.height_from_floor_mm);
  boundaries.push(cabinetH);

  for (let i = 0; i < boundaries.length - 1; i++) {
    const h0 = boundaries[i];
    const h1 = boundaries[i + 1];
    const bucketH = Math.max(0, h1 - h0);
    if (bucketH <= 0) continue;
    const mid = (h0 + h1) / 2;
    let yMid = y0 + drawH - mid * scaleY;
    const minY = y0 + 12;
    const maxY = y0 + drawH - 8;
    if (yMid < minY) yMid = minY;
    if (yMid > maxY) yMid = maxY;

    const xRight = x0 + drawW - 8;
    svg += `<text class="muted" x="${xRight}" y="${yMid + 4}" text-anchor="end">${Math.round(bucketH)} mm</text>`;
  }

  svg += `<text class="label" x="${x0}" y="${y0 - 10}">Width: ${fmtMm(cabinetW)} mm</text>`;
  svg += `<text class="label" x="${x0 + drawW + 8}" y="${y0 + 12}">Height: ${fmtMm(cabinetH)} mm</text>`;

  svg += `</svg>`;
  container.innerHTML = svg;
}

export function initShelfCalculator(): void {
  const elHeight = document.getElementById('shelf-cabinet-height') as HTMLInputElement;
  const elWidth = document.getElementById('shelf-width') as HTMLInputElement;
  const elKick = document.getElementById('shelf-kick-toe') as HTMLInputElement;
  const elTop = document.getElementById('shelf-top-clearance') as HTMLInputElement;
  const elCount = document.getElementById('shelf-count') as HTMLInputElement;
  const svg = document.getElementById('shelf-svg') as HTMLElement;
  const tableBody = document.getElementById('shelf-table-body') as HTMLElement;
  const summary = document.getElementById('shelf-summary') as HTMLElement;

  const STORAGE_KEY = 'shelf_config_v1';

  function readInputs(): ShelfInputs {
    return {
      cabinet_height_mm: Number(elHeight.value) || 0,
      shelf_width_mm: Number(elWidth.value) || 0,
      kick_toe_mm: Number(elKick.value) || 0,
      shelf_count: Number(elCount.value) || 0,
      top_clearance_mm: Number(elTop.value) || 0,
    };
  }

  function writeInputs(v: ShelfInputs) {
    elHeight.value = String(v.cabinet_height_mm);
    elWidth.value = String(v.shelf_width_mm);
    elKick.value = String(v.kick_toe_mm);
    elCount.value = String(v.shelf_count);
    elTop.value = String(v.top_clearance_mm);
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
      summary.textContent = `Usable height: ${fmtMm(result.usable_height_mm)} mm; even spacing: ${fmtMm(result.spacing_mm)} mm`;
    }

    renderShelfSvg(svg, result);

    tableBody.innerHTML = '';
    for (const s of result.shelves) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.index}</td>
        <td>${fmtMm(s.height_from_floor_mm)}</td>
        <td>${fmtMm(s.height_from_kick_toe_mm)}</td>
        <td>${fmtMm(s.distance_to_top_mm)}</td>`;
      tableBody.appendChild(tr);
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

  [elHeight, elWidth, elKick, elTop, elCount].forEach((el) => el.addEventListener('change', onChange));
  [elHeight, elWidth, elKick, elTop, elCount].forEach((el) => el.addEventListener('input', onChange));

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
