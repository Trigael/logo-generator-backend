import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker as TesseractWorker, PSM } from 'tesseract.js';

export type OcrBox = { x: number; y: number; w: number; h: number; conf: number; text: string };

type TesseractWord = {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
  conf?: number;
  text?: string;
};

type TesseractLine = {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
  conf?: number;
  text?: string;
};

type Insets = { top?: number; right?: number; bottom?: number; left?: number };

@Injectable()
export class TextCleanerService implements OnModuleInit, OnModuleDestroy {
  private worker: TesseractWorker | null = null;
  private readonly sharp = require('sharp');

  private resolveInsets(pad: Insets | undefined, W: number, H: number) {
    const toPx = (v: number | undefined, base: number) =>
      !v ? 0 : (v > 1 ? Math.round(v) : Math.round(v * base));
    return {
      top: toPx(pad?.top, H),
      right: toPx(pad?.right, W),
      bottom: toPx(pad?.bottom, H),
      left: toPx(pad?.left, W),
    };
  }
  
  private clampRect(r: {x:number;y:number;x2:number;y2:number}, W:number, H:number) {
    const x = Math.max(0, Math.min(r.x, r.x2, W));
    const y = Math.max(0, Math.min(r.y, r.y2, H));
    const x2 = Math.max(x, Math.min(Math.max(r.x, r.x2), W));
    const y2 = Math.max(y, Math.min(Math.max(r.y, r.y2), H));
    return { x, y, x2, y2 };
  }

