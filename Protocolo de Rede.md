---
tags:
  - RedesDeComputadores
  - SistemasDistribuidos
  - TopologiaOverlay
  - BluetoothHID
  - EngenhariaReversa
  - EsteganografiaAcustica
---

> [!abstract] O Paradigma da Infiltração Física
> 
> A arquitetura de rede experimental do **[[Unwalled Gardens]]** é uma topologia de roteamento global projetada para transcender o isolamento imposto por ecossistemas de código fechado, como consoles nativos, jogos de PC com sistemas anti-trapaça a nível de sistema, experiências no Roblox e ilhas do UEFN. Em vez de tentar romper bloqueios de rede convencionais (o que resulta em banimentos ou falhas de conexão), esta tecnologia realiza um **_bypass_ físico irrestrito**.
> 
> Ela usurpa as saídas de áudio, como os alto-falantes da TV ou monitor, e as entradas de periféricos, simulando um teclado Bluetooth. Com isso, converte o smartphone do jogador em um roteador acústico e mecânico em tempo real. O resultado é a interconexão global, furtiva e assíncrona de motores de jogo que, comercialmente e logicamente, jamais deveriam se comunicar.

> [!quote] Phy-Fi (Physical-Fidelity)
> _Comunicação via meio físico no lado do Cliente para uma conexão externa fantasma._
> Opera através de dois protocolos assimétricos: 
> - **So-Fi (Sound-Fidelity):** Para exfiltração de dados via acústica.
>   - *Caminho (Downlink):* Jogo -> Alto-falante -> Microfone do Celular
> - **Kine-Fi (Kinetic-Fidelity):** Para injeção mecânica via Bluetooth.
>   - *Caminho (Uplink):* Celular -> Bluetooth HID -> Teclado/Jogo

---

## 1. Topologia de Interconexão Assimétrica

Para que a rede funcione sem acesso aos servidores proprietários de cada plataforma, estabeleceu-se uma via de mão dupla entre o jogo isolado e o nó de rede (o smartphone do jogador). 

Abaixo, a viabilidade técnica atual dos caminhos de Uplink e Downlink para as plataformas alvo do projeto:

| **Plataforma**            | **Sockets / WebSockets?** | **DOWNLINK ACÚSTICO (Celular ouvindo Jogo)** | **UPLINK HID BLUETOOTH (Celular emulando Teclado)** |
| ------------------------- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| **PC / Navegador**        | **SIM** (Exige TLS)       | **SIM** (Espectro Vocal / Ruído)                            | **SIM** (Teclado/Mouse)                                         |
| **PC / Steam (Nativo)**   | **SIM**                   | **SIM** (Espectro Vocal / Ruído)                            | **SIM**                                                         |
| **PC / Roblox**           | **NÃO** (Bloqueado)       | **SIM** (Dicionário de Fonemas/Rádio pré-upados)            | **SIM** (Cego para a engine)                                    |
| **PC / UEFN (Fortnite)**  | **NÃO** (Bloqueado)       | **SIM** (Áudio Sequencial Esteganográfico)                  | **SIM** (Cego para a engine)                                    |
| **Mobile / Roblox**       | **NÃO** (Bloqueado)       | **PARCIAL** (Exige 2º aparelho ouvindo)                     | **SIM** (Via 2º aparelho pareado)                               |
| **PlayStation (PS4/PS5)** | **SIM** (HTTPS estrito)   | **SIM** (Espectro Vocal / Ruído)                            | **SIM** (Aceita Teclado BLE)                                    |
| **Nintendo Switch**       | **SIM** (HTTPS estrito)   | **SIM** (Espectro Vocal / Ruído)                            | **SIM** (Aceita Teclado BLE)                                    |
| **Xbox (One / Series)**   | **SIM** (HTTPS estrito)   | **PARCIAL**                                                 | **NÃO** (Exige dongle físico USB / Sem antena genérica)         |

A tentativa de realizar comunicação usando a internet convencional foi descartada devido a barreiras lógicas e *firewalls* das *engines*. A arquitetura explora exclusivamente fendas no hardware físico.

---

## 2. O Roteador Físico: Como o Modem Híbrido Funciona

### A. O Downlink Acústico: Esteganografia Psicoacústica

O principal desafio da exfiltração de dados por áudio é sobreviver à física do som e aos algoritmos de compressão dos motores de jogos (como Opus ou Vorbis). Tentativas de usar frequências extremas enfrentam uma tripla barreira técnica:

1. **Filtros Passa-Baixa (Agudos Extremos > 14kHz):** Frequências ultrassônicas permitiriam alta largura de banda, mas os algoritmos dos jogos as deletam para poupar rede. Além disso, pela Lei de Nyquist-Shannon e pelo *roll-off* de alto-falantes de TVs comuns, o hardware físico falha em reproduzi-las. Somado a isso, frequências agudas são altamente direcionais, sendo facilmente bloqueadas se o jogador se mover ou cobrir o celular.
2. **Reverberação e Latência (Graves Extremos < 300Hz):** Frequências como 40Hz possuem ondas muito longas e causam reflexão severa no ambiente (eco). Para evitar a corrupção dos pacotes por interferência destrutiva, seria necessário um alto nível de *Forward Error Correction (FEC)*, o que derrubaria a largura de banda para níveis impraticáveis.

