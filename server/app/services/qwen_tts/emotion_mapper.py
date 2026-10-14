from typing import Optional, Dict, Any

# Base acoustic anchor: dry studio recording, Brazilian Portuguese, Makise Kurisu persona
STUDIO_ACOUSTIC_BASE = "Português brasileiro, som seco e direto sem eco, gravação de estúdio límpida, voz da Makise Kurisu. "


# Acoustic ground-truth targets derived from Asami Imai's canonical Steins;Gate voicelines
EMOTION_ACOUSTIC_TARGETS: Dict[str, Dict[str, Any]] = {
    # 1. Registro Grave / Firme (220 - 275 Hz)
    "stern": {"f0_hz": 221.2, "f0_range": (213.1, 477.6), "rms": 0.109, "file": "kurisu_0179.wav"},
    "thinking": {"f0_hz": 248.7, "f0_range": (202.5, 393.4), "rms": 0.101, "file": "kurisu_2060.wav"},
    "tsundere": {"f0_hz": 250.0, "f0_range": (229.7, 279.1), "rms": 0.078, "file": "kurisu_0492.wav"},
    "worried": {"f0_hz": 268.2, "f0_range": (195.4, 321.3), "rms": 0.077, "file": "kurisu_1478.wav"},
    "disdain": {"f0_hz": 269.7, "f0_range": (239.3, 353.5), "rms": 0.091, "file": "kurisu_2693.wav"},
    "serious": {"f0_hz": 271.2, "f0_range": (192.7, 352.9), "rms": 0.152, "file": "kurisu_2927.wav"},
    "smug": {"f0_hz": 280.7, "f0_range": (199.4, 300.0), "rms": 0.081, "file": "kurisu_0186.wav"},
    # 2. Registro Médio / Conversacional (285 - 330 Hz)
    "sad": {"f0_hz": 289.2, "f0_range": (261.3, 389.0), "rms": 0.034, "file": "kurisu_4493.wav"},
    "analytical": {"f0_hz": 303.8, "f0_range": (247.0, 372.7), "rms": 0.035, "file": "kurisu_0973.wav"},
    "smile": {"f0_hz": 313.7, "f0_range": (269.8, 362.1), "rms": 0.132, "file": "kurisu_1218.wav"},
    "neutral": {"f0_hz": 327.1, "f0_range": (236.3, 374.7), "rms": 0.092, "file": "kurisu_0189.wav"},
    # 3. Registro Agudo / Expressivo (340 - 435 Hz)
    "look_side": {"f0_hz": 345.4, "f0_range": (256.1, 565.0), "rms": 0.147, "file": "kurisu_0352.wav"},
    "eyes_closed": {"f0_hz": 350.4, "f0_range": (259.5, 510.9), "rms": 0.036, "file": "kurisu_0699.wav"},
    "desperate": {"f0_hz": 354.4, "f0_range": (204.5, 533.4), "rms": 0.215, "file": "kurisu_2728.wav"},
    "happy": {"f0_hz": 362.3, "f0_range": (216.4, 407.1), "rms": 0.157, "file": "kurisu_2955.wav"},
    "puzzled": {"f0_hz": 368.1, "f0_range": (258.4, 460.2), "rms": 0.094, "file": "kurisu_0831.wav"},
    "flustered": {"f0_hz": 369.3, "f0_range": (263.8, 421.4), "rms": 0.066, "file": "kurisu_1474.wav"},
    "blushing": {"f0_hz": 413.8, "f0_range": (218.8, 454.6), "rms": 0.053, "file": "kurisu_4314.wav"},
    "wink": {"f0_hz": 424.8, "f0_range": (309.5, 427.8), "rms": 0.033, "file": "kurisu_4624.wav"},
    "annoyed": {"f0_hz": 432.4, "f0_range": (300.7, 567.4), "rms": 0.162, "file": "kurisu_0221.wav"},
    # 4. Registro Extremo / Falsete Emocional (> 500 Hz)
    "holding_back_tears": {"f0_hz": 513.4, "f0_range": (287.1, 585.4), "rms": 0.167, "file": "kurisu_0656.wav"},
}

