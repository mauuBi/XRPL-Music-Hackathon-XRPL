from fastapi import APIRouter, HTTPException
from app.services.xaman_service import xaman_service

router = APIRouter()

@router.post("/auth/sign-request")
async def create_sign_request(user_token: str = None):
    try:
        return await xaman_service.create_sign_request(user_token)
    except Exception as e:
        print(f"Error creating sign request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auth/verify/{payload_uuid}")
async def verify_signature(payload_uuid: str):
    try:
        result = await xaman_service.verify_signature(payload_uuid)
        if result["success"]:
            return result
        raise HTTPException(status_code=401, detail="Signature non valide")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 