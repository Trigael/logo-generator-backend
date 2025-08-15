import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createWorker, type Worker as TesseractWorker, PSM } from 'tesseract.js';

export type OcrBox = { x: number; y: number; w: number; h: number; conf: number; text: string };
type TesseractWord = { bbox: { x0: number; y0: number; x1: number; y1: number }; confidence?: number; conf?: number; text?: string; };
type TesseractLine = { bbox: { x0: number; y0: number; x1: number; y1: number }; confidence?: number; conf?: number; text?: string; };
type Insets = { top?: number; right?: number; bottom?: number; left?: number };

type CleanOptions = {
  mode?: 'blurred' | 'solid';     // default 'solid'
  featherPct?: number;            // default ~1.2 % kratší strany
  blurSigma?: number;             // pro 'blurred'
};

@Injectable()
export class TextCleanerService implements OnModuleInit, OnModuleDestroy {
  private worker: TesseractWorker | null = null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  private readonly sharp = require('sharp');

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
    if (this.worker) { await this.worker.terminate(); this.worker = null; }
  }

  // -------------------- PUBLIC API --------------------

  async clean(buf: Buffer, _brand: string, _slogan?: string, opts: CleanOptions = {}): Promise<Buffer> {
    const meta = await this.sharp(buf).metadata();
    const W = meta.width ?? 1024;
    const H = meta.height ?? 1024;

    // OCR (zmenšeno kvůli rychlosti)
    const { resized, scale } = await this._prepareOcrImage(buf, W);
    let ocrBoxes: OcrBox[] = [];
    try {
      const res = await this.withTimeout(this._detectTextBoxesDual(resized), 3500);
      ocrBoxes = res.boxes.map(b => ({
        x: Math.round(b.x * scale), y: Math.round(b.y * scale),
        w: Math.round(b.w * scale), h: Math.round(b.h * scale),
        conf: b.conf, text: b.text,
      }));
    } catch {}

    // 1) VERTIKÁLNÍ safe-zóna (full-width)
    let safe = await this._autoSafeZoneFullWidth(buf, W, H, ocrBoxes, { top: 0.03, bottom: 0.05 });

    // 2) Potlač caption pásy + tenký/rohový text (stále jen výška)
    safe = await this._suppressCaptionBands(buf, W, H, safe, ocrBoxes);

    // 3) Fallback pro extrémně jemný spodní text ve středovém pásu (šedotón)
    safe = await this._trimBottomByCentralStrip(buf, W, H, safe);

    // 4) Fallback na barevný mikro-watermark: DoG (orig vs blur) ve středovém pásu
    safe = await this._forceTrimBottomByDoG(buf, W, H, safe);

    // 5) Featherovaná maska safe-zóny (alpha)
    const featherPct = opts.featherPct ?? 0.012;
    const FEATHER = Math.max(2, Math.round(Math.min(W, H) * featherPct));
    const safeY  = Math.max(0, Math.min(safe.y, safe.y2));
    const safeY2 = Math.min(H, Math.max(safe.y, safe.y2));
    const safeW  = W;
    const safeH  = Math.max(0, safeY2 - safeY);

    const maskRGBA = await this.sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{
        input: await this.sharp({
          create: { width: safeW, height: safeH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        }).png().toBuffer(),
        left: 0, top: safeY,
      }])
      .blur(FEATHER).png().toBuffer();

    const maskSafe    = await this.sharp(maskRGBA).extractChannel(3).png().toBuffer();
    const maskOutside = await this.sharp(maskSafe).negate().png().toBuffer();

    // 6) Originál uvnitř safe-zóny
    const originSafeOnly = await this.sharp(buf).removeAlpha().joinChannel(maskSafe).png().toBuffer();

    // 7) Pozadí mimo safe
    const mode = opts.mode ?? 'solid';
    let background: Buffer;
    if (mode === 'solid') {
      const color = await this._estimateRingColor(buf, W, H, { x: 0, y: safeY, x2: W, y2: safeY2 });
      background = await this.sharp({ create: { width: W, height: H, channels: 3, background: color } }).png().toBuffer();
    } else {
      const sigma = opts.blurSigma ?? 40;
      background = await this.sharp(buf).blur(sigma).png().toBuffer();
    }
    const bgOutsideOnly = await this.sharp(background).removeAlpha().joinChannel(maskOutside).png().toBuffer();

    // 8) Složení (plně krycí PNG)
    const out = await this.sharp({
      create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    }).composite([{ input: bgOutsideOnly }, { input: originSafeOnly }]).png().toBuffer();

    return out;
  }

  // -------------------- HELPERS --------------------

  private resolveInsets(pad: Insets | undefined, W: number, H: number) {
    const toPx = (v: number | undefined, base: number) => (!v ? 0 : (v > 1 ? Math.round(v) : Math.round(v * base)));
    return { top: toPx(pad?.top, H), right: toPx(pad?.right, W), bottom: toPx(pad?.bottom, H), left: toPx(pad?.left, W) };
  }
  private clampRect(r: { x: number; y: number; x2: number; y2: number }, W: number, H: number) {
    const x = Math.max(0, Math.min(r.x, r.x2, W));
    const y = Math.max(0, Math.min(r.y, r.y2, H));
    const x2 = Math.max(x, Math.min(Math.max(r.x, r.x2), W));
    const y2 = Math.max(y, Math.min(Math.max(r.y, r.y2), H));
    return { x, y, x2, y2 };
  }
  private async _prepareOcrImage(buf: Buffer, W: number) {
    const targetW = Math.min(1024, W);
    const resized = W > targetW ? await this.sharp(buf).resize({ width: targetW }).png().toBuffer() : buf;
    const scale = W / targetW;
    return { resized, scale };
  }
  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, rej) => { timeoutId = setTimeout(() => rej(new Error(`Timeout after ${ms}ms`)), ms); });
    try { return (await Promise.race([p, timeoutPromise])) as T; }
    finally { if (timeoutId) clearTimeout(timeoutId); }
  }

  // ---------- OCR (dual pass)
  private async _detectTextBoxesDual(buf: Buffer): Promise<{ boxes: OcrBox[]; width: number; height: number }> {
    if (!this.worker) throw new Error('OCR worker not initialized');
    const meta = await this.sharp(buf).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1024;

    const pass = async (psm: PSM) => {
      await this.worker!.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await this.worker!.recognize(buf);
      const words = (data.words || []) as TesseractWord[];
      const lines = (data.lines || []) as TesseractLine[];
      const ws: OcrBox[] = words.map(w => ({ x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0, conf: (w.confidence ?? w.conf ?? 0), text: (w.text || '').trim() }));
      const ls: OcrBox[] = lines.map(l => ({ x: l.bbox.x0, y: l.bbox.y0, w: l.bbox.x1 - l.bbox.x0, h: l.bbox.y1 - l.bbox.y0, conf: (l.confidence ?? l.conf ?? 0), text: (l.text || '').trim() }));
      return [...ws, ...ls];
    };

    const b1 = await pass(PSM.SINGLE_BLOCK);
    const b2 = await pass(PSM.SPARSE_TEXT);
    const all = this._mergeNearby([...b1, ...b2], 4);
    return { boxes: all, width, height };
  }
  private _mergeNearby(boxes: OcrBox[], tol = 10): OcrBox[] {
    if (boxes.length <= 1) return boxes.slice();
    const overlap = (a: OcrBox, b: OcrBox) => {
      const ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
      const sepX = bx2 + tol < a.x - tol || ax2 + tol < b.x - tol;
      const sepY = by2 + tol < a.y - tol || ay2 + tol < b.y - tol;
      return !(sepX || sepY);
    };
    const merge2 = (a: OcrBox, b: OcrBox): OcrBox => {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const w = Math.max(a.x + a.w, b.x + b.w) - x;
      const h = Math.max(a.y + a.h, b.y + b.h) - y;
      return { x, y, w, h, conf: Math.max(a.conf, b.conf), text: `${a.text} ${b.text}`.trim() };
    };
    const groups: OcrBox[][] = []; const used = new Array(boxes.length).fill(false);
    for (let i = 0; i < boxes.length; i++) {
      if (used[i]) continue; used[i] = true;
      const q: OcrBox[] = [boxes[i]]; const g: OcrBox[] = [];
      while (q.length) {
        const cur = q.pop()!; g.push(cur);
        for (let j = 0; j < boxes.length; j++) if (!used[j] && overlap(cur, boxes[j])) { used[j] = true; q.push(boxes[j]); }
      }
      groups.push(g);
    }
    return groups.map(g => g.slice(1).reduce((acc, b) => merge2(acc, b), g[0]));
  }

  // ---------- Safe-zóna: VERTIKÁLNÍ (full-width)
  private async _autoSafeZoneFullWidth(
    buf: Buffer, W: number, H: number, ocrBoxes: OcrBox[], pad?: Insets
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    const g = await this.sharp(buf).greyscale().blur(0.6).raw().toBuffer({ resolveWithObject: true });
    const w = g.info.width!, h = g.info.height!; const gray = g.data as Buffer;
    const THR = 233;
    const bin = new Uint8Array(w * h); for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < THR ? 1 : 0;

    const x0 = Math.floor(W * 0.18), x1 = Math.ceil(W * 0.82), bandW = Math.max(1, x1 - x0);
    const density = new Float32Array(h), trans = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      const row = y * w; let dark = 0, changes = 0; let prev = bin[row + x0];
      for (let x = x0; x < x1; x++) { const v = bin[row + x]; dark += v; if (x > x0 && v !== prev) changes++; prev = v; }
      density[y] = dark / bandW; trans[y] = changes / Math.max(1, bandW);
    }
    const smooth = (arr: Float32Array, win: number) => {
      const out = new Float32Array(arr.length); let acc = 0;
      for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (i >= win) acc -= arr[i - win]; out[i] = acc / Math.min(win, i + 1); }
      return out;
    };
    const win = Math.max(3, Math.floor(H * 0.02));
    const dS = smooth(density, win), tS = smooth(trans, win);

    const score = new Float32Array(h); for (let y = 0; y < h; y++) score[y] = dS[y] * tS[y];
    const yMin = Math.floor(H * 0.12), yMax = Math.ceil(H * 0.92);
    const minH = Math.max(28, Math.floor(H * 0.08)), maxH = Math.max(minH, Math.floor(H * 0.55));
    const pref = new Float32Array(h + 1); for (let i = 0; i < h; i++) pref[i + 1] = pref[i] + score[i];

    let bestY0 = Math.floor(H * 0.35), bestY1 = Math.ceil(H * 0.65), bestSum = -1;
    for (let y0 = yMin; y0 <= yMax - minH; y0++) {
      const y1min = y0 + minH, y1max = Math.min(yMax, y0 + maxH);
      const tryEnd = (y1: number) => { const s = pref[y1] - pref[y0]; if (s > bestSum) { bestSum = s; bestY0 = y0; bestY1 = y1; } };
      tryEnd(y1min); tryEnd(Math.floor((y1min + y1max) / 2)); tryEnd(y1max);
    }

    // Přilep velké OCR řádky (brand/slogan)
    const MIN_H_TXT = Math.max(10, Math.floor(H * 0.03));
    const MAX_H_TXT = Math.floor(H * 0.16);
    const MIN_W_TXT = Math.floor(W * 0.35);
    const textLines = this._mergeNearby(
      (ocrBoxes || []).filter(b => b.h >= MIN_H_TXT && b.h <= MAX_H_TXT && b.w >= MIN_W_TXT &&
        b.y >= H * 0.10 && (b.y + b.h) <= H * 0.95),
      Math.round(W * 0.01)
    );
    if (textLines.length) {
      const tMinY = Math.min(...textLines.map(b => b.y));
      const tMaxY = Math.max(...textLines.map(b => b.y + b.h));
      bestY0 = Math.min(bestY0, tMinY); bestY1 = Math.max(bestY1, tMaxY);
    }

    const off = this.resolveInsets(pad, W, H);
    const y  = Math.max(0, Math.round(bestY0 - H * 0.03) - (off.top ?? 0));
    const y2 = Math.min(H, Math.round(bestY1 + H * 0.05) + (off.bottom ?? 0));
    return this.clampRect({ x: 0, y, x2: W, y2 }, W, H);
  }

  // ---------- Potlačení caption pásů + tenkých/rohových textů (stále jen výška)
  private async _suppressCaptionBands(
    buf: Buffer, W: number, H: number,
    safe: { x: number; y: number; x2: number; y2: number },
    ocrBoxes: OcrBox[]
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    const g = await this.sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    const w = g.info.width!, h = g.info.height!; const gray = g.data as Buffer;

    const x0 = Math.floor(W * 0.18), x1 = Math.ceil(W * 0.82), bandW = Math.max(1, x1 - x0);
    const density = new Float32Array(h), trans = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      const row = y * w; let dark = 0, changes = 0; let prev = gray[row + x0] < 233 ? 1 : 0;
      for (let x = x0; x < x1; x++) {
        const cur = gray[row + x] < 233 ? 1 : 0; dark += cur;
        if (x > x0 && cur !== prev) changes++; prev = cur;
      }
      density[y] = dark / bandW; trans[y] = changes / Math.max(1, bandW);
    }

    const mark: Uint8Array = new Uint8Array(h);
    for (let y = 0; y < h; y++) if (density[y] >= 0.16 || (density[y] >= 0.02 && trans[y] >= 0.10)) mark[y] = 1;

    const SCAN_FROM = Math.floor(H * 0.70), SCAN_TO = Math.floor(H * 0.30);
    const MIN_H = Math.max(Math.floor(H * 0.04), 8);
    const MARGIN = Math.floor(H * 0.012);
    const MIN_SAFE_H = Math.max(Math.floor(H * 0.20), 48);

    // spodní souvislý běh
    let bestLenB = 0, bestTopB = -1, run = 0, runTop = -1;
    for (let y = H - 1; y >= SCAN_FROM; y--) {
      if (mark[y]) { if (!run) runTop = y; run++; }
      else if (run) { if (run > bestLenB) { bestLenB = run; bestTopB = runTop; } run = 0; }
    }
    if (run > bestLenB) { bestLenB = run; bestTopB = runTop; }

    // horní souvislý běh
    let bestLenT = 0, bestBotT = -1; run = 0; let runBot = -1;
    for (let y = 0; y <= SCAN_TO; y++) {
      if (mark[y]) { run++; runBot = y; }
      else if (run) { if (run > bestLenT) { bestLenT = run; bestBotT = runBot; } run = 0; }
    }
    if (run > bestLenT) { bestLenT = run; bestBotT = runBot; }

    let y  = safe.y, y2 = safe.y2;

    if (bestLenB >= MIN_H && bestTopB > 0) {
      const capTop = bestTopB - MARGIN;
      if (capTop > y + MIN_SAFE_H) y2 = Math.min(y2, capTop);
    }
    if (bestLenT >= MIN_H && bestBotT > 0) {
      const capBot = bestBotT + MARGIN;
      if (capBot < y2 - MIN_SAFE_H) y = Math.max(y, capBot);
    }

    // OCR záchrana 1: široké spodní řádky (caption uprostřed)
    const wide = this._findBottomTextViaOCR(ocrBoxes, W, H);
    if (wide) {
      const capTop = wide.top - MARGIN;
      if (capTop > y + MIN_SAFE_H) y2 = Math.min(y2, capTop);
    }

    // OCR záchrana 2: malý rohový watermark dole
    const edge = this._findEdgeBottomTextViaOCR(ocrBoxes, W, H);
    if (edge) {
      const capTop = edge.top - MARGIN;
      if (capTop > y + MIN_SAFE_H) y2 = Math.min(y2, capTop);
    }

    y  = Math.max(0, Math.min(y, H - MIN_SAFE_H));
    y2 = Math.max(y + MIN_SAFE_H, Math.min(y2, H));
    return { x: 0, y, x2: W, y2 };
  }

  // ---------- Fallback 1: extrémně tenký spodní text ve středovém pásu (šedotón)
  private async _trimBottomByCentralStrip(
    buf: Buffer,
    W: number,
    H: number,
    safe: { x: number; y: number; x2: number; y2: number },
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    const g = await this.sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    const w = g.info.width!, h = g.info.height!;
    const gray = g.data as Buffer;

    const x0 = Math.floor(W * 0.30);
    const x1 = Math.ceil (W * 0.70);
    const bandW = Math.max(1, x1 - x0);

    const DENS_THR = 0.004;   // 0.4 %
    const EDGE_THR = 0.020;   // 2 %
    const THR_VAL  = 240;
    const MIN_RUN  = Math.max(5, Math.floor(H * 0.006));
    const START_Y  = Math.floor(H * 0.60);
    const MARGIN   = Math.floor(H * 0.012);
    const MIN_SAFE_H = Math.max(Math.floor(H * 0.20), 48);

    const density = new Float32Array(h);
    const trans   = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let dark = 0, changes = 0;
      let prev = gray[row + x0] < THR_VAL ? 1 : 0;
      for (let x = x0; x < x1; x++) {
        const cur = (gray[row + x] < THR_VAL) ? 1 : 0;
        dark += cur;
        if (x > x0 && cur !== prev) changes++;
        prev = cur;
      }
      density[y] = dark / bandW;
      trans[y]   = changes / Math.max(1, bandW);
    }

    let run = 0;
    let runTop = -1;
    for (let y = H - 1; y >= START_Y; y--) {
      const mark = (density[y] >= DENS_THR) || (trans[y] >= EDGE_THR);
      if (mark) { if (!run) runTop = y; run++; }
      else { if (run >= MIN_RUN) break; run = 0; runTop = -1; }
    }

    let y  = safe.y;
    let y2 = safe.y2;

    if (run >= MIN_RUN && runTop > 0) {
      const capTop = runTop - MARGIN;
      if (capTop > y + MIN_SAFE_H) y2 = Math.min(y2, capTop);
    }

    y  = Math.max(0, Math.min(y, H - MIN_SAFE_H));
    y2 = Math.max(y + MIN_SAFE_H, Math.min(y2, H));
    return { x: 0, y, x2: W, y2 };
  }

  // ---------- Fallback 2: barevný mikro-watermark přes DoG hrany ve středovém pásu
  private async _forceTrimBottomByDoG(
    buf: Buffer,
    W: number,
    H: number,
    safe: { x: number; y: number; x2: number; y2: number },
  ): Promise<{ x: number; y: number; x2: number; y2: number }> {
    // vytvoř mapu hran: difference(orig, blurred)
    const blurred = await this.sharp(buf).blur(5).toColorspace('srgb').png().toBuffer();
    const diffRaw = await this.sharp(buf)
      .toColorspace('srgb')
      .composite([{ input: blurred, blend: 'difference' }])
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = diffRaw.info.width!, h = diffRaw.info.height!;
    const data = diffRaw.data as Buffer;

    // spodní středový pás: 35–65 % šířky; hledej souvislý běh „hrané energie“
    const x0 = Math.floor(W * 0.35);
    const x1 = Math.ceil (W * 0.65);
    const bandW = Math.max(1, x1 - x0);

    const ENERGY_THR = 0.010;               // 1 % průměrná energie v řádku
    const MIN_RUN    = Math.max(4, Math.floor(H * 0.005));
    const START_Y    = Math.floor(H * 0.62);
    const MARGIN     = Math.floor(H * 0.012);
    const MIN_SAFE_H = Math.max(Math.floor(H * 0.20), 48);

    let run = 0, runTop = -1;

    for (let y = H - 1; y >= START_Y; y--) {
      const row = y * w;
      let sum = 0;
      for (let x = x0; x < x1; x++) sum += data[row + x]; // 0..255
      const energy = sum / (255 * bandW); // 0..1
      const mark = energy >= ENERGY_THR;
      if (mark) { if (!run) runTop = y; run++; }
      else { if (run >= MIN_RUN) break; run = 0; runTop = -1; }
    }

    let y  = safe.y;
    let y2 = safe.y2;

    if (run >= MIN_RUN && runTop > 0) {
      const capTop = runTop - MARGIN;
      if (capTop > y + MIN_SAFE_H) y2 = Math.min(y2, capTop);
    }

    y  = Math.max(0, Math.min(y, H - MIN_SAFE_H));
    y2 = Math.max(y + MIN_SAFE_H, Math.min(y2, H));
    return { x: 0, y, x2: W, y2 };
  }

  // ---------- OCR helpery

  // široké spodní řádky (typický caption přes střed)
  private _findBottomTextViaOCR(ocrBoxes: OcrBox[], W: number, H: number):
    { top: number; bottom: number } | null {
    const MIN_H = Math.max(6, Math.floor(H * 0.012));
    const MAX_H = Math.floor(H * 0.06);
    const MIN_W = Math.floor(W * 0.25);
    const Y_MIN = Math.floor(H * 0.75);

    const lines = this._mergeNearby(
      (ocrBoxes || []).filter(b =>
        b.h >= MIN_H && b.h <= MAX_H &&
        b.w >= MIN_W &&
        (b.y >= Y_MIN || (b.y + b.h) >= Y_MIN)
      ),
      Math.round(W * 0.01)
    );

    if (!lines.length) return null;
    const top = Math.min(...lines.map(b => b.y));
    const bottom = Math.max(...lines.map(b => b.y + b.h));
    return { top, bottom };
  }

  // malý edge watermark dole (vlevo/vpravo), úzký blok
  private _findEdgeBottomTextViaOCR(ocrBoxes: OcrBox[], W: number, H: number):
    { top: number; bottom: number } | null {
    const MIN_H = Math.max(5, Math.floor(H * 0.008));
    const MAX_H = Math.floor(H * 0.06);
    const MIN_W = Math.floor(W * 0.06);
    const MAX_W = Math.floor(W * 0.30);
    const Y_MIN = Math.floor(H * 0.70);
    const EDGE  = Math.floor(W * 0.30); // levá/pravá třetina

    const candidates = (ocrBoxes || []).filter(b => {
      const cx = b.x + b.w / 2;
      const atEdge = (cx < EDGE) || (cx > W - EDGE);
      return atEdge &&
        b.h >= MIN_H && b.h <= MAX_H &&
        b.w >= MIN_W && b.w <= MAX_W &&
        (b.y >= Y_MIN || (b.y + b.h) >= Y_MIN);
    });

    const groups = this._mergeNearby(candidates, Math.round(W * 0.01));
    if (!groups.length) return null;

    const top = Math.min(...groups.map(b => b.y));
    const bottom = Math.max(...groups.map(b => b.y + b.h));
    return { top, bottom };
  }

  // ---------- Průměrná barva z ringu (pro 'solid' pozadí)
  private async _estimateRingColor(
    buf: Buffer, W: number, H: number, safe: { x: number; y: number; x2: number; y2: number }
  ): Promise<{ r: number; g: number; b: number }> {
    const safeY = Math.max(0, safe.y), safeY2 = Math.min(H, safe.y2);
    const rects = [
      { left: 0, top: 0, width: W, height: safeY },
      { left: 0, top: safeY2, width: W, height: H - safeY2 },
    ].filter(r => r.width > 0 && r.height > 0);

    if (!rects.length) return { r: 255, g: 255, b: 255 };

    let rSum = 0, gSum = 0, bSum = 0, n = 0;
    for (const r of rects) {
      const px = await this.sharp(buf)
        .extract(r).removeAlpha().toColorspace('srgb')
        .resize(1, 1, { kernel: 'lanczos3' }).raw().toBuffer();
      rSum += px[0]; gSum += px[1]; bSum += px[2]; n++;
    }
    return { r: Math.round(rSum / n), g: Math.round(gSum / n), b: Math.round(bSum / n) };
  }
}
