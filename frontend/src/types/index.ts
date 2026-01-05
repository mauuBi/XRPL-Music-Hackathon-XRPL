export interface AlertMessage {
    type: 'error' | 'warning' | 'success';
    message: string;
}

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

export interface ListeningSession {
    id: number;
    campaign_id: number;
    listener_address: string;
    total_seconds: number;
    earned_amount: number;
    start_time: string;
    end_time: string;
} 