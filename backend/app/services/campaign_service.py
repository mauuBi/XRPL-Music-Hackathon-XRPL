from sqlalchemy.orm import Session
from ..models.campaign import Campaign, CampaignStatus
from ..services.xrpl_service import xrpl_service
from ..config import settings

class CampaignService:
    @staticmethod
    async def create_campaign(db: Session, artist_address: str, song_title: str, song_url: str, amount: float) -> Campaign:
        campaign = Campaign(
            artist_address=artist_address,
            song_title=song_title,
            song_url=song_url,
            total_amount=amount,
            amount_per_second=settings.PAYMENT_PER_SECOND,
            remaining_amount=amount,
            status=CampaignStatus.UNPAID.value
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    async def verify_and_update_payment(db: Session, campaign_id: int, transaction_hash: str) -> Campaign:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError("Campagne non trouvée")

        try:
            transaction = await xrpl_service.verify_transaction(transaction_hash)
            print("Transaction XRPL:", transaction)

            if not isinstance(transaction, dict):
                raise ValueError("Format de réponse XRPL invalide")
            
            if transaction.get("status") != "success":
                raise ValueError(transaction.get("message", "La transaction n'a pas pu être vérifiée"))
            
            amount = transaction.get("amount")
            if amount is None:
                raise ValueError("Montant de la transaction non trouvé")

            if float(amount) >= campaign.total_amount:
                campaign.status = CampaignStatus.PAID.value
                campaign.payment_transaction_hash = transaction_hash
                db.commit()
                db.refresh(campaign)
                return campaign
            else:
                raise ValueError("Le montant payé est insuffisant")

        except Exception as e:
            print(f"Erreur lors de la vérification du paiement: {str(e)}")
            raise ValueError(str(e))

    @staticmethod
    def get_active_campaigns(db: Session):
        return db.query(Campaign).filter(
            Campaign.status == CampaignStatus.PAID.value
        ).all()

    @staticmethod
    def get_artist_campaigns(db: Session, artist_address: str):
        return db.query(Campaign).filter(
            Campaign.artist_address == artist_address
        ).all()

    @staticmethod
    def delete_campaign(db: Session, campaign_id: int, artist_address: str):
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.artist_address == artist_address,
            Campaign.status == CampaignStatus.UNPAID.value
        ).first()
        
        if not campaign:
            raise ValueError("Campagne non trouvée ou non supprimable")
            
        db.delete(campaign)
        db.commit()

campaign_service = CampaignService() 