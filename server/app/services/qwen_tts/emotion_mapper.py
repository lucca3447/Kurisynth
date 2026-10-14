from typing import Optional, Dict, Any

# Acoustic ground-truth targets derived from Asami Imai's canonical Steins;Gate voicelines
EMOTION_ACOUSTIC_TARGETS: Dict[str, Dict[str, Any]] = {
    # 1. Registro Grave / Firme (220 - 275 Hz)
    "stern": {"f0_hz": 221.2, "f0_range": (213.1, 477.6), "rms": 0.109, "file": "kurisu_0179.wav"},
    "thinking": {"f0_hz": 248.7, "f0_range": (202.5, 393.4), "rms": 0.101, "file": "kurisu_2060.wav"},
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
    "tsundere": {"f0_hz": 372.5, "f0_range": (295.0, 440.0), "rms": 0.145, "file": "kurisu_1406.wav"},
    "blushing": {"f0_hz": 413.8, "f0_range": (218.8, 454.6), "rms": 0.053, "file": "kurisu_4314.wav"},
    "wink": {"f0_hz": 424.8, "f0_range": (309.5, 427.8), "rms": 0.033, "file": "kurisu_4624.wav"},
    "annoyed": {"f0_hz": 432.4, "f0_range": (300.7, 567.4), "rms": 0.162, "file": "kurisu_0221.wav"},
    # 4. Registro Extremo / Falsete Emocional (> 500 Hz)
    "holding_back_tears": {"f0_hz": 513.4, "f0_range": (287.1, 585.4), "rms": 0.167, "file": "kurisu_0656.wav"},
}

# Minimalist, non-intrusive style steering.
# Short 1-4 word prompts let the pre-trained weights of Asami Imai dominate naturally without cross-attention dilution.
EMOTION_INSTRUCT_MAP: Dict[str, Optional[str]] = {
    # Neutral: None allows pure native weights without prompt interference
    "neutral": None,
    # Tsundere & Expressive Agudo
    "tsundere": "Voz tsundere, irritada e altiva.",
    "flustered": "Voz envergonhada e gaguejando.",
    "blushing": "Voz tímida e constrangida.",
    "annoyed": "Voz brava e cortante.",
    "wink": "Voz brincalhona e conspiratória.",
    "look_side": "Voz esquiva e desconversando.",
    "eyes_closed": "Voz serena e calma.",
    "puzzled": "Voz curiosa e confusa.",
    "happy": "Voz alegre e animada.",
    "smile": "Voz gentil e calorosa.",
    # Registro Grave / Firme
    "stern": "Voz severa e austera.",
    "serious": "Voz séria e compenetrada.",
    "disdain": "Voz fria e desdenhosa.",
    "thinking": "Voz pensativa e reflexiva.",
    "analytical": "Voz acadêmica e articulada.",
    "smug": "Voz convencida e presunçosa.",
    "worried": "Voz preocupada e atenta.",
    # Registro Emocional / Intenso
    "sad": "Voz triste e melancólica.",
    "holding_back_tears": "Voz emocionada, contendo lágrimas.",
    "desperate": "Voz aflita e urgente.",
}


def resolve_acoustic_instruct(emotion: Optional[str] = None, custom_instruct: Optional[str] = None) -> Optional[str]:
    """
    Returns None to test Qwen3-TTS purely on its pre-trained weights without any acoustic targets or prompt steering.
    If custom_instruct is explicitly provided, it will be respected.
    """
    if custom_instruct:
        return custom_instruct
    return None
