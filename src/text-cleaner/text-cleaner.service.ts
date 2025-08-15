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
    const safe = await this._autoSafeZoneFullWidth(buf, W, H, ocrBoxes, {
      top: 0.03,
      bottom: 0.05,
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

  private async _autoSafeZoneFullWidth(
    buf: Buffer,
    W: number,
    H: number,
    ocrBoxes: OcrBox[],
    pad?: Insets
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    // --- 1) Greyscale + silná binarizace (potlačí watermarky)
    const g = await this.sharp(buf)
      .greyscale()
      .blur(0.6)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = g.info.width!, h = g.info.height!;
    const gray = g.data as Buffer;
  
    const THR = 233; // 230–238 podle datasetu
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < THR ? 1 : 0; // 1=ink/dark
  
    // --- 2) Střední pás šířky (ignoruj okraje)
    const x0 = Math.floor(W * 0.18);
    const x1 = Math.ceil(W * 0.82);
    const bandW = Math.max(1, x1 - x0);
  
    // --- 3) Per-row metriky: hustota + počet přechodů (edge komplexita)
    const density = new Float32Array(h);
    const trans   = new Float32Array(h);
  
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let dark = 0, changes = 0;
      let prev = bin[row + x0];
      for (let x = x0; x < x1; x++) {
        const v = bin[row + x];
        dark += v;
        if (x > x0 && v !== prev) changes++;
        prev = v;
      }
      density[y] = dark / bandW;                 // [0..1]
      trans[y]   = changes / Math.max(1, bandW); // [0..1]
    }
  
    // --- 4) Vyhlazení
    const smooth = (arr: Float32Array, win: number) => {
      const out = new Float32Array(arr.length);
      let acc = 0;
      for (let i = 0; i < arr.length; i++) {
        acc += arr[i];
        if (i >= win) acc -= arr[i - win];
        out[i] = acc / Math.min(win, i + 1);
      }
      return out;
    };
    const win = Math.max(3, Math.floor(H * 0.02));
    const dS = smooth(density, win);
    const tS = smooth(trans,   win);
  
    // --- 5) Skóre: musí být i tmavé, i „strukturní“
    const score = new Float32Array(h);
    for (let y = 0; y < h; y++) score[y] = dS[y] * tS[y];
  
    const yMin = Math.floor(H * 0.12);
    const yMax = Math.ceil (H * 0.92);
    const minH = Math.max(28, Math.floor(H * 0.08));
    const maxH = Math.max(minH, Math.floor(H * 0.55));
  
    // prefix součty
    const pref = new Float32Array(h + 1);
    for (let i = 0; i < h; i++) pref[i + 1] = pref[i] + score[i];
  
    let bestY0 = Math.floor(H * 0.35);
    let bestY1 = Math.ceil (H * 0.65);
    let bestSum = -1;
  
    for (let y0 = yMin; y0 <= yMax - minH; y0++) {
      const y1min = y0 + minH;
      const y1max = Math.min(yMax, y0 + maxH);
      const tryEnd = (y1: number) => {
        const s = pref[y1] - pref[y0];
        if (s > bestSum) { bestSum = s; bestY0 = y0; bestY1 = y1; }
      };
      tryEnd(y1min);
      tryEnd(Math.floor((y1min + y1max) / 2));
      tryEnd(y1max);
    }
  
    // --- 6) Přilep „velké“ OCR řádky (brand/slogan), ne mikrotext
    const MIN_H_TXT = Math.max(10, Math.floor(H * 0.03));
    const MAX_H_TXT = Math.floor(H * 0.16);
    const MIN_W_TXT = Math.floor(W * 0.35);
  
    const textLines = this._mergeNearby(
      (ocrBoxes || []).filter(b => {
        const hok = b.h >= MIN_H_TXT && b.h <= MAX_H_TXT;
        const wok = b.w >= MIN_W_TXT;
        const yOk = b.y >= H * 0.10 && (b.y + b.h) <= H * 0.95;
        return hok && wok && yOk;
      }),
      Math.round(W * 0.01)
    );
  
    if (textLines.length) {
      const tMinY = Math.min(...textLines.map(b => b.y));
      const tMaxY = Math.max(...textLines.map(b => b.y + b.h));
      bestY0 = Math.min(bestY0, tMinY);
      bestY1 = Math.max(bestY1, tMaxY);
    }
  
    // --- 6b) Refinement: flood-fill POUZE po hranách (edge pixelech)
    {
      const y0 = Math.max(0, Math.floor(bestY0 - H * 0.06));
      const y1 = Math.min(H - 1, Math.ceil (bestY1 + H * 0.08));
      const hh = y1 - y0 + 1;
    
      // edge pixel = tmavý a má v 8-sousedství světlého souseda (přechod)
      const isEdge = (xx: number, yy: number) => {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) return false;
        if (bin[yy * w + xx] === 0) return false; // světlý (pozadí)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = xx + dx, ny = yy + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            if (bin[ny * w + nx] === 0) return true;
          }
        }
        return false;
      };
    
      // multi-seed po celé výšce okna, v širším pásu
      const xs0 = Math.floor(W * 0.14);
      const xs1 = Math.ceil (W * 0.86);
      const seeds: Array<[number, number]> = [];
      for (let yy = Math.max(bestY0, 0); yy <= Math.min(bestY1, H - 1); yy++) {
        for (let xx = xs0; xx < xs1; xx += 2) if (isEdge(xx, yy)) seeds.push([xx, yy]);
      }
    
      if (seeds.length) {
        const visited = new Uint8Array(w * hh);
        const idxL = (xx: number, yy: number) => (yy - y0) * w + xx;
        const stack = seeds.slice();
      
        let minY = H, maxY = -1;
        for (const [sx, sy] of seeds) visited[idxL(sx, sy)] = 1;
      
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= W || ny < y0 || ny > y1) continue;
            const li = idxL(nx, ny);
            if (visited[li]) continue;
            if (isEdge(nx, ny)) {
              visited[li] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      
        if (maxY >= minY) {
          bestY0 = Math.max(bestY0, minY);
          bestY1 = Math.min(Math.max(bestY1, maxY), H - 1);
        }
      }
    }
  
    // --- 7) Jemný vertikální pad; horizontálně full-width
    const off = this.resolveInsets(pad, W, H);
    const y  = Math.max(0, Math.round(bestY0 - H * 0.03) - (off.top ?? 0));
    const y2 = Math.min(H, Math.round(bestY1 + H * 0.05) + (off.bottom ?? 0));
  
    return this.clampRect({ x: 0, y, x2: W, y2 }, W, H);
  }
  //#endregion
}
