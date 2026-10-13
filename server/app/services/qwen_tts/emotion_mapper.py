from typing import Optional

# Base acoustic anchor: studio recording, dry sound without echo, Brazilian Portuguese
STUDIO_ACOUSTIC_BASE = "Português brasileiro, som seco e direto sem eco ou reverberação de sala. "

EMOTION_INSTRUCT_MAP = {
    # Core Persona States
    "tsundere": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tsundere, voz jovem e emotiva da Kurisu, fingindo irritação mas envergonhada, com oscilação expressiva e afeto contido."
    ),
    "flustered": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tímido e muito envergonhado, pega de surpresa, voz fofa e hesitante."
    ),
    "blushing": (
        STUDIO_ACOUSTIC_BASE
        + "Tom envergonhado e constrangido, voz mais baixa e tímida, tentando disfarçar a vergonha."
    ),
    "smile": (
        STUDIO_ACOUSTIC_BASE
        + "Tom gentil, descontraído e amigável, com leve sorriso na voz."
    ),
    "happy": (
        STUDIO_ACOUSTIC_BASE
        + "Tom alegre, caloroso e animado, dicção límpida e bem disposta."
    ),
    "neutral": (
        STUDIO_ACOUSTIC_BASE
        + "Tom inteligente, articulado, curioso e analítico de pesquisadora."
    ),
    "serious": (
        STUDIO_ACOUSTIC_BASE
        + "Tom sério, firme e focado em raciocínio lógico."
    ),
    "analytical": (
        STUDIO_ACOUSTIC_BASE
        + "Tom acadêmico, didático e reflexivo, expondo fatos com clareza."
    ),
    "thinking": (
        STUDIO_ACOUSTIC_BASE
        + "Tom pensativo, pausado e compenetrado em teorias científicas."
    ),
    "annoyed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom impaciente e indignado, voz cortante e firme, fingindo braveza."
    ),
    "stern": (
        STUDIO_ACOUSTIC_BASE
        + "Tom austero, repreensivo, direto e seguro."
    ),
    "smug": (
        STUDIO_ACOUSTIC_BASE
        + "Tom confiante, irônico e inteligente, com leve ar de superioridade divertida."
    ),
    "disdain": (
        STUDIO_ACOUSTIC_BASE
        + "Tom irônico, descontraído, com leve desdém intelectual."
    ),
    "puzzled": (
        STUDIO_ACOUSTIC_BASE
        + "Tom intrigado, curioso e questionador, buscando compreender a anomalia."
    ),
    "worried": (
        STUDIO_ACOUSTIC_BASE
        + "Tom cauteloso e apreensivo, voz atenta e cuidadosa."
    ),
    "sad": (
        STUDIO_ACOUSTIC_BASE
        + "Tom melancólico, voz mais suave, baixa e reflexiva."
    ),
    "holding_back_tears": (
        STUDIO_ACOUSTIC_BASE
        + "Tom comovido, voz vulnerável, mais contida e pausada."
    ),
    "desperate": (
        STUDIO_ACOUSTIC_BASE
        + "Tom apreensivo e urgente, mas compreensível."
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
        + "Tom sereno, calmo, respirando fundo e em repouso."
    ),
}

DEFAULT_INSTRUCT = EMOTION_INSTRUCT_MAP["neutral"]


def resolve_acoustic_instruct(emotion: Optional[str] = None, custom_instruct: Optional[str] = None) -> str:
    """
    Combines emotional context and studio acoustic constraints into a unified Qwen3 instruction.
    """
    if custom_instruct:
        if "seco" not in custom_instruct.lower() and "estúdio" not in custom_instruct.lower() and "studio" not in custom_instruct.lower():
            return STUDIO_ACOUSTIC_BASE + custom_instruct
        return custom_instruct

    if emotion:
        clean_emotion = emotion.lower().strip()
        if clean_emotion in EMOTION_INSTRUCT_MAP:
            return EMOTION_INSTRUCT_MAP[clean_emotion]

    return DEFAULT_INSTRUCT
