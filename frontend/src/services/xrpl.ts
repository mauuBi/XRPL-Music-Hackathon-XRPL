import { useState, useEffect } from 'react';

declare global {
  interface Window {
    xrpl: any;
  }
}

interface Campaign {
  songTitle: string;
  songUrl: string;
  amount: number;
}

export const useXRPL = () => {
  const [wallet, setWallet] = useState<any>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (window.xrpl) {
      try {
        const connected = await window.xrpl.isConnected();
        if (connected) {
          const address = await window.xrpl.getAddress();
          setWallet({ address });
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la connexion:', error);
      }
    }
  };

  const createCampaign = async (campaign: Campaign) => {
    if (!wallet) throw new Error('Wallet non connecté');

    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...campaign,
        artistAddress: wallet.address,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la création de la campagne');
    }

    return await response.json();
  };

  const connectWebSocket = async (campaignId: number): Promise<WebSocket> => {
    if (!wallet) throw new Error('Wallet non connecté');

    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
        window.location.host
      }/ws/listen/${campaignId}/${wallet.address}`
    );

    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('Erreur de connexion WebSocket'));
    });
  };

  return {
    wallet,
    createCampaign,
    connectWebSocket,
  };
}; 