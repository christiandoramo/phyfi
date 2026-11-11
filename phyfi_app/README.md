# Unwalled Gardens — Protótipo Completo do Protocolo de Rede Físico **Phy-Fi** (So-Fi + Kine-Fi + WebRTC P2P)

Este projeto implementa o protótipo completo e autônomo do **novo protocolo de rede física Phy-Fi (Physical-Fidelity)** integrado a um **jogo Multiplayer 2D determinístico em tempo real** (com movimentação `WASD` e limites estritos de mapa nos eixos `X` e `Y`), sem dependência de Steam ou Roblox.

---

## 1. Como o Novo Protocolo de Rede Funciona

O protocolo **Phy-Fi** estabelece uma malha P2P entre duas máquinas utilizando o meio físico acústico (**So-Fi**) e a emulação mecânica de teclado Bluetooth HID (**Kine-Fi**):

1. **Empacotamento Binário de 16 Bits (`Protocol16Bit`):**
   Cada mudança de intenção de movimento gera um pacote compacto de **16 bits (2 bytes / 4 nibbles hexadecimais)**:
   - `Bits 15..12 (4 bits)`: **ID do Ator** (`0x1` = Jogador 1 Host, `0x2` = Jogador 2 Client, `0xF` = Controle de Sessão).
   - `Bits 11..8 (4 bits)`: **Timestamp de Tick** (`0x0` a `0xF`, contador cíclico anti-atraso).
   - `Bits 7..0 (8 bits)`: **Bitmask de Intenção WASD + Ações** (`0x01`=W, `0x02`=S, `0x04`=A, `0x08`=D, `0x10`=Dash, `0x20`=Pulso, `0x80`=FIN/Encerramento Automático).

2. **Downlink Acústico Combinatório de Fonemas Humanos (`So-Fi`):**
   - O computador converte os 4 nibbles hexadecimais do pacote em uma sequência combinatória sobreposta de **6 fragmentos de áudio** da pasta `/phonemes/`:
     `[header.ogg] -> [p(n1).ogg] -> [p(n2).ogg] -> [p(n3).ogg] -> [p(n4).ogg] -> [tail.ogg]`
   - Opera estritamente na **Zona de Ouro Psicoacústica (1100 Hz a 3350 Hz, passo de 150 Hz)** combinada com os formantes vocais humanos (`F1` e `F2` de vogais e fricativas `/ɑː/`, `/ɛ/`, `/iː/`, `/ɔː/`, `/uː/`, `/ʃ/`, `/s/`, etc.).
   - Você pode fazer upload dos seus próprios arquivos `header.ogg`, `p0.ogg`..`p15.ogg` e `tail.ogg` diretamente na interface (botão **Fonemas (.ogg)**), ou usar o sintetizador vocal formante nativo já calibrado.

3. **Decodificação FFT no Celular em Segundo Plano & Ponte WebRTC P2P:**
   - O aplicativo do celular captura o som pelo microfone a **44.100 Hz** (com `WakeLock` e `ForegroundService` do tipo `mediaPlayback|microphone` no Android nativo para nunca suspender em segundo plano).
   - Aplica uma **Transformada Rápida de Fourier (FFT de 2048 amostras)** com *Noise Gate* seletivo: ignora ruídos graves (< 1 kHz) e agudos (> 4 kHz), extrai os 4 nibbles hexadecimais e transmite os **2 bytes** via `RTCDataChannel` UDP (`ordered: false, maxRetransmits: 0`) para o aparelho do outro jogador conectado no mesmo **PIN de 6 dígitos**.

4. **Uplink Mecânico Bluetooth HID (`Kine-Fi`):**
   - Ao receber o pacote de 16 bits da rede P2P, o celular injeta no PC um relatório padrão de teclado Bluetooth HID de 8 bytes utilizando o **Chord Obscuro**:
     `[0x01 (Left Ctrl), 0x00, 0x6A (F15), IntentByte, 0x00, 0x00, 0x00, 0x00]`
   - Inclui **Jitter Anatômico não-determinístico** (`5ms–22ms` no KeyDown, `30ms–80ms` de pressão e `5ms–22ms` no KeyUp) atualizando o estado determinístico da Arena 2D.

---

## 2. Como Rodar o Projeto

### Pré-requisitos
- **Node.js 20+** instalado nas máquinas.

