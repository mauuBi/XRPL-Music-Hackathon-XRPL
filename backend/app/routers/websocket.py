from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import json
import logging
import asyncio
from typing import Optional

from app.database import get_db
from app.models.listening import ListeningSession
from app.models.campaign import Campaign, CampaignStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WS_ERRORS = {
    1000: "Fermeture normale",
    1001: "Départ de l'application",
    1002: "Erreur de protocole",
    1003: "Type de données non accepté",
    1004: "Réservé",
    1005: "Pas de code de statut",
    1006: "Fermeture anormale",
    1007: "Données non conformes",
    1008: "Violation de règle",
    1009: "Message trop grand",
    1010: "Extension requise",
    1011: "Erreur inattendue",
    1015: "Échec TLS"
}

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}
        self.reconnection_delays: dict = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.reconnection_delays[client_id] = 0
        logger.info(f"Nouvelle connexion établie: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Connexion terminée: {client_id}")

    async def send_message(self, message: dict, client_id: str) -> bool:
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Erreur d'envoi de message pour {client_id}: {str(e)}")
                return False
        return False

    def get_reconnection_delay(self, client_id: str) -> int:
        current_delay = self.reconnection_delays.get(client_id, 0)
        new_delay = min(30, (current_delay + 1) * 2) if current_delay else 1
        self.reconnection_delays[client_id] = new_delay
        return new_delay

async def handle_websocket_error(websocket: WebSocket, error_code: int, client_id: str) -> None:
    error_message = WS_ERRORS.get(error_code, "Erreur inconnue")
    logger.error(f"Erreur WebSocket {error_code} pour {client_id}: {error_message}")
    
    try:
        await websocket.close(code=error_code)
    except Exception as e:
        logger.error(f"Erreur lors de la fermeture propre du WebSocket: {str(e)}")

async def maintain_connection(websocket: WebSocket, client_id: str, heartbeat_interval: float = 30.0) -> None:
    while True:
        try:
            await asyncio.sleep(heartbeat_interval)
            await websocket.send_text('ping')
        except Exception as e:
            logger.warning(f"Échec du ping pour {client_id}: {str(e)}")
            break

def save_session(session: ListeningSession, campaign: Campaign, start_time: datetime, db: Session, reason: str = "normal") -> None:
    try:
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        session.end_time = end_time
        session.total_seconds = int(duration)
        
        earned_amount = min(
            duration * campaign.amount_per_second,
            campaign.remaining_amount
        )
        
        session.earned_amount = earned_amount
        campaign.remaining_amount -= earned_amount

        if campaign.remaining_amount <= 0:
            campaign.status = "completed"
            logger.info(f"Campagne {campaign.id} terminée (fonds épuisés)")

        db.commit()
        logger.info(
            f"Session sauvegardée - ID: {session.id}, "
            f"Durée: {duration:.2f}s, "
            f"Gains: {earned_amount} XRP, "
            f"Raison de fin: {reason}"
        )
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde de la session: {str(e)}")
        db.rollback()
        raise

manager = ConnectionManager()

