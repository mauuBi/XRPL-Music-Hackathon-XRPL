const API_URL = 'http://localhost:8000/api';

export interface SignRequestResponse {
    qr_url: string;
    websocket_url: string;
    payload_uuid: string;
}

export interface VerifyResponse {
    success: boolean;
    account?: string;
    user_token?: string;
}

export const AuthService = {
    async createSignRequest(userToken?: string): Promise<SignRequestResponse> {
        const response = await fetch(`${API_URL}/auth/sign-request${userToken ? `?user_token=${userToken}` : ''}`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de la création de la demande de signature');
        }
        
        return response.json();
    },

    async verifySignature(payloadUuid: string): Promise<VerifyResponse> {
        const response = await fetch(`${API_URL}/auth/verify/${payloadUuid}`);
        
        if (!response.ok) {
            throw new Error('Erreur lors de la vérification de la signature');
        }
        
        return response.json();
    },

    async listenToWebSocket(websocketUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(websocketUrl);
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.signed) {
                    ws.close();
                    resolve(data.payload_uuidv4);
                }
            };
            
            ws.onerror = () => {
                reject(new Error('Erreur de connexion WebSocket'));
            };
        });
    }
}; 