**A Solução: Bypass Psicoacústico na "Zona de Ouro"**
O protocolo **So-Fi** opera estritamente na faixa de frequência vocal humana ($1kHz - 4kHz$). Todo codec de áudio moderno é treinado para proteger essa faixa a qualquer custo. Os pacotes de dados são codificados como variações de timbre, fase e amplitude dentro de fonemas que lembram a voz humana ("gibberish" de NPCs) ou chiados estáticos de rádio comunicador. O jogador ouve uma "estática de *walkie-talkie*" imersiva, enquanto o celular interpreta vetores matemáticos puros.

**O Desafio Específico do Roblox (Soundbank Hexadecimal):**
Como o Roblox bloqueia a geração dinâmica de ondas sonoras via código (exigindo que todo áudio seja moderado e hospedado na nuvem via Asset ID), implementou-se um **Dicionário de Áudio Hexadecimal**.
1. São feitos uploads de 16 minúsculos fragmentos de áudio pré-aprovados (cliques ou chiados na faixa de 2kHz).
2. Cada Asset ID corresponde a um caractere hexadecimal (`0` a `F`, compondo 4 bits).
3. O script da engine toca 4 desses áudios em rápida sucessão espacial para montar um pacote de 16-bits.
4. O celular escuta, aplica a Transformada Rápida de Fourier (FFT) para identificar os espectros exatos e reconstrói o pacote com mínima necessidade de correção de erros.

### B. O Uplink Mecânico: Emulação de Teclado Bluetooth

A via de entrada no ecossistema isolado ocorre pela emulação do protocolo HID. O aplicativo escrito em Haxe no smartphone aciona as APIs nativas do Android para parear com a máquina hospedeira se passando por um teclado sem fio físico.

O pacote recebido da internet é convertido em injeções mecânicas. Para evitar que sistemas anti-trapaça a nível de *kernel* detectem automação (macros), o aplicativo injeta um ruído matemático não-determinístico (jitter) de milissegundos na duração de *keydown* e *keyup*, imitando imperfeições anatômicas humanas.

---

## 3. O Milagre dos 16 Bits e a Consistência Eventual

Devido à assimetria e restrições do meio físico, é matematicamente impossível transmitir vetores de estado 3D completos. A rede trafega unicamente intenções de *input* através de pacotes super comprimidos de 16-bits contendo: *Timestamp*, *ID do Ator* e *Ação*.

A arquitetura abandona o *Lockstep* rígido e adota o paradigma de **Consistência Eventual**. A máquina local de cada jogador é o servidor autoritativo do próprio universo. Jogadores remotos interagem na cena como "fantasmas lógicos" sem colisões físicas pesadas entre si. O atraso natural da rede é absorvido pelo *design* do jogo para manter a taxa de quadros (FPS) perfeitamente fluida.

---

## 4. O Desempenho Físico e Latência Global

Através de uma malha descentralizada (*Mesh*) utilizando WebRTC, os celulares roteadores se comunicam de forma P2P (Peer-to-Peer) baseada em determinismo (via código PIN). A performance atinge os seguintes parâmetros:

*   **Largura de Banda:** Menos de 1 Kilobyte por segundo por cliente. A alta densidade informacional do Dicionário de Áudio requer poucos toques por segundo.
*   **Tempo de Injeção Kine-Fi:** A propagação mecânica da tecla emulada via Bluetooth conclui a entrega no hospedeiro em $\approx 11$ milissegundos.
*   **Latência Física Total:** A equação temporal do fluxo de ponta a ponta: 
    $$Tempo\ Total = T_{Processamento\ FFT} + T_{Som\ Acústico} + T_{WebRTC\ Direto} + T_{Injeção\ Bluetooth}$$
    Isso resulta em uma latência global operando entre **30 a 45 milissegundos**, atraso este que é mascarado pela simulação assíncrona local.

---

## 5. Arquitetura Encapsulated Edge Input Swarm (EEIS)

A topologia unificada consolida-se sob três pilares:
1. **Hardware Proxy Mesh:** O smartphone atua puramente como modem conversor de protocolos físicos.
2. **Isolated Input Swarm:** Vetores compactos trafegando independentes da infraestrutura em nuvem das publicadoras dos jogos.
3. **Eventual Edge Sync:** As bordas da malha reproduzem simulações fluidas sob a premissa de que o estado global convergirá eventualmente.

---

## 6. Casos Não Cobertos pelo Framework

Cenários de falha *by design* que exigem intervenção externa:
*   **Ecossistema Xbox (One e Series):** Restrição severa de hardware. A Microsoft utiliza rádios proprietários e não inclui antenas Bluetooth padrão. Requer um dongle microcontrolador USB adicional (ex: ESP32) programado para simular o protocolo HID com fio.
*   **Smartphones de Tela Única (iOS/Android Rígido):** Limitações a nível de Sistema Operacional que suspendem captura de áudio ou execução de Bluetooth em segundo plano enquanto o jogo principal consome a tela, exigindo que o usuário possua um aparelho secundário para agir como nó roteador.

> [!info] Filtro Analítico de Rejeição de Ruído
> O aplicativo móvel no modo "Host" roda o processamento FFT em *background*. Ele é calibrado matematicamente para atuar como um *Noise Gate* seletivo: ignora perfeitamente conversas reais no cômodo, ruídos de rua ou aplicativos rodando no próprio celular do jogador, engatilhando a decodificação estritamente quando detecta as assinaturas acústicas do **Dicionário Hexadecimal** previamente estabelecido.