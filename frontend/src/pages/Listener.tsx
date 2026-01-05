import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CampaignService, Campaign } from '../services/campaign.service';
import { ListenerService, ListeningSession } from '../services/listener.service';
import { CurrencyService } from '../services/currency.service';
import { AlertMessage } from '../types';
import Header from '../components/Header';

const HEARTBEAT_INTERVAL = 5000;

interface ListeningStatus {
    isNormal: boolean;
    message: string;
    details?: string;
    earnedXRP?: number;
    earnedEUR?: number;
}

const ListenerDashboard: React.FC = () => {
    const { account } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [currentSession, setCurrentSession] = useState<ListeningSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listeningHistory, setListeningHistory] = useState<ListeningSession[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);
    const [alert, setAlert] = useState<AlertMessage | null>(null);
    const [listeningStatus, setListeningStatus] = useState<ListeningStatus | null>(null);
    const [xrpPrice, setXRPPrice] = useState<number>(0);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [previousVolume, setPreviousVolume] = useState<number>(1);
    const [wasPlaying, setWasPlaying] = useState<boolean>(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const heartbeatIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const init = async () => {
            if (account) {
                try {
                    await ListenerService.stopAllActiveSessions(account);
                } catch (err) {
                    console.error('Erreur lors de l\'arrêt des sessions actives:', err);
                }
            }
            await loadCampaigns();
            if (account) {
                await loadHistory();
            }
            await updateXRPPrice();
        };

        init();

        const priceInterval = setInterval(updateXRPPrice, 30000);

        return () => {
            cleanupWebSocket();
            clearInterval(priceInterval);
        };
    }, [account]);

    const showAlert = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const cleanupWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    };

    const setupWebSocket = (campaignId: number) => {
        if (!account) return;

        const ws = new WebSocket(`ws://localhost:8000/ws/listen/${campaignId}/${account}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connecté');
            setListeningStatus({
                isNormal: true,
                message: "Écoute en cours",
                details: "Vous gagnez des XRP pour votre écoute"
            });
            startHeartbeat(campaignId);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
                setListeningStatus({
                    isNormal: false,
                    message: "Erreur de connexion",
                    details: data.message
                });
                showAlert(data.message, 'error');
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                stopListening();
            } else if (data.type === 'earnings') {
                setListeningStatus(prevStatus => ({
                    ...prevStatus!,
                    earnedXRP: data.earnedXRP,
                    earnedEUR: data.earnedXRP * xrpPrice
                }));
            }
        };

        ws.onerror = () => {
            setListeningStatus({
                isNormal: false,
                message: "Erreur de connexion",
                details: "La connexion au serveur a été perdue"
            });
            showAlert("La connexion au serveur a été perdue", 'error');
            if (audioRef.current) {
                audioRef.current.pause();
            }
            stopListening();
        };

        ws.onclose = () => {
            console.log('WebSocket déconnecté');
            cleanupWebSocket();
        };
    };

    const startHeartbeat = (campaignId: number) => {
        if (!audioRef.current || !wsRef.current) return;

        heartbeatIntervalRef.current = window.setInterval(() => {
            if (!audioRef.current || !wsRef.current) return;

            const audio = audioRef.current;
            
            wsRef.current.send(JSON.stringify({
                type: 'heartbeat',
                campaign_id: campaignId,
                current_time: audio.currentTime,
                is_playing: !audio.paused && !audio.ended,
                volume: audio.volume > 0 && !audio.muted
            }));
        }, HEARTBEAT_INTERVAL);
    };

    const loadCampaigns = async () => {
        try {
            const data = await CampaignService.getActiveCampaigns();
            setCampaigns(data);
        } catch (err) {
            console.error('Erreur lors du chargement des campagnes:', err);
        }
    };

    const loadHistory = async () => {
        if (!account) return;
        try {
            const history = await ListenerService.getListenerHistory(account);
            setListeningHistory(history);
        } catch (err) {
            console.error('Erreur lors du chargement de l\'historique:', err);
        }
    };

    const startListening = async (campaignId: number) => {
        if (!account) {
            setError('Vous devez être connecté pour écouter');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const session = await ListenerService.startListening(campaignId, account);
            setCurrentSession(session);
            setActiveCampaignId(campaignId);
            setupWebSocket(campaignId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            setListeningStatus(null);
        } finally {
            setIsLoading(false);
        }
    };

    const stopListening = async () => {
        if (!currentSession) return;

        setIsLoading(true);
        setError(null);

        try {
            await ListenerService.stopListening(currentSession.id);
            setCurrentSession(null);
            setActiveCampaignId(null);
            setListeningStatus(null);
            cleanupWebSocket();
            loadHistory();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAudioPlay = async (campaignId: number, songTitle: string) => {
        if (activeCampaignId !== campaignId) {
            await startListening(campaignId);
        }
    };

    const handleAudioPause = async () => {
        if (currentSession) {
            await stopListening();
        }
    };

    const handleVolumeChange = (event: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = event.currentTarget;
        const currentVolume = audio.volume;
        const isMuted = audio.muted;

        if ((currentVolume === 0 || isMuted) && previousVolume > 0) {
            setWasPlaying(!audio.paused);
            audio.pause();
            showAlert("Volume coupé - Lecture en pause", 'warning');
        } else if (currentVolume > 0 && !isMuted && previousVolume === 0) {
            if (wasPlaying) {
                audio.play();
                showAlert("Volume rétabli - Reprise de la lecture", 'success');
            }
        }
        setPreviousVolume(currentVolume);
    };

    const handleMuteChange = (event: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = event.currentTarget;
        if (audio.muted) {
            setWasPlaying(!audio.paused);
            audio.pause();
            showAlert("Son coupé - Lecture en pause", 'warning');
        } else if (!audio.muted && audio.volume > 0) {
            if (wasPlaying) {
                audio.play();
                showAlert("Son rétabli - Reprise de la lecture", 'success');
            }
        }
    };

    const updateXRPPrice = async () => {
        try {
            const price = await CurrencyService.getXRPPrice();
            setXRPPrice(price);
        } catch (error) {
            console.error('Erreur lors de la mise à jour du prix XRP:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            {alert && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
                    <div className={`px-4 py-3 rounded-lg shadow-lg ${
                        alert.type === 'error' ? 'bg-red-500' :
                        alert.type === 'warning' ? 'bg-yellow-500' :
                        'bg-green-500'
                    } text-white`}>
                        {alert.message}
                    </div>
                </div>
            )}

            <Header userType="listener" account={account || ''} />

            <main className="max-w-4xl mx-auto px-4 py-8">
                {listeningStatus && (
                    <div className={`fixed top-4 right-4 z-50 w-80 transform transition-all duration-300 ease-in-out ${
                        listeningStatus.isNormal ? 'translate-x-0' : 'translate-x-0'
                    }`}>
                        <div className={`bg-white rounded-lg shadow-lg p-4 ${
                            listeningStatus.isNormal ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
                        }`}>
                            <div className="flex items-center mb-3">
                                {listeningStatus.isNormal ? (
                                    <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                <h3 className={`text-lg font-semibold ${
                                    listeningStatus.isNormal ? 'text-green-700' : 'text-red-700'
                                }`}>
                                    {listeningStatus.message}
                                </h3>
                            </div>

                            {listeningStatus.details && (
                                <p className="text-sm text-gray-600 mb-3">{listeningStatus.details}</p>
                            )}
                            
                            {listeningStatus.isNormal && listeningStatus.earnedXRP !== undefined && (
                                <div className="bg-green-50 p-3 rounded-md mb-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-green-700">Gains :</span>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-green-600">
                                                {listeningStatus.earnedXRP.toFixed(6)} XRP
                                            </p>
                                            <p className="text-xs text-green-500">
                                                ≈ {(listeningStatus.earnedXRP * xrpPrice).toFixed(2)} EUR
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!listeningStatus.isNormal && (
                                <div className="bg-red-50 p-3 rounded-md">
                                    <p className="text-xs font-medium text-red-700 mb-1">
                                        Pour reprendre les gains :
                                    </p>
                                    <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                                        <li>Vérifiez le volume</li>
                                        <li>Évitez la mise en pause</li>
                                        <li>Écoutez normalement</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-800">Campagnes disponibles</h2>
                        <p className="text-sm text-gray-600 mt-1">Découvrez et écoutez les derniers morceaux</p>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {campaigns.map((campaign) => (
                            <div 
                                key={campaign.id}
                                className="p-6 hover:bg-gray-50 transition-colors duration-200"
                            >
                                <h3 className="text-lg font-semibold text-gray-800">{campaign.song_title}</h3>
                                <div className="mt-3 space-y-3">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center text-sm text-gray-600">
                                            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {campaign.amount_per_second} XRP/sec
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600">
                                            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {campaign.remaining_amount} XRP restants
                                        </div>
                                    </div>
                                    <audio
                                        ref={activeCampaignId === campaign.id ? audioRef : undefined}
                                        src={campaign.song_url}
                                        controls
                                        className="w-full rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onPlay={() => handleAudioPlay(campaign.id, campaign.song_title)}
                                        onPause={handleAudioPause}
                                        onEnded={handleAudioPause}
                                        onVolumeChange={handleVolumeChange}
                                        onLoadedMetadata={(e) => {
                                            const audio = e.currentTarget;
                                            setPreviousVolume(audio.volume);
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {listeningHistory.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md mt-8 overflow-hidden">
                        <button 
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            className="w-full p-6 border-b border-gray-100 flex items-center justify-between text-left"
                        >
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Historique d'écoute</h2>
                                <p className="text-sm text-gray-600 mt-1">Vos sessions d'écoute précédentes</p>
                            </div>
                            <svg 
                                className={`w-6 h-6 text-gray-400 transform transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                        {isHistoryExpanded && (
                            <div className="divide-y divide-gray-100">
                                {listeningHistory.map((session) => (
                                    <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center text-sm text-gray-600">
                                                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {session.total_seconds} secondes
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-green-600">
                                                    {session.earned_amount} XRP
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    ≈ {(session.earned_amount * xrpPrice).toFixed(2)} EUR
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ListenerDashboard; 