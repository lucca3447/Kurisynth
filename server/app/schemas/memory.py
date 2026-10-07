from typing import List, Optional
from pydantic import BaseModel

class AddMemoryRequest(BaseModel):
    title: str
    category: str
    content: str
    triggerKeywords: Optional[List[str]] = []
    emotionalWeight: Optional[str] = "Factual"
    source: Optional[str] = "custom"
