from typing import List
from app.core.config import OPENROUTER_FREE_MODELS

def get_openrouter_candidate_models() -> List[str]:
    return list(OPENROUTER_FREE_MODELS)
