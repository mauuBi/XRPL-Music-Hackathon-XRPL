from xumm import XummSdk
from ..config import settings
import time
import asyncio
from functools import partial

class XamanService:
    def __init__(self):
        print("Initialisation du SDK XUMM...")
        self.sdk = XummSdk(settings.XAMAN_API_KEY, settings.XAMAN_API_SECRET)

    async def create_payment_request(self, amount: float, description: str) -> dict:
        start_time = time.time()
        print(f"Début de la création de la demande de paiement - {time.strftime('%H:%M:%S')}")
        
        try:
            payload = {
                "txjson": {
                    "TransactionType": "Payment",
                    "Amount": str(int(amount * 1000000)),
                    "Destination": settings.XRPL_COLD_WALLET,
                },
                "custom_meta": {
                    "identifier": "bid_xrpl_campaign_payment",
                    "blob": {
                        "description": description
                    }
                },
                "options": {
                    "submit": True,
                    "expire": 15,
                }
            }

            print(f"Payload de base créée - Temps écoulé: {time.time() - start_time:.2f}s")

            response = await asyncio.to_thread(self.sdk.payload.create, payload)
            print(f"Réponse XUMM reçue - Temps écoulé: {time.time() - start_time:.2f}s")

            if response and hasattr(response, 'next'):
                result = {
                    "qr_url": response.refs.qr_png,
                    "websocket_url": response.refs.websocket_status,
                    "payload_uuid": response.uuid
                }
                print(f"Requête complétée avec succès - Temps total: {time.time() - start_time:.2f}s")
                return result
            else:
                print(f"Réponse XUMM invalide après {time.time() - start_time:.2f}s")
                return None

        except Exception as e:
            print(f"Erreur après {time.time() - start_time:.2f}s: {str(e)}")
            return None

    async def create_sign_request(self, user_token: str = None) -> dict:
        start_time = time.time()
        print(f"Début de la création de la demande de signature - {time.strftime('%H:%M:%S')}")
        
        try:
            payload = {
                "txjson": {
                    "TransactionType": "SignIn"
                },
                "options": {
                    "submit": False,
                    "expire": 5,
                    "return_url": {
                        "web": f"{settings.FRONTEND_URL}"
                    }
                }
            }
            if user_token:
                payload["user_token"] = user_token

            response = await asyncio.to_thread(self.sdk.payload.create, payload)
            print(f"Réponse de signature reçue - Temps écoulé: {time.time() - start_time:.2f}s")
            
            if response and hasattr(response, 'next'):
                result = {
                    "qr_url": response.refs.qr_png,
                    "websocket_url": response.refs.websocket_status,
                    "payload_uuid": response.uuid
                }
                print(f"Demande de signature créée avec succès - Temps total: {time.time() - start_time:.2f}s")
                return result
            return None

        except Exception as e:
            print(f"Erreur lors de la création de la demande de signature après {time.time() - start_time:.2f}s: {str(e)}")
            return None

    async def verify_signature(self, payload_uuid: str) -> dict:
        start_time = time.time()
        print(f"Début de la vérification de signature - {time.strftime('%H:%M:%S')}")
        
        try:
            payload = await asyncio.to_thread(self.sdk.payload.get, payload_uuid)
            print(f"Réponse de vérification reçue - Temps écoulé: {time.time() - start_time:.2f}s")
            
            if payload and payload.meta and payload.meta.signed:
                print(f"Signature vérifiée avec succès - Temps total: {time.time() - start_time:.2f}s")
                return {
                    "success": True,
                    "account": payload.response.account,
                    "user_token": payload.application.issued_user_token
                }
            
            print(f"Signature invalide - Temps écoulé: {time.time() - start_time:.2f}s")
            return {
                "success": False
            }

        except Exception as e:
            print(f"Erreur après {time.time() - start_time:.2f}s: {str(e)}")
            return {
                "success": False
            }

    async def verify_payment(self, payload_uuid: str) -> dict:
        start_time = time.time()
        print(f"Début de la vérification du paiement - {time.strftime('%H:%M:%S')}")
        
        try:
            payload = await asyncio.to_thread(self.sdk.payload.get, payload_uuid)
            print(f"Réponse de vérification reçue - Temps écoulé: {time.time() - start_time:.2f}s")
            
            if payload and payload.meta and payload.meta.signed:
                print(f"Paiement vérifié avec succès - Temps total: {time.time() - start_time:.2f}s")
                return {
                    "success": True,
                    "transaction_hash": payload.response.txid
                }
            
            print(f"Paiement non effectué - Temps écoulé: {time.time() - start_time:.2f}s")
            return {
                "success": False
            }

        except Exception as e:
            print(f"Erreur après {time.time() - start_time:.2f}s: {str(e)}")
            return {
                "success": False
            }

xaman_service = XamanService() 