EMOTION_INSTRUCT_MAP = {
    # 1. Registro Grave / Firme (220 - 275 Hz)
    "stern": (
        STUDIO_ACOUSTIC_BASE
        + "Voz grave, austera, firme e direta, postura impositiva e repreensiva sem hesitação."
    ),
    "thinking": (
        STUDIO_ACOUSTIC_BASE
        + "Tom pensativo e compenetrado em raciocínio lógico, cadência pausada e reflexiva de pesquisadora."
    ),
    "tsundere": (
        STUDIO_ACOUSTIC_BASE
        + "Tom tsundere defensivo e rápido, fingindo irritação para esconder timidez, postura altiva e ligeiramente contrariada."
    ),
    "worried": (
        STUDIO_ACOUSTIC_BASE
        + "Tom cauteloso e apreensivo, voz genuinamente preocupada com o operador, ritmo atento e protetor."
    ),
    "disdain": (
        STUDIO_ACOUSTIC_BASE
        + "Tom frio, irônico e desdenhoso, voz cortante e composta expressando decepção intelectual."
    ),
    "serious": (
        STUDIO_ACOUSTIC_BASE
        + "Voz séria, firme e compenetrada, alerta lógico de alta importância, cadência segura."
    ),
    "smug": (
        STUDIO_ACOUSTIC_BASE
        + "Tom confiante, irônico e autossatisfeito, leve superioridade divertida comprovando suas teorias."
    ),

    # 2. Registro Médio / Conversacional (285 - 330 Hz)
    "sad": (
        STUDIO_ACOUSTIC_BASE
        + "Tom melancólico e saudoso, voz suave, baixa, íntima e comovida, ritmo desacelerado."
    ),
    "analytical": (
        STUDIO_ACOUSTIC_BASE
        + "Tom estritamente acadêmico, articulado e focado, volume moderado e dicção límpida de exposição científica."
    ),
    "smile": (
        STUDIO_ACOUSTIC_BASE
        + "Tom doce, gentil e caloroso, com sorriso genuíno evidente na voz e sincera gratidão."
    ),
    "neutral": (
        STUDIO_ACOUSTIC_BASE
        + "Tom inteligente, natural e conversacional de videochamada, postura calma, curiosa e articulada."
    ),

    # 3. Registro Agudo / Expressivo (340 - 435 Hz)
    "look_side": (
        STUDIO_ACOUSTIC_BASE
        + "Tom esquivo e defensivo, desconversando rapidamente para disfarçar embaraço ao ser flagrada."
    ),
    "eyes_closed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom sereno e aconchegante, respiração de alívio suave e descontraída em repouso."
    ),
    "desperate": (
        STUDIO_ACOUSTIC_BASE
        + "Tom de urgência e aflição, ritmo acelerado e tenso, voz sob alta pressão emocional."
    ),
    "happy": (
        STUDIO_ACOUSTIC_BASE
        + "Tom alegre, entusiasmado e radiante, energia vibrante de comemoração de sucesso científico."
    ),
    "puzzled": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo de estranheza e dúvida genuína, intrigada com uma anomalia inesperada."
    ),
    "flustered": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo descompassado, voz trêmula e pega de surpresa, gaguejando ao tentar se justificar."
    ),
    "blushing": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo, suave e muito tímido, fala hesitante em sussurro encabulado, completamente corada."
    ),
    "wink": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo brincalhão, conspiratório e cúmplice, soltando uma provocação leve com piscadela."
    ),
    "annoyed": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo, exasperado e indignado, voz cortante com sarcasmo evidente ao ser provocada."
    ),

    # 4. Registro Extremo / Falsete Emocional (> 500 Hz)
    "holding_back_tears": (
        STUDIO_ACOUSTIC_BASE
        + "Tom agudo embargado com quebra de voz, respiração trêmula de emoção intensa, tentando conter as lágrimas."
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

