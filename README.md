Contexto e Objetivos
Este projeto, Warcraft Rumble Slots, foi desenvolvido como parte de um bootcamp focado em Inteligência Artificial e Engenharia de Software. O objetivo foi criar um simulador de máquina caça-níqueis funcional que transpõe a estética de Azeroth para um ambiente de apostas virtual, respeitando as normas técnicas da indústria de iGaming, como a GLI-11 (Gaming Laboratories International)

Objetivos Técnicos:
Implementar um motor matemático com RTP (Return to Player) de 92%

Garantir a integridade do RNG (Gerador de Números Aleatórios) via software

Desenvolver uma interface transparente com medidores de Saldo, Aposta e Ganhos

2. Curadoria de Fontes
Para a fundamentação deste projeto, foram selecionadas as seguintes fontes técnicas através do NotebookLM:
GLI-11: Padrões regulatórios para dispositivos de jogo

SoftGamings & SoftSwiss: Guias sobre algoritmos RNG e lógica operacional de slots

Elements of Slot Design (Robert Muir): Matemática aplicada e design de tiras de rolo

3. Engenharia de Prompts e "Cicatrizes"
Durante o desenvolvimento, utilizei prompts estratégicos para depurar a lógica matemática e converter o código entre linguagens.
Desafio (Cicatriz): O motor inicial em Python apresentou um erro de TypeError: cannot use 'list' as a dict key na função de avaliação de ganhos.
Solução via Prompt: Solicitei ao "copiloto" a correção do acesso ao dicionário da paytable, garantindo que o símbolo alvo fosse uma string individual e não uma lista, preservando a lógica de substituição pelo símbolo Wild (Baú) [Conversa].
Prompt Reutilizável: "Atue como um auditor da GLI-11. Verifique se a lógica Left-to-Right e a substituição Wild desta função garantem o pagamento da combinação de maior valor na linha"

4. Miniguia de Estudo (Entrega Final)
Resumo do Assunto: O projeto demonstra como o design de jogos de azar equilibra a Psicologia do Fluxo (Machine Zone) com o rigor matemático. A volatilidade do jogo foi calibrada em 7.946% (Hit Rate), criando uma experiência de "Alta Volatilidade" onde os prêmios são menos frequentes, mas mais gratificantes [Log de Auditoria, 34].
Glossário Técnico:
RTP (Return to Player): Porcentagem teórica devolvida ao jogador a longo prazo (92% neste projeto).
RNG (Random Number Generator): Algoritmo que garante que cada giro é independente e imprevisível.
Wild: Símbolo "curinga" que substitui outros para completar combinações vencedoras.
Payline: O caminho geográfico no grid onde as combinações de símbolos devem cair para premiar.

--------------------------------------------------------------------------------
