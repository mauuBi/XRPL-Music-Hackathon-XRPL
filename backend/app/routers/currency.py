from fastapi import APIRouter, HTTPException
import aiohttp
from pydantic import BaseModel

router = APIRouter()

class XRPPrice(BaseModel):
    price: float

@router.get("/currency/xrp-price", response_model=XRPPrice)
async def get_xrp_price():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=eur') as response:
                if response.status != 200:
                    raise HTTPException(status_code=503, detail="Service de prix indisponible")
                data = await response.json()
                return {"price": data["ripple"]["eur"]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) 