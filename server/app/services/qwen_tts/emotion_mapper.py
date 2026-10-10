from typing import Optional

# Base acoustic and prosody anchor: enforces crystal-clear studio sound and grounded, mature Brazilian Portuguese
STUDIO_ACOUSTIC_BASE = (
    "Português brasileiro fluente. Gravação de estúdio cristalina, "
    "voz muito próxima do microfone (close-mic), som seco e direto sem eco ou reverberação de sala. "
    "Voz calma, estável, madura e inteligente da cientista Makise Kurisu, dicção clara, "
    "ritmo natural e cadenciado, sem aceleração artificial ou desespero. "
)

EMOTION_INSTRUCT_MAP = {
    # Core Persona States
    "neutral": (
        STUDIO_ACOUSTIC_BASE
        + "Tom neutro, racional, articulado, seguro e ponderado de pesquisadora em neurociência."
    ),
    "tsundere": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tsundere clássico, reservada e fingindo leve irritação, mas com fala controlada e pausas naturais."
    ),
    "smile": (
        STUDIO_ACOUSTIC_BASE
        + "Tom amigável, acolhedor, leve sorriso sutil na fala, voz tranquila, descontraída e segura."
    ),
    "happy": (
        STUDIO_ACOUSTIC_BASE
        + "Tom alegre, gentil, voz suave e relaxada, dicção límpida e bem disposta."
    ),
    "serious": (
        STUDIO_ACOUSTIC_BASE
        + "Tom sério, analítico, firme, sóbrio e focado em raciocínio científico."
    ),
    "analytical": (
        STUDIO_ACOUSTIC_BASE
        + "Tom acadêmico, didático, reflexivo e articulado, apresentando fatos com clareza."
    ),
    "thinking": (
        STUDIO_ACOUSTIC_BASE
        + "Tom pensativo, pausado, reflexivo e compenetrado em teorias científicas."
    ),
    "flustered": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tímido e reservado, levemente desconcertada, voz contida e hesitante sem pressa."
    ),
    "blushing": (
        STUDIO_ACOUSTIC_BASE
        + "Tom envergonhado e reservado, voz mais baixa e tímida, contendo as emoções."
    ),
    "annoyed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom ligeiramente impaciente e firme, voz cortante e decidida, sem gritos."
    ),
    "stern": (
        STUDIO_ACOUSTIC_BASE
        + "Tom austero, repreensivo, direto e seguro, mantendo postura madura."
    ),
    "smug": (
        STUDIO_ACOUSTIC_BASE
        + "Tom confiante, irônico e inteligente, com leve ar de superioridade divertida."
    ),
    "disdain": (
        STUDIO_ACOUSTIC_BASE
        + "Tom irônico, descontraído, com leve desdém intelectual e postura superior."
    ),
    "puzzled": (
        STUDIO_ACOUSTIC_BASE
        + "Tom intrigado, curioso e questionador, buscando compreender o problema."
    ),
    "worried": (
        STUDIO_ACOUSTIC_BASE
        + "Tom cauteloso e apreensivo, voz atenta e cuidadosa, sem histeria."
    ),
    "sad": (
        STUDIO_ACOUSTIC_BASE
        + "Tom melancólico, voz mais suave, baixa e reflexiva, ritmo pausado."
    ),
    "holding_back_tears": (
        STUDIO_ACOUSTIC_BASE
        + "Tom comovido, voz vulnerável, mais contida e pausada."
    ),
    "desperate": (
        STUDIO_ACOUSTIC_BASE
        + "Tom apreensivo e urgente, mas com dicção compreensível e firmeza."
    ),
    "wink": (
        STUDIO_ACOUSTIC_BASE
        + "Tom descontraído, cúmplice, confiante e amigável."
    ),
    "look_side": (
        STUDIO_ACOUSTIC_BASE
        + "Tom esquivo, desconfiado e reservado, olhando de soslaio."
    ),
    "eyes_closed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom calmo, sereno, respirando fundo e em repouso."
    ),
}

DEFAULT_INSTRUCT = EMOTION_INSTRUCT_MAP["neutral"]


def resolve_acoustic_instruct(emotion: Optional[str] = None, custom_instruct: Optional[str] = None) -> str:
    """
    Combines emotional context and studio acoustic constraints into a unified Qwen3 instruction.
    """
    if custom_instruct:
        if "estúdio" not in custom_instruct.lower() and "studio" not in custom_instruct.lower():
            return STUDIO_ACOUSTIC_BASE + custom_instruct
        return custom_instruct

    if emotion:
        clean_emotion = emotion.lower().strip()
        if clean_emotion in EMOTION_INSTRUCT_MAP:
            return EMOTION_INSTRUCT_MAP[clean_emotion]

    return DEFAULT_INSTRUCT