### Comandos para Iniciar (Servidor + Signaler WebRTC + Jogo Web)
```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor Express + WebSocket Signaler + Frontend na porta 3000
npm run dev
```
Acesse no navegador: `http://localhost:3000` (ou a URL da rede local / nuvem exibida no terminal).

### Rodar os Testes Unitários Determinísticos
```bash
npx --yes tsx --test src/protocol/phyfiProtocol.test.ts
```

---

## 3. Instruções Passo a Passo por Aparelho (Jogador 1 e Jogador 2)

### O Que o JOGADOR 1 (Host) Deve Fazer:
1. **No Computador 1 (PC Host):**
   - Abra a aplicação no navegador.
   - Na tela inicial, selecione **Jogador 1 (Host · Azul)**.
   - Clique em **Gerar PIN** (ou anote o PIN de 6 dígitos exibido, ex.: `482910`) e clique em **INICIAR SESSÃO PHY-FI & ARENA 2D**.
   - Aumente o volume dos alto-falantes do Computador 1.
2. **No Celular 1 (Roteador Físico do Jogador 1):**
   - **Opção A (Web App Mobile Integrado):** Abra a mesma URL no navegador do Celular 1, digite o mesmo **PIN de 6 dígitos**, mude a chave no topo para **Roteador Mobile (App Celular)** e toque em **Ativar Microfone Real**.
   - **Opção B (APK Android Nativo com Bluetooth HID físico):** Compile e instale a pasta `phyfi_router` (`cd phyfi_router && ./gradlew assembleDebug`), pareie o Celular 1 via Bluetooth com o Computador 1 (ele aparecerá como teclado `PhyFi Kine-Fi Module`), digite o **PIN de 6 dígitos** e toque em **INICIAR ROTEAMENTO**.
   - Posicione o Celular 1 próximo à saída de som do Computador 1.
3. **Jogando no Computador 1:**
   - Use as teclas **`W`, `A`, `S`, `D`** para mover o Jogador 1 dentro dos limites `X` e `Y` da Arena 2D, **`Espaço`** para Dash e **`E`** para emitir um Pulso Acústico coletor.

---

### O Que o JOGADOR 2 (Client) Deve Fazer:
1. **No Computador 2 (PC Client):**
   - Abra a URL da aplicação no Computador 2 (ou em uma segunda janela/aba para teste rápido na mesma máquina).
   - Selecione **Jogador 2 (Client · Âmbar)**.
   - Digite exatamente o **mesmo PIN de 6 dígitos** criado pelo Jogador 1 e clique em **INICIAR SESSÃO PHY-FI & ARENA 2D**.
2. **No Celular 2 (Roteador Físico do Jogador 2):**
   - Conecte o Celular 2 como Teclado Bluetooth HID no Computador 2 (ou use o **Modo Roteador Mobile** no navegador do celular), digite o mesmo **PIN de 6 dígitos** e ative a escuta do microfone.
3. **Jogando no Computador 2:**
   - Assim que o indicador no topo mostrar **`WEBRTC P2P: ONLINE`**, pressione **`W`, `A`, `S`, `D`** (ou as **Setas Direcionais** no modo de teste duplo).
   - Os dois jogadores se verão movendo em tempo real com colisão nos limites `X [26..934]` e `Y [26..514]` e obstáculos da arena!

---

## 4. Conexão Inicial e Encerramento Automático (Graceful Teardown)

- **Conexão Inicial (Handshake):** Ao inserir o PIN de 6 dígitos e iniciar, o `PhyFiTransportManager` conecta ao WebSocket Signaler (`/ws-signaler`), anuncia o slot do jogador (`J1` ou `J2`), negocia automaticamente o `SDP Offer/Answer` + candidatos `ICE STUN` e abre o canal binário `phyfi_udp_channel`.
- **Encerramento Automático:** Quando qualquer jogador clica no botão **Encerrar (FIN)** no topo (ou fecha a aba/aplicativo), o sistema transmite imediatamente o pacote de controle de 16 bits **`0xF080` (`Actor=0xF, Intent=0x80 FIN_CLOSE`)**, encerra a captura do microfone, libera o `WakeLock`, desregistra o perfil Bluetooth HID e fecha a sala para ambos os lados sem deixar processos órfãos.
