import time
import httpx
from typing import Dict, Any, Optional

DIVERGENCE_API_URL = "https://divergence.nyarchlinux.moe/api/divergence"

# In-memory cache for divergence value
_cached_divergence: Optional[Dict[str, Any]] = None
_cache_ttl_seconds: int = 300  # 5 minutes cache

def determine_worldline(val_str: str) -> str:
    try:
        val = float(val_str.replace("%", "").strip())
        if val < 0.0:
            return "Omega Worldline (Desolação Absoluta)"
        elif val < 1.0:
            return "Alpha Worldline (Distopia SERN)"
        elif val >= 1.048596 and val < 1.048600:
            return "Steins Gate (Linha Prometida)"
        elif val < 2.0:
            return "Beta Worldline (Terceira Guerra Mundial)"
        else:
            return "Gamma / Delta Worldline (Linha Desconhecida)"
    except Exception:
        return "Beta Worldline (Amadeus 2026)"

async def get_worldline_divergence() -> Dict[str, Any]:
    global _cached_divergence
    now = time.time()

    if _cached_divergence and (now - _cached_divergence.get("cached_at", 0)) < _cache_ttl_seconds:
        return _cached_divergence["data"]

    divergence_val = "1.048596"
    source = "canonical_fallback"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(DIVERGENCE_API_URL)
            if resp.status_code == 200:
                data = resp.json()
                raw_div = str(data.get("divergence", "1.048596")).strip()
                if raw_div:
                    divergence_val = raw_div
                    source = "live_api"
    except Exception as e:
        print(f"[Amadeus Core] Divergence API unreachable ({e}). Using canonical worldline.")

    worldline_name = determine_worldline(divergence_val)
    result = {
        "divergence": divergence_val,
        "worldline": worldline_name,
        "source": source,
        "timestamp": now
    }

    _cached_divergence = {
        "cached_at": now,
        "data": result
    }

    return result
