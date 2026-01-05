from fastapi import FastAPI, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .models.campaign import Campaign, CampaignStatus
from .services.payment_service import payment_service, PaymentService
from .services.xaman_service import xaman_service
from .config import settings
from .database import Base, engine, get_db
from .routers import campaigns, auth, listening, websocket, currency, xaman

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(listening.router, prefix="/api")
app.include_router(websocket.router)
app.include_router(currency.router, prefix="/api")
app.include_router(xaman.router, prefix="/api")

@app.post("/api/auth/sign-request")
async def create_sign_request(user_token: str = None):
    try:
        return await xaman_service.create_sign_request(user_token)
    except Exception as e:
        print(f"Error creating sign request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/verify/{payload_uuid}")
async def verify_signature(payload_uuid: str):
    try:
        result = await xaman_service.verify_signature(payload_uuid)
        if result["success"]:
            return result
        raise HTTPException(status_code=401, detail="Signature non valide")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/campaigns/active")
async def get_active_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.status == CampaignStatus.PAID.value).all()
    return [campaign.to_dict() for campaign in campaigns]

@app.post("/api/campaigns")
async def create_campaign(campaign_data: dict, db: Session = Depends(get_db)):
    campaign = Campaign(
        artist_address=campaign_data["artistAddress"],
        song_title=campaign_data["songTitle"],
        song_url=campaign_data["songUrl"],
        total_amount=campaign_data["amount"],
        amount_per_second=settings.PAYMENT_PER_SECOND,
        remaining_amount=campaign_data["amount"],
        status=CampaignStatus.UNPAID.value
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign.to_dict()

@app.websocket("/ws/listen/{campaign_id}/{listener_address}")
async def websocket_endpoint(
    websocket: WebSocket,
    campaign_id: int,
    listener_address: str,
    db: Session = Depends(get_db)
):
    await websocket.accept()
    await payment_service.start_listening_session(
        websocket,
        campaign_id,
        listener_address,
        db
    )

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API XRPL Music"} 