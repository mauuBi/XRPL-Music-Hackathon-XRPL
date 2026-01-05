from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./xrpl_music.db")
    XRPL_NODE_URL: str = os.getenv("XRPL_NODE_URL", "wss://s.altnet.rippletest.net:51233")
    XRPL_COLD_WALLET: str = "rDA4ij9xksCM8Wk7LBvwXXtV8i967szpck"
    XRPL_HOT_WALLET_SEED: str = os.getenv("XRPL_HOT_WALLET_SEED", "")
    PAYMENT_PER_SECOND: float = 0.001
    MIN_CAMPAIGN_AMOUNT: float = float(os.getenv("MIN_CAMPAIGN_AMOUNT", "20.0"))
    
    XAMAN_API_KEY: str = os.getenv("XAMAN_API_KEY", "")
    XAMAN_API_SECRET: str = os.getenv("XAMAN_API_SECRET", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings() 