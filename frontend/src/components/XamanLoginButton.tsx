import React, { useState } from 'react';
import { AuthService } from '../services/auth.service';

interface XamanLoginButtonProps {
    onLogin: (account: string, userToken: string) => void;
}

export const XamanLoginButton: React.FC<XamanLoginButtonProps> = ({ onLogin }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const signRequest = await AuthService.createSignRequest();
            setQrCode(signRequest.qr_url);

            const payloadUuid = await AuthService.listenToWebSocket(signRequest.websocket_url);

            const verifyResult = await AuthService.verifySignature(payloadUuid);
            
            if (verifyResult.success && verifyResult.account && verifyResult.user_token) {
                onLogin(verifyResult.account, verifyResult.user_token);
                setQrCode(null);
            } else {
                setError('Échec de la connexion');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {!qrCode && (
                <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? 'Chargement...' : 'Se connecter avec Xaman (XUMM)'}
                </button>
            )}

            {qrCode && (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-gray-600">Scannez le QR code avec Xaman (XUMM)</p>
                    <img src={qrCode} alt="QR Code Xaman" className="w-48 h-48" />
                    <button
                        onClick={() => setQrCode(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Annuler
                    </button>
                </div>
            )}

            {error && (
                <p className="text-red-500 text-sm">{error}</p>
            )}
        </div>
    );
}; 