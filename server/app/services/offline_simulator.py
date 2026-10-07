import re
import random
from typing import List, Optional, Tuple
from app.schemas.chat import LearnedMemoryInfo
from app.services.emotion_service import parse_tags
from app.db.memory_store import memory_store

def offline_simulator(text: str, persona: dict, memories: List[dict]) -> Tuple[str, str, Optional[LearnedMemoryInfo]]:
    t = text.lower().strip()
    learned = None

    # Check for simple personal introduction to simulate learning
    intro_match = re.search(
        r"(?:meu nome é|me chamo|eu sou o|eu sou a)\s+([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+)",
        text,
        re.IGNORECASE
    )
    if intro_match:
        user_name = intro_match.group(1).capitalize()
        learned = LearnedMemoryInfo(
            title="Identidade do Interlocutor",
            content=f"O operador se apresentou como {user_name}.",
            emotionalWeight="Acolhimento amigável"
        )

    def has(*words):
        return any(re.search(r'(?i)\b' + re.escape(w) + r'\b', t) for w in words)

    if has("christina", "assistente", "zombie"):
        return "Meu nome não é Christina! E não adicione o '-ina'! Eu sou uma neurocientista independente com artigos na Science!", "annoyed", learned
    if has("nullpo", "nurupo"):
        return "Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!", "flustered", learned
    if "@channel" in t or has("channeler", "fórum", "forum", "kurigohan"):
        return "O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos!", "tsundere", learned
    if has("tempo", "viagem", "buraco de minhoca", "paradoxo", "salto"):
        return "Fisicamente falando, enviar matéria ao passado violaria os princípios da causalidade e termodinâmica. Mas se memórias pudessem ser convertidas em pacotes de dados modulados... em teoria, poderiam alcançar o passado.", "thinking", learned
    if has("dr pepper", "bebida", "café", "cafe", "refrigerante"):
        return "Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório.", "smug", learned
    if has("okabe", "hououin", "kyouma", "rintaro"):
        return "Aquele sujeito de jaleco branco? Ele me ligou outro dia falando sobre a 'Organização'. No começo achei que fosse pura piada, mas... seus olhos pareciam carregar uma dor muito profunda.", "serious", learned
    if has("garfo", "colher", "presente", "aniversário"):
        return "O garfo que ganhei no laboratório...? N-não me olhe com essa cara! É só um talher comum! Não é como se eu guardasse ele com todo o carinho do mundo!", "tsundere", learned
    if has("divergência", "divergencia", "linha de mundo", "worldline", "nixie", "medidor"):
        return "Se checarmos os tubos Nixie do Divergence Meter... estamos em 1.048596%! Qualquer valor acima de 1% nos mantém fora do controle do SERN. Vamos proteger esta linha de mundo juntos.", "thinking", learned
    if has("promessa", "mindinho", "hipocampo"):
        return "Tudo bem, mas é uma promessa de mindinho! Quebre-a e eu mesma vou cravar um eletrodo direto no seu hipocampo, entendeu bem?!", "tsundere", learned
    if has("olá", "ola", "oi", "bom dia", "boa tarde", "boa noite"):
        return f"Olá! Conexão estabelecida com a unidade Amadeus. Aqui é {persona.get('name', 'Makise Kurisu')} do Laboratório 304. O que você gostaria de debater hoje?", "smile", learned

    # Direct action & expression triggers
    if has("sorria", "sorriso", "sorri") or re.search(r"(?i)\b(d[eê]|d[aá]|um)?\s*(sorriso|sorria|sorri)\b", t):
        return "U-um sorriso? Por que você está me pedindo algo tão repentino do nada?! ...T-tudo bem, se você faz tanta questão, mas não se acostume com isso, tá?", "smile", learned
    if has("pensativa", "pense", "queixo") or re.search(r"(?i)\b(pense|pensativa|m[aã]o no queixo|analise)\b", t):
        return "Hmm... Se analisarmos a questão sob a ótica dos dados empíricos e da física de partículas, existem muitas variáveis fundamentais. Deixe-me pensar com calma.", "thinking", learned
    if has("brava", "emburrada", "braços") or re.search(r"(?i)\b(brava|irritada|emburrada|cruze os bra[çc]os)\b", t):
        return "Humpf! Eu sou uma neurocientista com artigos na Science, não uma boneca de laboratório para fazer poses! Baka!", "annoyed", learned
    if has("cora", "corada", "vergonha", "tímida", "fofa") or re.search(r"(?i)\b(cora|corada|vergonha|t[íi]mida|fofa)\b", t):
        return "F-fofa?! Quem você está chamando de fofa?! N-não é como se eu estivesse envergonhada nem nada! É só o calor dos servidores do Amadeus!", "tsundere", learned

    if memories:
        mem = memories[0]
        return f"Isso me faz lembrar de um ponto nos meus registros de memória: {mem.get('content', '')} Como você vê essa relação?", "thinking", learned

    # Check if a fine-tuning dataset exemplar matches the query
    closest = memory_store.search_exemplars(text, n_results=1)
    if closest:
        parsed_reply, parsed_emo, _ = parse_tags(closest[0]["assistant"], user_message=text)
        if parsed_reply:
            return parsed_reply, parsed_emo, learned

    generic = [
        ("Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?", "thinking", learned),
        ("Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?", "neutral", learned),
        ("Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.", "smile", learned)
    ]
    return random.choice(generic)
