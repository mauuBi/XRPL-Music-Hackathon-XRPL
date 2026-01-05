from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ListeningSessionBase(BaseModel):
    campaign_id: int
    listener_address: str

class ListeningSessionCreate(ListeningSessionBase):
    pass

class ListeningSessionUpdate(BaseModel):
    end_time: datetime
    total_seconds: int
    earned_amount: float

class ListeningSession(ListeningSessionBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    total_seconds: Optional[int] = None
    earned_amount: Optional[float] = None

    class Config:
        from_attributes = True 