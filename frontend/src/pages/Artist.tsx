import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CampaignService } from '../services/campaign.service';
import { XamanService } from '../services/xaman.service';
import { Campaign } from '../types';
import Header from '../components/Header';

const ArtistDashboard: React.FC = () => {
    const { account } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [songTitle, setSongTitle] = useState('');
    const [songUrl, setSongUrl] = useState('');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [paymentUuid, setPaymentUuid] = useState<string | null>(null);
    const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);

    useEffect(() => {
        if (account) {
            loadArtistCampaigns();
        }
    }, [account]);

    const loadArtistCampaigns = async () => {
        if (!account) {
            setError('Compte non disponible');
            return;
        }
        try {
            const data = await CampaignService.getArtistCampaigns(account);
            setCampaigns(data);
        } catch (err) {
            setError('Erreur lors du chargement des campagnes');
        }
    };

    const verifyPayment = async (campaignId: number, transactionHash: string) => {
        let attempts = 0;
        const maxAttempts = 5;
        const delay = 2000;

        while (attempts < maxAttempts) {
            try {
                console.log(`Tentative de vérification ${attempts + 1}/${maxAttempts}`);
                const result = await CampaignService.verifyPayment(campaignId, transactionHash);
                return result;
            } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    throw error;
                }
                console.log("Attente avant nouvelle tentative...");
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!account) {
            setError('Compte non disponible');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            console.log('Création de la campagne...');
            const campaign = await CampaignService.createCampaign({
                artist_address: account,
                song_title: songTitle,
                song_url: songUrl,
                amount: parseFloat(amount)
            });
            console.log('Campagne créée:', campaign);

            console.log('Création de la demande de paiement...');
            const paymentRequest = await XamanService.createPaymentRequest(
                campaign.total_amount,
                `Paiement pour la campagne: ${campaign.song_title}`
            );
            console.log('Demande de paiement créée:', paymentRequest);

            setQrCode(paymentRequest.qr_url);
            setPaymentUuid(paymentRequest.payload_uuid);
            setPendingCampaignId(campaign.id);

            try {
                console.log('Attente de la confirmation via WebSocket...');
                const payloadUuid = await XamanService.listenToWebSocket(paymentRequest.websocket_url);
                console.log('Confirmation WebSocket reçue, UUID:', payloadUuid);

                console.log('Vérification du paiement...');
                const paymentResult = await XamanService.verifyPayment(payloadUuid);
                console.log('Résultat de la vérification:', paymentResult);

                if (paymentResult.success && paymentResult.transaction_hash) {
                    console.log('Vérification du paiement sur la blockchain...');
                    try {
                        await verifyPayment(campaign.id, paymentResult.transaction_hash);
                        console.log('Paiement vérifié avec succès');
                        setSuccess('Paiement vérifié avec succès');
                        await loadArtistCampaigns();
                        
                        setSongTitle('');
                        setSongUrl('');
                        setAmount('');
                        setQrCode(null);
                        setPaymentUuid(null);
                        setPendingCampaignId(null);
                    } catch (error) {
                        console.error('Erreur lors de la vérification sur la blockchain:', error);
                        setError("Le paiement n'a pas pu être vérifié. Veuillez réessayer dans quelques instants.");
                    }
                } else {
                    setError('Le paiement n\'a pas été validé');
                }
            } catch (err) {
                console.error('Erreur lors de la vérification:', err);
                setError('Erreur lors de la vérification du paiement');
            }
        } catch (err) {
            console.error('Erreur générale:', err);
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (campaignId: number) => {
        if (!account) {
            setError('Compte non disponible');
            return;
        }

        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await CampaignService.deleteCampaign(campaignId, account);
            setSuccess('Campagne supprimée avec succès');
            await loadArtistCampaigns();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la suppression de la campagne');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <Header userType="artist" account={account || ''} />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="grid gap-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
                            {success}
                        </div>
                    )}

                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Créer une nouvelle campagne</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Titre de la chanson
                                </label>
                                <input
                                    type="text"
                                    value={songTitle}
                                    onChange={(e) => setSongTitle(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    URL de la chanson
                                </label>
                                <input
                                    type="url"
                                    value={songUrl}
                                    onChange={(e) => setSongUrl(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Montant XRP total
                                </label>
                                <input
                                    type="number"
                                    min="20"
                                    step="0.1"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isLoading ? 'Création en cours...' : 'Créer la campagne'}
                            </button>
                        </form>

                        {qrCode && (
                            <div className="mt-4 text-center">
                                <h3 className="text-lg font-medium mb-2">Scannez le QR code pour payer</h3>
                                <img src={qrCode} alt="QR Code de paiement" className="mx-auto" />
                            </div>
                        )}
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Mes campagnes</h2>
                        <div className="space-y-4">
                            {campaigns.map((campaign) => (
                                <div
                                    key={campaign.id}
                                    className="flex justify-between items-start p-4 border rounded-lg"
                                >
                                    <div>
                                        <h3 className="font-medium">{campaign.song_title}</h3>
                                        <div className="mt-2 space-y-1">
                                            <p className="text-sm text-gray-600">
                                                Montant total : {campaign.total_amount} XRP
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Restant : {campaign.remaining_amount} XRP
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Paiement par seconde : {campaign.amount_per_second} XRP
                                            </p>
                                            <p className={`text-sm font-medium ${
                                                campaign.status === 'paid' ? 'text-green-600' :
                                                campaign.status === 'unpaid' ? 'text-red-600' :
                                                'text-gray-600'
                                            }`}>
                                                Statut : {
                                                    campaign.status === 'paid' ? 'Payée' :
                                                    campaign.status === 'unpaid' ? 'En attente de paiement' :
                                                    campaign.status === 'completed' ? 'Terminée' :
                                                    'Annulée'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        {campaign.status === 'unpaid' && (
                                            <button
                                                onClick={() => handleDelete(campaign.id)}
                                                disabled={isLoading}
                                                className="text-red-600 hover:text-red-800 disabled:opacity-50 p-2 rounded-full hover:bg-red-50"
                                                title="Supprimer la campagne"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ArtistDashboard; 