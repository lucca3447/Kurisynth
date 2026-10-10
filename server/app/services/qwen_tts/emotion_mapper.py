from typing import Optional

# Base studio prompt forcing close-mic direct dry sound without room echo or distance
STUDIO_ACOUSTIC_BASE = (
    "Gravação de estúdio cristalina, voz muito próxima do microfone (close-mic), "
    "som seco e direto sem eco ou reverberação de sala. "
)

EMOTION_INSTRUCT_MAP = {
    "tsundere": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tsundere, tímida e envergonhada, com suspiros suaves e pausas hesitantes (...), fingindo irritação."
    ),
    "flustered": (
        STUDIO_ACOUSTIC_BASE
        + "Tom muito tímido, surpreso e envergonhado, gaguejando levemente e sem jeito."
    ),
    "annoyed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom irritado, cortante, impaciente e ligeiramente acelerado, voz indignada."
    ),
    "serious": (
        STUDIO_ACOUSTIC_BASE
        + "Tom firme, analítico, calmo e seguro de cientista pesquisadora."
    ),
    "thinking": (
        STUDIO_ACOUSTIC_BASE
        + "Tom reflexivo, pausado, curioso e compenetrado em pensamentos."
    ),
    "happy": (
        STUDIO_ACOUSTIC_BASE
        + "Tom alegre, gentil, voz suave e relaxada."
    ),
    "smile": (
        STUDIO_ACOUSTIC_BASE
        + "Tom caloroso, leve sorriso na voz, amigável e descontraída."
    ),
    "smug": (
        STUDIO_ACOUSTIC_BASE
        + "Tom confiante, levemente provocador, irônico e com ar de superioridade."
    ),
    "sad": (
        STUDIO_ACOUSTIC_BASE
        + "Tom melancólico, voz mais baixa, suave e vulnerável."
    ),
    "puzzled": (
        STUDIO_ACOUSTIC_BASE
        + "Tom intrigado, confuso, indagador e com estranhamento."
    ),
    "desperate": (
        STUDIO_ACOUSTIC_BASE
        + "Tom aflito, urgente, voz tensa e preocupada."
    ),
    "neutral": (
        STUDIO_ACOUSTIC_BASE
        + "Voz natural da Makise Kurisu, inteligente, articulada e ligeiramente reservada."
    ),
}

DEFAULT_INSTRUCT = EMOTION_INSTRUCT_MAP["neutral"]


def resolve_acoustic_instruct(emotion: Optional[str] = None, custom_instruct: Optional[str] = None) -> str:
    """
    Combines emotional context and studio acoustic constraints into a unified Qwen3 instruction.
    """
    if custom_instruct:
        # Prepend studio acoustics if not already specified in custom instruct
        if "estúdio" not in custom_instruct.lower() and "studio" not in custom_instruct.lower():
            return STUDIO_ACOUSTIC_BASE + custom_instruct
        return custom_instruct

    if emotion:
        clean_emotion = emotion.lower().strip()
        if clean_emotion in EMOTION_INSTRUCT_MAP:
            return EMOTION_INSTRUCT_MAP[clean_emotion]

    return DEFAULT_INSTRUCT
