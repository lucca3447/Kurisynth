from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class TTSRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str
    engine: Optional[str] = "edge_rvc"  # "qwen3" or "edge_rvc" / "edge"
    emotion: Optional[str] = None
    instruct: Optional[str] = None
    voice: Optional[str] = "pt-BR-FranciscaNeural"
    rate: Optional[str] = "+5%"
    pitch: Optional[str] = "+15Hz"
    use_rvc: Optional[bool] = Field(False, alias="useRvc")
    rvc_pitch: Optional[int] = Field(0, alias="rvcPitch")
    rvc_index_rate: Optional[float] = Field(0.75, alias="rvcIndexRate")


