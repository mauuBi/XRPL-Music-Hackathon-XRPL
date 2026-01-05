from datetime import datetime
from fastapi import WebSocket
import asyncio
from .xrpl_service import xrpl_service
from ..models.campaign import Campaign, CampaignStatus, CampaignListener
from sqlalchemy.orm import Session

class PaymentService:
    def __init__(self):
        self.active_listeners = {}

    async def start_listening_session(self, websocket: WebSocket, campaign_id: int, 
                                    listener_address: str, db: Session):
        session_id = id(websocket)
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        
        if not campaign or campaign.status != CampaignStatus.PAID.value:
            print(f"Session refusée - Campagne {campaign_id} non trouvée ou non payée")
            await websocket.close()
            return

        self.active_listeners[session_id] = {
            "campaign_id": campaign_id,
            "listener_address": listener_address,
            "last_payment": datetime.utcnow(),
            "websocket": websocket
        }

        try:
            while True:
                data = await websocket.receive_text()
                if data == "playing":
                    await self._process_payment(session_id, db)
                await asyncio.sleep(1)
        except Exception as e:
            print(f"Error in listening session: {e}")
        finally:
            if session_id in self.active_listeners:
                del self.active_listeners[session_id]

    async def _process_payment(self, session_id: str, db: Session):
        listener_data = self.active_listeners[session_id]
        campaign = db.query(Campaign).filter(
            Campaign.id == listener_data["campaign_id"],
            Campaign.status == CampaignStatus.PAID.value
        ).first()

        if not campaign or campaign.remaining_amount <= 0:
            await listener_data["websocket"].close()
            return

        amount_to_pay = min(campaign.amount_per_second, campaign.remaining_amount)
        
        payment_result = await xrpl_service.send_payment(
            listener_data["listener_address"], 
            amount_to_pay
        )

        if payment_result["status"] == "success":
            campaign.remaining_amount -= amount_to_pay
            
            if campaign.remaining_amount <= 0:
                campaign.status = CampaignStatus.COMPLETED.value
            
            listener = db.query(CampaignListener).filter(
                CampaignListener.campaign_id == campaign.id,
                CampaignListener.listener_address == listener_data["listener_address"]
            ).first()
            
            if not listener:
                listener = CampaignListener(
                    campaign_id=campaign.id,
                    listener_address=listener_data["listener_address"],
                    seconds_listened=0,
                    amount_earned=0.0,
                    last_payment_time=datetime.utcnow(),
                    status="active"
                )
                db.add(listener)
            
            listener.seconds_listened += 1
            listener.amount_earned += amount_to_pay
            listener.last_payment_time = datetime.utcnow()
            
            db.commit()

payment_service = PaymentService() 