import * as fs from 'fs';
import * as archiver from 'archiver';
import { join, basename, isAbsolute } from 'path';
import * as path from 'path'
import axios from 'axios';

const ZIP_FILEPATH = 'public/zips'

export function getCurrencySymbol(currency: string) {
    switch(currency.toLocaleUpperCase()) {
        case 'EUR':
            return '€'
        case 'CZK':
            return 'Kč'
    }
}

export function getSecret(pathOrValue: string): string {
  try {
    if (pathOrValue && fs.existsSync(pathOrValue)) {
      return fs.readFileSync(pathOrValue, 'utf8').trim();
    }
  } catch (err) {
    console.warn(`[SECRETS] Failed to load from path: ${pathOrValue}`, err);
  }

  return pathOrValue;
}

export async function createZipFromUrls(imageUrls: string[], outputName: string): Promise<string> {
  const zipDir = join(process.cwd(), ZIP_FILEPATH);
  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }

  const zipPath = join(zipDir, `${outputName}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`[createZipFromUrls] ZIP created: ${zipPath}`);
      resolve(`/${ZIP_FILEPATH}/${outputName}.zip`.replace(/\\/g, '/'));
    });

    archive.on('error', (err) => {
      console.error('[createZipFromUrls] Archive error:', err);
      reject(err);
    });

    archive.pipe(output);

    Promise.all(
      imageUrls.map(async (url) => {
        try {
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const filename = basename(url);
          archive.append(response.data, { name: filename });
          console.log(`[createZipFromUrls] Added: ${filename}`);
        } catch (err) {
          console.warn(`[createZipFromUrls] Failed to fetch: ${url}`, err);
        }
      }),
    ).then(() => archive.finalize());
  });
}
