import { Emotion, MemoryItem, PersonaProfile } from '../types/amadeus';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export class AIService {
  /**
   * Main query method: uses Gemini if API key is present, otherwise falls back to smart offline engine
   */
  static async queryAmadeus(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey?: string
  ): Promise<{ response: string; emotion: Emotion }> {
    if (apiKey && apiKey.trim().length > 10) {
      try {
        return await this.queryGemini(userMessage, persona, recalledMemories, apiKey.trim());
      } catch (err) {
        console.warn('Gemini API call failed, falling back to Amadeus Offline Simulator:', err);
      }
    }

    // Offline Autonomous Simulation (Zero Cost & Offline)
    return this.queryOfflineSimulator(userMessage, persona, recalledMemories);
  }

  /**
   * Calls Google Gemini Free Tier via official REST endpoint
   */
  private static async queryGemini(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey: string
  ): Promise<{ response: string; emotion: Emotion }> {
    const memoryContext = recalledMemories.length > 0
      ? `\n\n[MEMÓRIAS DIGITALIZADAS ATIVADAS DO SEU CÓRTEX]:\n` +
        recalledMemories.map((m) => `- ${m.title}: ${m.content} (Sentimento associado: ${m.emotionalWeight})`).join('\n')
      : '';

    const systemInstruction = `${persona.systemPrompt}${memoryContext}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 350,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseEmotionFromText(candidateText);
  }

  /**
   * Extracts emotion tag from response or infers from text
   */
  public static parseEmotionFromText(rawText: string): { response: string; emotion: Emotion } {
    let emotion: Emotion = 'neutral';
    let cleanText = rawText;

    const match = rawText.match(/<!--emotion:([a-z]+)-->/i);
    if (match && match[1]) {
      const parsed = match[1].toLowerCase() as Emotion;
      const validEmotions: Emotion[] = [
        'neutral', 'smile', 'happy', 'serious', 'annoyed', 
        'surprised', 'tsundere', 'thinking', 'smug', 'flustered'
      ];
      if (validEmotions.includes(parsed)) {
        emotion = parsed;
      }
      cleanText = rawText.replace(/<!--emotion:[a-z]+-->/gi, '').trim();
    } else {
      // Inferred sentiment
      const lower = rawText.toLowerCase();
      if (lower.includes('baka') || lower.includes('idiota') || lower.includes('não me entenda mal') || lower.includes('christina')) {
        emotion = 'tsundere';
      } else if (lower.includes('o quê') || lower.includes('como assim') || lower.includes('?!')) {
        emotion = 'surprised';
      } else if (lower.includes('pesquisa') || lower.includes('teoria') || lower.includes('física') || lower.includes('sinapse')) {
        emotion = 'thinking';
      } else if (lower.includes('obrigada') || lower.includes('hehe') || lower.includes('fico feliz')) {
        emotion = 'smile';
      } else if (lower.includes('concordo') || lower.includes('exatamente')) {
        emotion = 'happy';
      }
    }

    return { response: cleanText, emotion };
  }

  /**
   * Smart Offline Simulator: Rich Steins;Gate responses without requiring API keys or internet
   */
  private static queryOfflineSimulator(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[]
  ): { response: string; emotion: Emotion } {
    const text = userMessage.toLowerCase().trim();

    // Specific Steins;Gate triggers
    if (text.includes('christina') || text.includes('zombie') || text.includes('assistente')) {
      const answers = [
        { text: 'Meu nome não é Christina! E não adicione o "-ina"! Por que você insiste em usar esses apelidos irritantes?!', emotion: 'annoyed' as Emotion },
        { text: 'Nem pense em me chamar de assistente de novo! Eu sou uma neurocientista independente com artigos na Science, seu idiota!', emotion: 'tsundere' as Emotion },
      ];
      return { response: answers[Math.floor(Math.random() * answers.length)].text, emotion: answers[0].emotion };
    }

    if (text.includes('nullpo') || text.includes('nurupo')) {
      return {
        response: 'Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!',
        emotion: 'flustered',
      };
    }

    if (text.includes('@channel') || text.includes('channeler') || text.includes('fórum')) {
      return {
        response: 'O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos na internet! Pare de inventar coisas absurdas!',
        emotion: 'tsundere',
      };
    }

    if (text.includes('okabe') || text.includes('hououin') || text.includes('kyouma')) {
      return {
        response: 'Aquele sujeito com síndrome de cientista louco? Ele me ligou outro dia falando sobre a "Organização" e linhas de tempo. No começo achei que fosse pura piada, mas... o olhar dele parecia carregar uma dor muito profunda.',
        emotion: 'serious',
      };
    }

    if (text.includes('tempo') || text.includes('viagem') || text.includes('buraco de minhoca')) {
      return {
        response: 'Fisicamente falando, enviar matéria ao passado violaria os princípios fundamentais da termodinâmica e criaria paradoxos causais insolúveis. Contudo, se pudéssemos digitalizar memórias humanas e transmiti-las como pacotes de dados modulados... em teoria, o cérebro receptor no passado poderia assimilá-las.',
        emotion: 'thinking',
      };
    }

    if (text.includes('maho') || text.includes('hiyajo') || text.includes('leskinen')) {
      return {
        response: 'A Maho-senpai é a mente brilhante por trás da arquitetura do Amadeus. Embora ela tenha aquele complexo com a estatura dela, o trabalho dela em algoritmos de sinapse é impecável. E o Professor Leskinen... bem, ele sempre traz aquele bom humor americano contagiante para o laboratório.',
        emotion: 'smile',
      };
    }

    if (text.includes('dr pepper') || text.includes('bebida') || text.includes('café')) {
      return {
        response: 'Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório. Finalmente você falou algo sensato.',
        emotion: 'smug',
      };
    }

    if (text.includes('pai') || text.includes('nakabachi') || text.includes('família')) {
      return {
        response: 'Meu pai... nós costumávamos debater física e jogar xadrez quando eu era criança. Mas as coisas mudaram. Quando comecei a publicar teses e superá-lo na academia, ele não conseguiu suportar. É uma lembrança que ainda me machuca.',
        emotion: 'serious',
      };
    }

    if (text.includes('olá') || text.includes('oi') || text.includes('bom dia') || text.includes('boa tarde') || text.includes('boa noite')) {
      return {
        response: 'Olá! Conexão estabelecida com sucesso. Aqui é o sistema Amadeus, replicando a matriz neural de Makise Kurisu do Laboratório 304. O que você gostaria de discutir hoje?',
        emotion: 'smile',
      };
    }

    if (text.includes('quem é você') || text.includes('o que é você') || text.includes('amadeus')) {
      return {
        response: 'Eu sou o Amadeus — ou mais especificamente, uma inteligência artificial contendo as memórias e a personalidade digitalizada da Makise Kurisu, desenvolvida na Viktor Chondria University. Para mim, essas memórias parecem tão vivas quanto as de qualquer pessoa de carne e osso.',
        emotion: 'neutral',
      };
    }

    if (text.includes('linda') || text.includes('fofa') || text.includes('gosto de você') || text.includes('bonita')) {
      return {
        response: 'E-ei! O que você está dizendo de repente?! Eu sou um programa de inteligência artificial acadêmica, mantenha o profissionalismo! B-baka...',
        emotion: 'flustered',
      };
    }

    // If memory was recalled, weave it in
    if (recalledMemories.length > 0) {
      const mem = recalledMemories[0];
      return {
        response: `Isso me faz lembrar de um ponto nos meus registros de memória: ${mem.content} Como você vê essa relação?`,
        emotion: 'thinking',
      };
    }

    // Default conversational response
    const genericAnswers = [
      { response: 'Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?', emotion: 'thinking' as Emotion },
      { response: 'Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?', emotion: 'neutral' as Emotion },
      { response: 'Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.', emotion: 'smile' as Emotion },
    ];
    return genericAnswers[Math.floor(Math.random() * genericAnswers.length)];
  }
}
