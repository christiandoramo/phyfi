# 🎵 PhyFi (Physical Fidelity)

<div align="center">
  <p><strong>Comunicação Acústica, WebRTC e Roteamento Bluetooth HID</strong></p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/Kotlin-0095D5?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
</div>

<br/>

## 📖 Visão Geral

O **PhyFi** é um ecossistema completo projetado para transmitir dados e comandos de controle através de sinais acústicos de áudio e conexões de baixa latência (WebRTC). O sistema permite que uma interface web emita comandos que são capturados, decodificados e roteados por um aplicativo Android. O Android, por sua vez, atua como um periférico **Bluetooth HID** (Human Interface Device), convertendo esses sinais em interações físicas (como toques de teclado, movimentos de mouse ou comandos de gamepad) para controlar outros hardwares.

## 🏗️ Arquitetura do Projeto

O projeto é dividido em três componentes principais:

### 1. 🌐 PhyFi App (`/phyfi_app`)
A aplicação cliente web interativa onde a magia visual e sonora acontece.
* **O que faz:** Contém uma simulação de arena (`ArenaCanvas`), gerencia bancos de sons baseados em fonemas (`PhonemeSoundbankModal`) e utiliza um modem acústico próprio (`sofiAcousticModem.ts`) para modular dados em sinais de áudio. Também suporta transporte de dados via WebRTC.
* **Tecnologias:** React, TypeScript, Vite, Bun, Tailwind CSS.

### 2. 📱 PhyFi Router (`/phyfi_router`)
O aplicativo Android que atua como a "ponte" entre o mundo do áudio/rede e o hardware.
* **O que faz:** Roda serviços em segundo plano (com WakeLocks) para capturar áudio do ambiente (`AudioCaptureManager`), decodifica o protocolo de 16-bits (`AudioDecoder`, `Protocol16Bit`), e traduz a intenção (`KineFiTranslator`) em comandos que são enviados via **Bluetooth HID** (`BluetoothHidManager`) para dispositivos pareados.
* **Tecnologias:** Android nativo, Kotlin, WebRTC Android.

### 3. 🔌 Servidor de Sinalização (`/ws`)
O microsserviço responsável por estabelecer a comunicação ponto a ponto (P2P).
* **O que faz:** Um servidor WebSocket simples e eficiente que realiza o handshake de sinalização WebRTC entre o `PhyFi App` (Frontend) e o `PhyFi Router` (Android).
* **Tecnologias:** Python 3, biblioteca `websockets`.

---

## 🚀 Como Executar

### Pré-requisitos
* [Bun](https://bun.sh/) (para o frontend)
* [Python 3.8+](https://www.python.org/) (para o servidor de sinalização)
* [Android Studio](https://developer.android.com/studio) (para o roteador Android)

### Passo 1: Iniciando o Servidor de Sinalização (WebSocket)
```bash
cd ws
pip install -r requirements.txt
python signaler.py
```

### Passo 2: Iniciando a Aplicação Web (Frontend)
```bash
cd phyfi_app
# Instalar dependências usando o Bun
bun install
# Iniciar o servidor de desenvolvimento
bun run dev
```
Acesse `http://localhost:5173` no seu navegador.

### Passo 3: Instalando o PhyFi Router (Android)
1. Abra a pasta `phyfi_router` no **Android Studio**.
2. Aguarde a sincronização do Gradle.
3. Conecte seu dispositivo Android (físico é recomendado para acesso real ao microfone e Bluetooth).
4. Clique em **Run** (`Shift + F10`) para instalar o app no seu dispositivo.
5. Conceda as permissões necessárias de **Microfone** e **Bluetooth** no aplicativo.

---

## 📂 Estrutura de Pastas Principal

```text
phyfi/
├── phyfi_app/                 # Frontend Web
│   ├── public/assets/         # Arquivos de áudio (.ogg fonemas) e documentação
│   ├── src/components/        # Componentes UI (React)
│   ├── src/protocol/          # Lógica do WebRTC, Modems Acústicos e Simulação
│   └── server.ts              # Ponto de entrada do servidor frontend
├── phyfi_router/              # App Android
│   ├── app/src/main/java/.../audio/     # Captura e decodificação de áudio
│   ├── app/src/main/java/.../bluetooth/ # Lógica de emulação Bluetooth HID
│   ├── app/src/main/java/.../network/   # Gerenciamento WebRTC cliente
│   ├── app/src/main/java/.../protocol/  # Parsing do payload 16-bits
│   └── app/src/main/java/.../service/   # Serviços em background do Android
└── ws/                        # Sinalizador WebRTC
    ├── requirements.txt       # Dependências Python
    └── signaler.py            # Servidor WebSocket
```

---

## 🔒 Permissões do Android
Para o correto funcionamento do **PhyFi Router**, as seguintes permissões são exigidas e gerenciadas pelo `PermissionManager.kt`:
* `RECORD_AUDIO`: Para capturar o áudio do ambiente e ler o protocolo sonoro.
* `BLUETOOTH` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE`: Para atuar como um dispositivo HID e se conectar a alvos externos.
* Serviços de Localização (em versões Android mais antigas, necessários para varredura Bluetooth).

---
*Criado com dedicação para redefinir as fronteiras da comunicação IoT.*
