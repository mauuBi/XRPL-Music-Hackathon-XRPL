from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.campaign import Campaign, CampaignStatus
from ..services.campaign_service import campaign_service
from pydantic import BaseModel, Field

router = APIRouter()

class CampaignCreate(BaseModel):
    artistAddress: str = Field(..., alias="artist_address")
    songTitle: str = Field(..., alias="song_title")
    songUrl: str = Field(..., alias="song_url")
    amount: float

    class Config:
        validate_by_name = True
        json_encoders = {
            float: lambda v: round(v, 6)
        }

class CampaignPayment(BaseModel):
    transaction_hash: str

@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    artist_address: str,
    db: Session = Depends(get_db)
):
    try:
        campaign_service.delete_campaign(db, campaign_id, artist_address)
        return {"message": "Campagne supprimée avec succès"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns", response_model=dict)
async def create_campaign(campaign_data: CampaignCreate, db: Session = Depends(get_db)):
    try:
        campaign = await campaign_service.create_campaign(
            db=db,
            artist_address=campaign_data.artistAddress,
            song_title=campaign_data.songTitle,
            song_url=campaign_data.songUrl,
            amount=campaign_data.amount
        )
        return campaign.to_dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/campaigns/{campaign_id}/verify-payment", response_model=dict)
async def verify_campaign_payment(campaign_id: int, payment_data: CampaignPayment, db: Session = Depends(get_db)):
    try:
        campaign = await campaign_service.verify_and_update_payment(
            db=db,
            campaign_id=campaign_id,
            transaction_hash=payment_data.transaction_hash
        )
        return campaign.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns/active", response_model=List[dict])
async def get_active_campaigns(db: Session = Depends(get_db)):
    campaigns = campaign_service.get_active_campaigns(db)
    return [campaign.to_dict() for campaign in campaigns]

@router.get("/campaigns/artist/{artist_address}", response_model=List[dict])
async def get_artist_campaigns(artist_address: str, db: Session = Depends(get_db)):
    campaigns = campaign_service.get_artist_campaigns(db, artist_address)
    return [campaign.to_dict() for campaign in campaigns] 