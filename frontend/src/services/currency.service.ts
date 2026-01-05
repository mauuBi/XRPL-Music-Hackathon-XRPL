const API_URL = 'http://localhost:8000/api';

export const CurrencyService = {
    async getXRPPrice(): Promise<number> {
        try {
            const response = await fetch(`${API_URL}/currency/xrp-price`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération du prix XRP');
            }
            const data = await response.json();
            return data.price;
        } catch (error) {
            console.error('Erreur lors de la récupération du prix XRP:', error);
            return 0.5;
        }
    }
};
