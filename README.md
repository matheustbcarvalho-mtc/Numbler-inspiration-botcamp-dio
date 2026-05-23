# Warcraft Rumble Slots — Bootcamp DIO

Simulador de caça-níquel estático (RTP ~92%), desenvolvido no bootcamp de Inteligência Artificial e Engenharia de Software da [DIO](https://www.dio.me). O jogo transpõe a estética de Azeroth para um ambiente de apostas virtual, com referência a normas técnicas de iGaming (ex.: GLI-11).

## Estrutura do repositório

```
assets/          Imagens .png dos símbolos (ver assets/README.md)
index.html       Estrutura da página
style.css        Visual do gabinete
script.js        Motor matemático (rolos, paytable, paylines, avaliação)
```

## Como rodar localmente

1. Abra `index.html` no navegador ou use a extensão **Live Server** no VS Code.
2. Coloque os PNG em `assets/` com os nomes listados em `assets/README.md`.
3. Sem imagens, o jogo ainda funciona: os símbolos aparecem como texto (fallback em `script.js`).

## Deploy na Vercel

1. Conecte este repositório em [vercel.com](https://vercel.com).
2. Não é necessário configurar pasta raiz — `index.html` está na raiz do projeto.

## Parâmetros do jogo

- **Tiras de rolo:** pesos calibrados por simulação Monte Carlo (~92% RTP)
- **Aposta total:** R$ 5, 10, 20 ou 50 (÷ 5 linhas = aposta por linha)
- **Saldo inicial:** R$ 1000,00
- **Paylines:** centro, topo, baixo, V e V invertido
- **Wild:** substitui símbolos pagantes (avaliação left-to-right)
- **Teste RTP / Calibração 92% e 95% / Auditoria / AUTO / Free spins** — ver botões na interface

---

## 1. Contexto e objetivos

**Objetivos técnicos:**

- Motor matemático com RTP (Return to Player) de 92%
- RNG (Gerador de Números Aleatórios) via software
- Interface com medidores de Saldo, Aposta e Ganhos

## 2. Curadoria de fontes

Fontes selecionadas via NotebookLM:

- **GLI-11** — padrões regulatórios para dispositivos de jogo
- **SoftGamings & SoftSwiss** — RNG e lógica operacional de slots
- **Elements of Slot Design** (Robert Muir) — matemática e tiras de rolo

## 3. Engenharia de prompts e “cicatrizes”

**Desafio:** o motor inicial em Python gerou `TypeError: cannot use 'list' as a dict key` na avaliação de ganhos.

**Solução:** correção do acesso à paytable para usar string por símbolo, preservando substituição Wild (Baú).

**Prompt reutilizável:** *"Atue como um auditor da GLI-11. Verifique se a lógica Left-to-Right e a substituição Wild desta função garantem o pagamento da combinação de maior valor na linha."*

## 4. Miniguia de estudo (entrega final)

O projeto equilibra psicologia do fluxo (“Machine Zone”) com rigor matemático. Hit rate calibrado em ~7,946% (alta volatilidade).

**Glossário:**

| Termo | Significado |
|-------|-------------|
| **RTP** | Porcentagem teórica devolvida ao jogador a longo prazo (92% neste projeto) |
| **RNG** | Cada giro é independente e imprevisível |
| **Wild** | Curinga que completa combinações vencedoras |
| **Payline** | Caminho no grid onde símbolos alinhados premiam |
