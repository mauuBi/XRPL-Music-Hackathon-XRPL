from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base

class ListeningSession(Base):
    __tablename__ = "listening_sessions"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    listener_address = Column(String, index=True, nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    total_seconds = Column(Integer, nullable=True)
    earned_amount = Column(Float, nullable=True)

    campaign = relationship("Campaign", back_populates="listening_sessions")

    def to_dict(self):
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "listener_address": self.listener_address,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "total_seconds": self.total_seconds,
            "earned_amount": self.earned_amount
        } 