import * as fs from 'fs';

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
