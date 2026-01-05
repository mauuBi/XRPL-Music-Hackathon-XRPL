from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

class CampaignStatus(enum.Enum):
    UNPAID = "unpaid"
    PAID = "paid"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    artist_address = Column(String, index=True)
    song_title = Column(String)
    song_url = Column(String)
    total_amount = Column(Float)
    amount_per_second = Column(Float)
    remaining_amount = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=CampaignStatus.UNPAID.value)
    payment_transaction_hash = Column(String, nullable=True)

    # Relations
    listeners = relationship("CampaignListener", back_populates="campaign")
    listening_sessions = relationship("ListeningSession", back_populates="campaign")

    def to_dict(self):
        return {
            "id": self.id,
            "artist_address": self.artist_address,
            "song_title": self.song_title,
            "song_url": self.song_url,
            "total_amount": self.total_amount,
            "amount_per_second": self.amount_per_second,
            "remaining_amount": self.remaining_amount,
            "created_at": self.created_at.isoformat(),
            "status": self.status,
            "payment_transaction_hash": self.payment_transaction_hash
        }

class CampaignListener(Base):
    __tablename__ = "campaign_listeners"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    listener_address = Column(String, index=True)
    seconds_listened = Column(Integer, default=0)
    amount_earned = Column(Float, default=0.0)
    last_payment_time = Column(DateTime)
    status = Column(String)

    campaign = relationship("Campaign", back_populates="listeners") 