@router.websocket("/ws/listen/{campaign_id}/{listener_address}")
async def websocket_endpoint(
    websocket: WebSocket,
    campaign_id: int,
    listener_address: str,
    db: Session = Depends(get_db)
):
    client_id = f"{listener_address}_{campaign_id}"
    last_heartbeat_time = None
    session = None
    start_time = datetime.utcnow()
    earned_amount = 0
    last_progress_check = 0
    termination_reason = "normal"
    ping_task: Optional[asyncio.Task] = None

    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.status == CampaignStatus.PAID.value
        ).first()
        
        if not campaign:
            logger.warning(f"Tentative de connexion à une campagne inactive/inexistante: {campaign_id}")
            await websocket.close(code=4000)
            return

        session = db.query(ListeningSession).filter(
            ListeningSession.campaign_id == campaign_id,
            ListeningSession.listener_address == listener_address,
            ListeningSession.end_time.is_(None)
        ).first()

        if not session:
            logger.warning(f"Aucune session active trouvée pour: {listener_address}")
            await websocket.close(code=4001)
            return

        await manager.connect(websocket, client_id)
        
        ping_task = asyncio.create_task(maintain_connection(websocket, client_id))
        
        logger.info(f"Session d'écoute démarrée: {client_id}")

        while True:
            try:
                data = await websocket.receive_text()
                if data == 'pong':
                    continue

                heartbeat = json.loads(data)

                if heartbeat["type"] != "heartbeat":
                    continue

                current_time = datetime.utcnow()
                
                if not heartbeat["is_playing"]:
                    logger.info(f"Lecture en pause détectée: {client_id}")
                    await manager.send_message(
                        {"type": "error", "message": "La lecture est en pause"},
                        client_id
                    )
                    termination_reason = "pause"
                    break

                if not heartbeat["volume"]:
                    logger.info(f"Volume à 0 détecté: {client_id}")
                    await manager.send_message(
                        {"type": "error", "message": "Le volume est à 0"},
                        client_id
                    )
                    termination_reason = "volume_muted"
                    break

                if last_heartbeat_time is not None:
                    expected_progress = (current_time - last_heartbeat_time).total_seconds()
                    actual_progress = heartbeat["current_time"] - last_progress_check

                    progress_ratio = actual_progress / expected_progress if expected_progress > 0 else 1
                    
                    if progress_ratio < 0.5 or progress_ratio > 2.0 or actual_progress < 0:
                        logger.warning(
                            f"Progression anormale pour {client_id}: "
                            f"attendu={expected_progress:.2f}s, "
                            f"réel={actual_progress:.2f}s, "
                            f"ratio={progress_ratio:.2f}"
                        )
                        
                        if 0.3 < progress_ratio < 2.5 and actual_progress >= 0:
                            await manager.send_message(
                                {
                                    "type": "warning",
                                    "message": "Progression de lecture irrégulière détectée",
                                    "details": "La connexion semble instable"
                                },
                                client_id
                            )
                        else:
                            await manager.send_message(
                                {
                                    "type": "error",
                                    "message": "Progression de lecture anormale détectée",
                                    "details": "Session terminée pour comportement suspect"
                                },
                                client_id
                            )
                            termination_reason = "irregular_progress"
                            break
                    
                    last_progress_check = heartbeat["current_time"]

                elapsed_time = (current_time - start_time).total_seconds()
                earned_amount = elapsed_time * campaign.amount_per_second
                
                await manager.send_message(
                    {
                        "type": "earnings",
                        "earnedXRP": earned_amount,
                        "elapsedSeconds": elapsed_time
                    },
                    client_id
                )

                last_heartbeat_time = current_time

            except json.JSONDecodeError as e:
                logger.error(f"Erreur de décodage JSON pour {client_id}: {str(e)}")
                termination_reason = "json_error"
                break
            except Exception as e:
                error_code = getattr(e, 'code', 1011)
                logger.error(f"Erreur lors du traitement du heartbeat pour {client_id}: {str(e)}")
                termination_reason = f"heartbeat_error_{error_code}"
                break

    except WebSocketDisconnect as e:
        termination_reason = f"client_disconnect_{e.code}"
        logger.info(f"Client déconnecté ({e.code}): {client_id}")
    except Exception as e:
        error_code = getattr(e, 'code', 1011)
        termination_reason = f"websocket_error_{error_code}"
        logger.error(f"Erreur WebSocket pour {client_id}: {str(e)}")
    finally:
        if ping_task:
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass

        if client_id in manager.active_connections:
            manager.disconnect(client_id)
        
        if session:
            try:
                save_session(session, campaign, start_time, db, termination_reason)
            except Exception as e:
                logger.error(f"Échec de la sauvegarde finale de la session {client_id}: {str(e)}") 