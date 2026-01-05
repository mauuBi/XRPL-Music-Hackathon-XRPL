from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import get_db
from app.models.listening import ListeningSession
from app.models.campaign import Campaign, CampaignStatus
from app.schemas.listening import ListeningSessionCreate, ListeningSession as ListeningSessionSchema

router = APIRouter()

@router.get("/listening/active/{listener_address}", response_model=ListeningSessionSchema)
def get_active_session(
    listener_address: str,
    db: Session = Depends(get_db)
):
    session = db.query(ListeningSession).filter(
        ListeningSession.listener_address == listener_address,
        ListeningSession.end_time.is_(None)
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Aucune session active trouvée")
    
    return session

@router.post("/listening/start", response_model=ListeningSessionSchema)
def start_listening_session(
    session_data: ListeningSessionCreate,
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == session_data.campaign_id,
        Campaign.status == CampaignStatus.PAID.value
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne non trouvée ou inactive")
    
    active_session = db.query(ListeningSession).filter(
        ListeningSession.listener_address == session_data.listener_address,
        ListeningSession.end_time.is_(None)
    ).first()
    
    if active_session:
        raise HTTPException(status_code=400, detail="Une session d'écoute est déjà en cours")
    
    session = ListeningSession(
        campaign_id=session_data.campaign_id,
        listener_address=session_data.listener_address
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session

@router.post("/listening/{session_id}/stop", response_model=ListeningSessionSchema)
def stop_listening_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    session = db.query(ListeningSession).filter(
        ListeningSession.id == session_id,
        ListeningSession.end_time.is_(None)
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée ou déjà terminée")
    
    end_time = datetime.utcnow()
    duration = (end_time - session.start_time).total_seconds()
    
    campaign = db.query(Campaign).filter(Campaign.id == session.campaign_id).first()
    earned_amount = min(
        duration * campaign.amount_per_second,
        campaign.remaining_amount
    )
    
    session.end_time = end_time
    session.total_seconds = int(duration)
    session.earned_amount = earned_amount
    
    campaign.remaining_amount -= earned_amount
    if campaign.remaining_amount <= 0:
        campaign.status = "completed"
    
    db.commit()
    db.refresh(session)
    
    return session

@router.get("/listening/history/{listener_address}", response_model=List[ListeningSessionSchema])
def get_listener_history(
    listener_address: str,
    db: Session = Depends(get_db)
):
    sessions = db.query(ListeningSession).filter(
        ListeningSession.listener_address == listener_address,
        ListeningSession.end_time.isnot(None)
    ).order_by(ListeningSession.start_time.desc()).all()
    
    return sessions 