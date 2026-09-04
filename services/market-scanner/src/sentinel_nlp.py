from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import time

analyzer = SentimentIntensityAnalyzer()

class SentimentResult(BaseModel):
    score: float
    magnitude: float
    timestamp: float
    action: str  # "PANIC_KILL_SWITCH", "FOMO_ACCELERATE", or "NEUTRAL"
    text_processed: str

def _crypto_adjust(text: str) -> str:
    # Vader doesn't know crypto slang well, so we translate some things for it
    text = text.lower()
    text = text.replace("bullish", "excellent").replace("bearish", "awful")
    text = text.replace("fud", "fear and panic").replace("fomo", "excited and buying")
    text = text.replace("sec sues", "horrible devastating news").replace("hack", "catastrophic failure")
    text = text.replace("moon", "amazing growth rocket").replace("rekt", "destroyed bad")
    text = text.replace("etf approved", "massive success wonderful")
    text = text.replace("etf denied", "terrible disastrous failure")
    text = text.replace("dump", "massive crash panic")
    text = text.replace("pump", "huge rally success")
    return text

def analyze_crypto_news(text: str) -> SentimentResult:
    adjusted_text = _crypto_adjust(text)
    scores = analyzer.polarity_scores(adjusted_text)
    compound = scores['compound']
    
    # Analyze magnitude (how extreme)
    action = "NEUTRAL"
    if compound <= -0.5:
        action = "PANIC_KILL_SWITCH"
    elif compound >= 0.6:
        action = "FOMO_ACCELERATE"
        
    return SentimentResult(
        score=compound,
        magnitude=abs(compound),
        timestamp=time.time(),
        action=action,
        text_processed=text
    )