  async onModuleInit() {
    this.worker = await createWorker({});

    await this.worker.loadLanguage('eng');
    await this.worker.initialize('eng');
    await this.worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '220',
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Removing text artifacts outside of the safe-zone
   * @param buf 
   * @param brand 
   * @param slogan 
   * @returns 
   */
  async clean(buf: Buffer, brand: string, slogan?: string): Promise<Buffer> {
    const meta = await this.sharp(buf).metadata();
    const W = meta.width ?? 1024;
    const H = meta.height ?? 1024;
  
    // OCR (Optional Character Recognition)
    const { resized, scale } = await this._prepareOcrImage(buf, W);
    let ocrBoxes: OcrBox[] = [];
  
    try {
      const res = await this.withTimeout(this._detectTextBoxesDual(resized), 3500);
      
      ocrBoxes = res.boxes.map(b => ({
        x: Math.round(b.x * scale),
        y: Math.round(b.y * scale),
        w: Math.round(b.w * scale),
        h: Math.round(b.h * scale),
        conf: b.conf,
        text: b.text,
      }));
    } catch {
      // OK – we can continue without OCR
    }
  
    // Generating safe-zone (Where logo is)
    const safe = await this._autoSafeZone(buf, W, H, ocrBoxes, {
      left: 0.06,  // 6 % widTh
      right: 0.06,
      top: 0.04,   // 4 % height
      bottom: 0.10 // 10 % height (cause of slogan)
    });
    
    
    // Extra bottom security cause of slogan
    const extraDown = Math.round(H * 0.02);
    const safeX = Math.max(0, safe.x);
    const safeY = Math.max(0, safe.y);
    const safeX2 = Math.min(W, safe.x2);
    const safeY2 = Math.min(H, safe.y2 + extraDown);
    
    // Creating "ring" outside of the safe-zone
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const mk = (l:number,t:number,w:number,h:number) => ({
      left: clamp(Math.floor(l), 0, W),
      top: clamp(Math.floor(t), 0, H),
      width: Math.max(0, Math.floor(Math.min(W - clamp(Math.floor(l),0,W), w))),
      height: Math.max(0, Math.floor(Math.min(H - clamp(Math.floor(t),0,H), h))),
    });
    
    const ring = [
      mk(0, 0, W, safeY),                            // above safe
      mk(0, safeY2, W, H - safeY2),                  // under safe
      mk(0, safeY, safeX, safeY2 - safeY),           // left safe
      mk(safeX2, safeY, W - safeX2, safeY2 - safeY), // right safe
    ];
    
    // Repainting the outside of safe-zone
    let out = await this._paintRegionsWhite(buf, ring);
    
    // Repainting bottom strip of the image
    out = await this._fillBottomCaptionBandWhite(out, { x: safeX, y: safeY, x2: safeX2, y2: safeY2 });
    
    return out;
  
  }
  
  private async _paintRegionsWhite(
    buf: Buffer,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ): Promise<Buffer> {
    const layers = await Promise.all(
      rects
        .filter(r => r.width > 0 && r.height > 0)
        .map(async (r) => {
          const input = await this.sharp({
            create: {
              width: Math.floor(r.width),
              height: Math.floor(r.height),
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          }).png().toBuffer();
          return { input, left: Math.floor(r.left), top: Math.floor(r.top) };
        })
    );

    if (!layers.length) return buf;

    return this.sharp(buf).composite(layers).png().toBuffer();
  }

  //#region OCR Functions
  private async _detectTextBoxesDual(
    buf: Buffer,
  ): Promise<{ boxes: OcrBox[]; width: number; height: number }> {
    if (!this.worker) throw new Error('OCR worker not initialized');

    const meta = await this.sharp(buf).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1024;

    const pass = async (psm: PSM) => {
      await this.worker!.setParameters({ tessedit_pageseg_mode: psm });

      const { data } = await this.worker!.recognize(buf);
      const words = (data.words || []) as TesseractWord[];
      const lines = (data.lines || []) as TesseractLine[];

      const wordBoxes: OcrBox[] = words.map((w) => ({
        x: w.bbox.x0,
        y: w.bbox.y0,
        w: w.bbox.x1 - w.bbox.x0,
        h: w.bbox.y1 - w.bbox.y0,
        conf: (w.confidence ?? w.conf ?? 0),
        text: (w.text || '').trim(),
      }));
      const lineBoxes: OcrBox[] = lines.map((l) => ({
        x: l.bbox.x0,
        y: l.bbox.y0,
        w: l.bbox.x1 - l.bbox.x0,
        h: l.bbox.y1 - l.bbox.y0,
        conf: (l.confidence ?? l.conf ?? 0),
        text: (l.text || '').trim(),
      }));

      return [...wordBoxes, ...lineBoxes];
    };

    const b1 = await pass(PSM.SINGLE_BLOCK);
    const b2 = await pass(PSM.SPARSE_TEXT);
    const all = this._mergeNearby([...b1, ...b2], 4);

    return { boxes: all, width, height };
  }

  private async _prepareOcrImage(buf: Buffer, W: number) {
    const targetW = Math.min(1024, W);
    const resized = W > targetW ? await this.sharp(buf).resize({ width: targetW }).png().toBuffer() : buf;
    const scale = W / targetW;
    return { resized, scale };
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error(`Timeout after ${ms}ms`)), ms);
    });
    try {
      return (await Promise.race([p, timeoutPromise])) as T;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
  //#endregion

  //#region Utilities for whitelist / safe-zone
  private _mergeNearby(boxes: OcrBox[], tol = 10): OcrBox[] {
    if (boxes.length <= 1) return boxes.slice();

    const overlap = (a: OcrBox, b: OcrBox): boolean => {
      const ax2 = a.x + a.w,
        ay2 = a.y + a.h;
      const bx2 = b.x + b.w,
        by2 = b.y + b.h;
      const sepX = bx2 + tol < a.x - tol || ax2 + tol < b.x - tol;
      const sepY = by2 + tol < a.y - tol || ay2 + tol < b.y - tol;

      return !(sepX || sepY);
    };

    const merge2 = (a: OcrBox, b: OcrBox): OcrBox => {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.max(a.x + a.w, b.x + b.w) - x;
      const h = Math.max(a.y + a.h, b.y + b.h) - y;

      return { x, y, w, h, conf: Math.max(a.conf, b.conf), text: `${a.text} ${b.text}`.trim() };
    };

    const groups: OcrBox[][] = [];
    const used = new Array(boxes.length).fill(false);

    for (let i = 0; i < boxes.length; i++) {
      if (used[i]) continue;

      used[i] = true;

      const queue: OcrBox[] = [boxes[i]];
      const group: OcrBox[] = [];

      while (queue.length) {
        const cur = queue.pop()!;

        group.push(cur);

        for (let j = 0; j < boxes.length; j++) {
          if (used[j]) continue;
          if (overlap(cur, boxes[j])) {
            used[j] = true;
            queue.push(boxes[j]);
          }
        }
      }

      groups.push(group);
    }

    return groups.map((g) => g.slice(1).reduce((acc, b) => merge2(acc, b), g[0]));
  }

  private async _fillBottomCaptionBandWhite(
    buf: Buffer,
    safe?: { x: number; y: number; x2: number; y2: number }, 
  ): Promise<Buffer> {
    const img = this.sharp(buf);
    const meta = await img.metadata();
    const W = meta.width ?? 1024;
    const H = meta.height ?? 1024;

    const top = Math.floor(H * 0.75); // last ~25 %
    const band = await img
      .extract({ left: 0, top, width: W, height: H - top })
      .greyscale()
      .threshold(220)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = band.info.width!;
    const h = band.info.height!;
    let filledRows = 0;

    for (let y = 0; y < h; y++) {
      let cnt = 0;
      const rowStart = y * w;

      for (let x = 0; x < w; x++) if (band.data[rowStart + x] === 0) cnt++; 

      if (cnt / w > 0.1) filledRows++;
    }

    if (filledRows / h > 0.25) {
      const bandH = Math.max(Math.floor(H * 0.12), Math.min(H - top, Math.floor(H * 0.18)));
      const bandTop = H - bandH;
      const margin = Math.floor(H * 0.02);
      const safeBottom = safe ? safe.y2 : Math.floor(H * 0.60);

      // don't overflow safe‑zone
      if (bandTop <= safeBottom + margin) return buf;

      const white = await this.sharp({
        create: { width: W, height: bandH, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .png()
        .toBuffer();

      return this.sharp(buf).composite([{ input: white, left: 0, top: H - bandH }]).png().toBuffer();
    }

    return buf;
  }

  private async _autoSafeZone(
    buf: Buffer,
    W: number,
    H: number,
    ocrBoxes: OcrBox[],
    pad?: Insets,   
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    // CCL Binarization (Connected Component Labeling)
    const thr = await this.sharp(buf)
      .greyscale()
      .blur(0.4)
      .threshold(210)
      .raw()
      .toBuffer({ resolveWithObject: true });
  
    const w = thr.info.width!, h = thr.info.height!;
    const bin = thr.data; // 0|255
    const data = new Uint8Array(bin.length);

    for (let i = 0; i < bin.length; i++) data[i] = (bin[i] === 0) ? 1 : 0;
  
    // --- CCL (8-neighbours) → components ---
    const lab = new Int32Array(w * h);
    const idx = (x: number, y: number) => y * w + x;
    let label = 0;
    const comps: { x: number; y: number; x2: number; y2: number; area: number; cx: number; cy: number }[] = [];
  
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (data[idx(xx, yy)] === 1 && lab[idx(xx, yy)] === 0) {
          label++;

          let minx = xx, miny = yy, maxx = xx, maxy = yy, area = 0, sx = 0, sy = 0;
          const st: Array<[number, number]> = [[xx, yy]];

          lab[idx(xx, yy)] = label;

          while (st.length) {
            const [cx, cy] = st.pop()!;

            area++; sx += cx; sy += cy;

            if (cx < minx) minx = cx; if (cy < miny) miny = cy;
            if (cx > maxx) maxx = cx; if (cy > maxy) maxy = cy;

            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;

              const nx = cx + dx, ny = cy + dy;

              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const id = idx(nx, ny);

                if (data[id] === 1 && lab[id] === 0) {
                  lab[id] = label;
                  st.push([nx, ny]);
                }
              }
            }
          }

          const cx = sx / area, cy = sy / area;

          comps.push({ x: minx, y: miny, x2: maxx + 1, y2: maxy + 1, area, cx, cy });
        }
      }
    }
  
    // --- "logo" Candidate: big component near the center ---
    const midX0 = W * 0.18, midX1 = W * 0.82;
    const midY0 = H * 0.15, midY1 = H * 0.70;
    const minLogoArea = Math.max(400, Math.floor(W * H * 0.01));
  
    const logo = comps
      .map(c => ({ x: c.x, y: c.y, w: c.x2 - c.x, h: c.y2 - c.y, area: c.area, cx: c.cx, cy: c.cy }))
      .filter(c =>
        c.area >= minLogoArea &&
        c.cx >= midX0 && c.cx <= midX1 &&
        c.cy >= midY0 && c.cy <= midY1
      )
      .sort((a, b) => b.area - a.area)[0];
  
    // --- text lines from OCR (brand/slogan) ---
    const MIN_H_TXT = Math.max(10, Math.floor(H * 0.03));
    const MAX_H_TXT = Math.floor(H * 0.14);
    const textLines = this._mergeNearby(
      (ocrBoxes || []).filter(b => {
        const wok = b.w >= W * 0.25;
        const hok = b.h >= MIN_H_TXT && b.h <= MAX_H_TXT;
        const yOk = b.y >= H * 0.20 && (b.y + b.h) <= H * 0.92;
        return wok && hok && yOk;
      }),
      Math.round(W * 0.01)
    );
  
    // --- union (logo + text) → base box ---
    let x: number, y: number, x2: number, y2: number;
    const pool: Array<{ x: number; y: number; w: number; h: number }> = [];

    if (logo) pool.push(logo);

    textLines.forEach(b => pool.push({ x: b.x, y: b.y, w: b.w, h: b.h }));
  
    if (pool.length) {
      x  = Math.min(...pool.map(b => b.x));
      y  = Math.min(...pool.map(b => b.y));
      x2 = Math.max(...pool.map(b => b.x + b.w));
      y2 = Math.max(...pool.map(b => b.y + b.h));
    } else {
      // fallback: center
      x = W * 0.35; x2 = W * 0.65; y = H * 0.35; y2 = H * 0.65;
    }
  
    // --- base padding ---
    const padX = Math.round(W * 0.08);
    const padYTop = Math.round(H * 0.06);
    const padYBot = Math.round(H * 0.10);
  
    x  = Math.max(0, x - padX);
    y  = Math.max(0, y - padYTop);
    x2 = Math.min(W, x2 + padX);
    y2 = Math.min(H, y2 + padYBot);
  
    // --- explicit offset ---
    const off = this.resolveInsets(pad, W, H);
    x  -= off.left;
    y  -= off.top;
    x2 += off.right;
    y2 += off.bottom;
  
    // --- additional addaptive padding near 'ink' on the edges ---
    const sampleStrip = (sx: number, sy: number, ex: number, ey: number) => {
      let dark = 0, tot = 0;
      const x0 = Math.max(0, Math.min(sx, ex)), y0 = Math.max(0, Math.min(sy, ey));
      const x1 = Math.min(w, Math.max(sx, ex)), y1 = Math.min(h, Math.max(sy, ey));

      for (let yy = y0; yy < y1; yy++) {
        const row = yy * w;

        for (let xx = x0; xx < x1; xx++) {
          if (bin[row + xx] === 0) dark++; // 0 = "ink"

          tot++;
        }
      }

      return tot ? dark / tot : 0;
    };
  
    const maxGrowX = Math.round(W * 0.12);
    const maxGrowY = Math.round(H * 0.12);
    const stepX = Math.max(4, Math.round(W * 0.01));
    const stepY = Math.max(4, Math.round(H * 0.01));
    const densThresh = 0.015;
  
    // left
    let grow = 0;

    while (grow < maxGrowX) {
      const d = sampleStrip(Math.max(0, x - (grow + stepX)), y, Math.max(0, x - grow), y2);

      if (d < densThresh) break;

      grow += stepX;
    }
    x -= grow;
  
    // right
    grow = 0;
    
    while (grow < maxGrowX) {
      const d = sampleStrip(Math.min(W, x2 + grow), y, Math.min(W, x2 + grow + stepX), y2);

      if (d < densThresh) break;

      grow += stepX;
    }

    x2 += grow;
  
    // top
    grow = 0;

    while (grow < maxGrowY) {
      const d = sampleStrip(x, Math.max(0, y - (grow + stepY)), x2, Math.max(0, y - grow));

      if (d < densThresh) break;

      grow += stepY;
    }

    y -= grow;
  
    // bottom
    grow = 0;

    while (grow < maxGrowY) {
      const d = sampleStrip(x, Math.min(H, y2 + grow), x2, Math.min(H, y2 + grow + stepY));

      if (d < densThresh) break;

      grow += stepY;
    }

    y2 += grow;
  
    // --- clamp & return ---
    return this.clampRect(
      { x: Math.round(x), y: Math.round(y), x2: Math.round(x2), y2: Math.round(y2) },
      W, H
    );
  }
  //#endregion
}
