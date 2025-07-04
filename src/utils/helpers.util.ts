import * as fs from 'fs';
import * as archiver from 'archiver';
import { join, basename, isAbsolute } from 'path';
import * as path from 'path'

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

export async function createZip(filePaths: string[], outputName: string): Promise<string> {
  console.log(`[createZip] ${filePaths}`);

  const zipDir = join(process.cwd(), ZIP_FILEPATH);
  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }

  const zipPath = join(zipDir, `${outputName}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`[createZip] ZIP created: ${zipPath}`);
      resolve(`/${ZIP_FILEPATH}/${outputName}.zip`.replace(/\\/g, '/'));
    });

    archive.on('error', (err) => {
      console.error('[createZip] Archive error:', err);
      reject(err);
    });

    archive.pipe(output);

    filePaths.forEach((imgPath) => {
      const fullPath = join(process.cwd(), 'public', imgPath)

      if (!fs.existsSync(fullPath)) {
        console.warn(`[createZip] File not found: ${fullPath}`);
        return;
      }

      const filename = basename(fullPath);
      console.log(`[createZip] Adding: ${fullPath}`);
      archive.file(fullPath, { name: filename });
    });

    archive.finalize();
  });
}
