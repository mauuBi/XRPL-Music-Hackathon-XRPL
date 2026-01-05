const API_URL = 'http://localhost:8000/api';

export interface ListeningSession {
    id: number;
    campaign_id: number;
    listener_address: string;
    start_time: string;
    end_time?: string;
    total_seconds?: number;
    earned_amount: number;
}

export const ListenerService = {
    async getActiveSession(listenerAddress: string): Promise<ListeningSession | null> {
        const response = await fetch(`${API_URL}/listening/active/${listenerAddress}`);
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error('Erreur lors de la récupération de la session active');
        }
        return response.json();
    },

    async stopAllActiveSessions(listenerAddress: string): Promise<void> {
        const activeSession = await this.getActiveSession(listenerAddress);
        if (activeSession) {
            await this.stopListening(activeSession.id);
        }
    },

    async startListening(campaignId: number, listenerAddress: string): Promise<ListeningSession> {
        const response = await fetch(`${API_URL}/listening/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                campaign_id: campaignId,
                listener_address: listenerAddress
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors du démarrage de la session d\'écoute');
        }

        return response.json();
    },

    async stopListening(sessionId: number): Promise<ListeningSession> {
        const response = await fetch(`${API_URL}/listening/${sessionId}/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de l\'arrêt de la session d\'écoute');
        }

        return response.json();
    },

    async getListenerHistory(listenerAddress: string): Promise<ListeningSession[]> {
        const response = await fetch(`${API_URL}/listening/history/${listenerAddress}`);

        if (!response.ok) {
            throw new Error('Erreur lors du chargement de l\'historique d\'écoute');
        }

        return response.json();
    }
}; 