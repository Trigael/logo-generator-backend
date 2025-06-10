export function getCurrencySymbol(currency: string) {
    switch(currency.toLocaleUpperCase()) {
        case 'EUR':
            return '€'
        case 'CZK':
            return 'Kč'
    }
}