from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.xaman_service import xaman_service

router = APIRouter()

class PaymentRequest(BaseModel):
    amount: float
    description: str

@router.post("/xaman/payment-request")
async def create_payment_request(request: PaymentRequest):
    try:
        result = await xaman_service.create_payment_request(
            amount=request.amount,
            description=request.description
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/xaman/verify-payment/{payload_uuid}")
async def verify_payment(payload_uuid: str):
    try:
        result = await xaman_service.verify_payment(payload_uuid)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) 