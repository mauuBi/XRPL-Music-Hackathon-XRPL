const API_URL = 'http://localhost:8000/api';

export interface PaymentRequestResponse {
    qr_url: string;
    websocket_url: string;
    payload_uuid: string;
}

export interface PaymentVerifyResponse {
    success: boolean;
    transaction_hash?: string;
}

export const XamanService = {
    async createPaymentRequest(amount: number, description: string): Promise<PaymentRequestResponse> {
        const response = await fetch(`${API_URL}/xaman/payment-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                description
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la création de la demande de paiement');
        }

        return response.json();
    },

    async verifyPayment(payloadUuid: string): Promise<PaymentVerifyResponse> {
        const response = await fetch(`${API_URL}/xaman/verify-payment/${payloadUuid}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la vérification du paiement');
        }

        return response.json();
    },

    listenToWebSocket(websocketUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(websocketUrl);
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.payload_uuidv4) {
                    ws.close();
                    resolve(data.payload_uuidv4);
                }
            };
            
            ws.onerror = (error) => {
                ws.close();
                reject(error);
            };
            
            setTimeout(() => {
                ws.close();
                reject(new Error('Timeout de la connexion WebSocket'));
            }, 5 * 60 * 1000);
        });
    }
}; 