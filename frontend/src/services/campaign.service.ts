const API_URL = 'http://localhost:8000/api';

export interface Campaign {
    id: number;
    artist_address: string;
    song_title: string;
    song_url: string;
    total_amount: number;
    amount_per_second: number;
    remaining_amount: number;
    status: string;
    created_at: string;
    payment_transaction_hash?: string;
}

export interface CreateCampaignData {
    artist_address: string;
    song_title: string;
    song_url: string;
    amount: number;
}

export const CampaignService = {
    async createCampaign(data: CreateCampaignData): Promise<Campaign> {
        const response = await fetch(`${API_URL}/campaigns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la création de la campagne');
        }

        return response.json();
    },

    async getActiveCampaigns(): Promise<Campaign[]> {
        const response = await fetch(`${API_URL}/campaigns/active`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la récupération des campagnes actives');
        }

        return response.json();
    },

    async getArtistCampaigns(artistAddress: string): Promise<Campaign[]> {
        const response = await fetch(`${API_URL}/campaigns/artist/${artistAddress}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la récupération des campagnes');
        }

        return response.json();
    },

    async deleteCampaign(campaignId: number, artistAddress: string): Promise<void> {
        const response = await fetch(`${API_URL}/campaigns/${campaignId}?artist_address=${artistAddress}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la suppression de la campagne');
        }
    },

    async verifyPayment(campaignId: number, transactionHash: string): Promise<Campaign> {
        const response = await fetch(`${API_URL}/campaigns/${campaignId}/verify-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transaction_hash: transactionHash })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la vérification du paiement');
        }

        return response.json();
    }
}; 