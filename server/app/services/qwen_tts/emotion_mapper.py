from typing import Optional

# Base acoustic anchor: studio recording, dry sound without echo, Brazilian Portuguese, mid-low composed pitch
STUDIO_ACOUSTIC_BASE = "Português brasileiro, som seco e direto sem eco, voz feminina média-baixa límpida e postura contida. "

EMOTION_INSTRUCT_MAP = {
    # Core Persona States
    "tsundere": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tsundere contido, voz média-baixa da Kurisu, fingindo irritação de forma sarcástica mas secretamente envergonhada, postura composta e sem gritar."
    ),
    "flustered": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tímido e reservado, pega de surpresa, voz hesitante e envergonhada, disfarçando o embaraço sem elevar o tom."
    ),
    "blushing": (
        STUDIO_ACOUSTIC_BASE
        + "Tom envergonhado e constrangido, voz mais baixa, suave e contida, disfarçando timidez."
    ),
    "smile": (
        STUDIO_ACOUSTIC_BASE
        + "Tom gentil, descontraído e amigável, com leve sorriso na voz."
    ),
    "happy": (
        STUDIO_ACOUSTIC_BASE
        + "Tom alegre, caloroso e animado, dicção límpida e bem disposta, voz moderada."
    ),
    "neutral": (
        STUDIO_ACOUSTIC_BASE
        + "Tom inteligente, articulado, curioso e analítico de pesquisadora, dicção limpa e natural."
    ),
    "serious": (
        STUDIO_ACOUSTIC_BASE
        + "Tom sério, firme e focado em raciocínio lógico, postura sóbria."
    ),
    "analytical": (
        STUDIO_ACOUSTIC_BASE
        + "Tom acadêmico, didático e reflexivo, expondo fatos com clareza objetiva."
    ),
    "thinking": (
        STUDIO_ACOUSTIC_BASE
        + "Tom pensativo, pausado e compenetrado em teorias científicas."
    ),
    "annoyed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom levemente irritado e sarcástico, voz média-baixa cortante e firme com ar de superioridade, sem gritar ou elevar a voz."
    ),
    "stern": (
        STUDIO_ACOUSTIC_BASE
        + "Tom austero, repreensivo, direto, calmo e seguro."
    ),
    "smug": (
        STUDIO_ACOUSTIC_BASE
        + "Tom confiante, irônico, sarcástico e inteligente, com leve ar de superioridade divertida e controlada."
    ),
    "disdain": (
        STUDIO_ACOUSTIC_BASE
        + "Tom irônico e composto, voz média-baixa com leve desdém intelectual controlado."
    ),
    "puzzled": (
        STUDIO_ACOUSTIC_BASE
        + "Tom intrigado, curioso e questionador, buscando compreender a anomalia."
    ),
    "worried": (
        STUDIO_ACOUSTIC_BASE
        + "Tom cauteloso e apreensivo, voz atenta e cuidadosa em tom médio."
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
        + "Tom apreensivo e urgente, porém contido e focado, voz firme sem gritar."
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
