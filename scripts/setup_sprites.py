#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenAmadeus Companion - Utilitário de Verificação de Sprites da Persona
========================================================================
Este script verifica a presença do pacote opcional de sprites visuais
para a persona Makise Kurisu no OpenAmadeus Companion.

Nota de Direitos Autorais:
Os sprites visuais originais de Steins;Gate são propriedade exclusiva da
MAGES. / 5pb. / Chiyomaru Studio e NÃO são distribuídos neste repositório.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPRITES_DIR = REPO_ROOT / "public" / "assets" / "sprites" / "kurisu"

def main():
    print("=" * 65)
    print(" OpenAmadeus Companion — Verificador de Assets Visuais")
    print("=" * 65)
    print(f"Diretório alvo: {SPRITES_DIR}\n")

    if not SPRITES_DIR.exists():
        print("[!] Diretório de sprites não encontrado.")
        print("[*] Criando diretório vazio...")
        SPRITES_DIR.mkdir(parents=True, exist_ok=True)
        print("[✓] Diretório criado.")
    
    png_files = list(SPRITES_DIR.glob("*.png"))
    count = len(png_files)

    if count >= 170:
        print(f"[OK] SUCESSO: Pacote completo detectado com {count} sprites.")
        print("    A interface do OpenAmadeus Companion carregara as expressoes completas.")
        return 0
    elif count > 0:
        print(f"[!] ATENCAO: Detectados {count} sprites (esperado: ~174).")
        print("    Algumas expressoes podem utilizar a silhueta de fallback.")
        return 0
    else:
        print("[i] NENHUM SPRITE ENCONTRADO.")
        print("-" * 65)
        print("INSTRUÇÕES:")
        print("1. O OpenAmadeus Companion funciona perfeitamente sem os sprites,")
        print("   utilizando a silhueta vetorial holográfica de fallback.")
        print("2. Caso deseje utilizar o visual completo da persona Makise Kurisu:")
        print(f"   Copie os arquivos PNG da visual novel para a pasta:\n   {SPRITES_DIR}")
        print("3. Reinicie a interface web (npm run dev).")
        print("-" * 65)
        return 1

if __name__ == "__main__":
    sys.exit(main())
