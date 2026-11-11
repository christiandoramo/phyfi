/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  pack16Bit,
  unpack16Bit,
  encodePacketToPhonemeSequence,
  buildKineFiHidReport,
  encodeKeysToIntent,
  decodeIntentToKeys,
  PhyFiPayload,
  PhonemeSpec,
  KineFiHidReport,
  PHONEME_DICTIONARY,
} from './protocol/phyfiProtocol';
import {
  createInitialArenaState,
  applyPlayerIntent,
  stepArenaSimulation,
  ArenaGameState,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from './protocol/arenaSimulation';
import { SoFiAcousticModem, SpectrumSnapshot } from './protocol/sofiAcousticModem';
import { PhyFiTransportManager } from './protocol/webrtcTransport';
import { ArenaCanvas } from './components/ArenaCanvas';
import { PhonemeSoundbankModal } from './components/PhonemeSoundbankModal';
import { DocumentationModal } from './components/DocumentationModal';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Bluetooth,
  Radio,
  BookOpen,
  Power,
  Play,
  RotateCcw,
  Sliders,
  Smartphone,
  Monitor,
  Activity,
} from 'lucide-react';

type ScreenState = 'title' | 'playing' | 'paused' | 'gameover';
type OperatingMode = 'pc_arena' | 'mobile_router';

interface PacketLogEntry {
  id: number;
  timeStr: string;
  direction: 'TX-SOFI' | 'RX-WEBRTC' | 'KINEFI-HID' | 'MIC-FFT';
  payload: PhyFiPayload;
  phonemes: string[];
  hidReport: KineFiHidReport;
  transport: string;
}

export default function App() {
  // Check URL params for ?autostart=1 or ?pin=... or ?slot=2
  const initialParams = new URLSearchParams(window.location.search);
  const autoStartParam = initialParams.get('autostart') === '1';
  const pinParam = initialParams.get('pin') || '482910';
  const slotParam: 1 | 2 = initialParams.get('slot') === '2' ? 2 : 1;

  const [screenState, setScreenState] = useState<ScreenState>(autoStartParam ? 'playing' : 'title');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('pc_arena');
  const [roomPin, setRoomPin] = useState<string>(pinParam);
  const [pinInputDraft, setPinInputDraft] = useState<string>(pinParam);
  const [localPlayerSlot, setLocalPlayerSlot] = useState<1 | 2>(slotParam);
  const [dualKeyboardMode, setDualKeyboardMode] = useState<boolean>(true);

  // Modals
  const [isSoundbankOpen, setIsSoundbankOpen] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Audio & Transport State
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [transportStatus, setTransportStatus] = useState({
    signalerConnected: false,
    webrtcConnected: false,
    bluetoothHidReady: true,
    peerCount: 1,
    latencyMs: 12,
  });

  // Live Telemetry & Packet Inspection State
  const [lastTxSequence, setLastTxSequence] = useState<PhonemeSpec[]>([]);
  const [lastHidReport, setLastHidReport] = useState<KineFiHidReport>(() =>
    buildKineFiHidReport(0, 1)
  );
  const [packetLogs, setPacketLogs] = useState<PacketLogEntry[]>([]);
  const [routerLogs, setRouterLogs] = useState<string[]>([
    'Roteador Físico Phy-Fi inicializado.',
    'Kine-Fi Bluetooth HID SDP Registrado (LCtrl 0x01 + F15 0x6A).',
    'So-Fi Dicionário de 16 Fonemas (1100Hz - 3350Hz) carregado.',
  ]);
  const [spectrum, setSpectrum] = useState<SpectrumSnapshot>({
    bins: new Float32Array(32),
    dominantFreqHz: 0,
    dominantAmplitude: 0,
    detectedPhonemeId: null,
    accumulatedNibbles: [],
    isMicActive: false,
  });

  // HUD Snapshot of Players (updated at 15Hz for clean React rendering without 60Hz re-renders)
  const [hudSnapshot, setHudSnapshot] = useState(() => {
    const init = createInitialArenaState();
    return {
      tick: 0,
      p1: { ...init.players[1] },
      p2: { ...init.players[2] },
    };
  });

  // Mutable Refs for 60Hz deterministic game loop & hardware managers
  const gameStateRef = useRef<ArenaGameState>(createInitialArenaState());
  const modemRef = useRef<SoFiAcousticModem | null>(null);
  const transportRef = useRef<PhyFiTransportManager | null>(null);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const lastSentIntentP1Ref = useRef<number>(0);
  const lastSentIntentP2Ref = useRef<number>(0);
  const rollingTickRef = useRef<number>(0);
  const logCounterRef = useRef<number>(1);

  if (!modemRef.current) {
    modemRef.current = new SoFiAcousticModem();
  }

  // Mirror screenState to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  const appendRouterLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setRouterLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 34)]);
  }, []);

  const recordPacketEvent = useCallback(
    (
      direction: PacketLogEntry['direction'],
      payload: PhyFiPayload,
      transport: string
    ) => {
      const seq = encodePacketToPhonemeSequence(
        payload.actorId,
        payload.timestamp,
        payload.intent
      );
      const hid = buildKineFiHidReport(payload.intent, payload.timestamp);

      // Keep the last non-zero action displayed in the Phoneme & HID cards so keyup (0x00) doesn't overwrite it
      if (payload.intent !== 0 || lastTxSequence.length === 0) {
        setLastTxSequence(seq);
        setLastHidReport(hid);
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour12: false });
      const id = logCounterRef.current++;

      setPacketLogs((prev) => [
        {
          id,
          timeStr,
          direction,
          payload,
          phonemes: seq.map((s) => `${s.id}.ogg`),
          hidReport: hid,
          transport,
        },
        ...prev.slice(0, 14),
      ]);
    },
    [lastTxSequence.length]
  );

  /**
   * Injects a decoded 16-bit Phy-Fi payload into the deterministic arena state via Kine-Fi HID translation.
   */
  const injectPayloadIntoArena = useCallback(
    (
      payload: PhyFiPayload,
      direction: PacketLogEntry['direction'],
      transportLabel: string
    ) => {
      const targetSlot: 1 | 2 = payload.actorId === 2 ? 2 : 1;
      applyPlayerIntent(
        gameStateRef.current,
        targetSlot,
        payload.intent,
        payload.timestamp,
        Date.now()
      );
      recordPacketEvent(direction, payload, transportLabel);
    },
    [recordPacketEvent]
  );

  // Wire So-Fi Acoustic Modem decoded callback
  useEffect(() => {
    const modem = modemRef.current;
    if (!modem) return;

    modem.setOnPayloadDecoded((payload, source) => {
      if (source === 'mic') {
        appendRouterLog(
          `FFT Mic Decodificou Pacote 0x${payload.hex} (Ator J${payload.actorId}, Intent 0x${payload.intent
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')})`
        );
        transportRef.current?.send16BitPacket(payload.raw);
        injectPayloadIntoArena(payload, 'MIC-FFT', 'So-Fi Mic -> WebRTC');
      }
    });
  }, [appendRouterLog, injectPayloadIntoArena]);

  // Connect / Reconnect WebRTC & WebSocket Transport when entering 'playing'
  const startSessionWithPin = useCallback(
    (targetPin: string, slot: 1 | 2) => {
      const cleanPin = targetPin.replace(/\D/g, '').slice(0, 6).padEnd(6, '0');
      setRoomPin(cleanPin);
      setPinInputDraft(cleanPin);
      setLocalPlayerSlot(slot);

      transportRef.current?.shutdown('Troca de sala');

      const manager = new PhyFiTransportManager(cleanPin, slot === 1, slot, {
        onStatusChange: (st) => setTransportStatus(st),
        onPacketReceived: (payload, via) => {
          injectPayloadIntoArena(payload, 'RX-WEBRTC', `${via} -> Kine-Fi HID`);
        },
        onLog: (msg) => appendRouterLog(msg),
        onRoomTerminated: (reason) => {
          appendRouterLog(`ENCERRAMENTO AUTOMÁTICO: ${reason}`);
          setIsMicListening(false);
          modemRef.current?.stopMicrophoneCapture();
          setScreenState('gameover');
        },
      });

      manager.connect();
      transportRef.current = manager;
      setScreenState('playing');
    },
    [appendRouterLog, injectPayloadIntoArena]
  );

  // Auto-connect if ?autostart=1 was passed
  useEffect(() => {
    if (autoStartParam && !transportRef.current) {
      startSessionWithPin(roomPin, localPlayerSlot);
    }
    return () => {
      transportRef.current?.shutdown('Desmontagem de componente');
    };
  }, [autoStartParam, localPlayerSlot, roomPin, startSessionWithPin]);

  /**
   * Dispatches a local player intent through the full Phy-Fi pipeline:
   * 1. Encodes 16-bit packet [ActorID (4b) | Tick (4b) | Intent (8b)]
   * 2. Emits combinatorial overlapped human phoneme sequence (`header.ogg` + 4x `p0..p15.ogg` + `tail.ogg`)
   * 3. Transmits 2-byte frame over WebRTC UDP DataChannel / Signaler Relay
   * 4. Translates via Kine-Fi Bluetooth HID chord (`LCtrl + F15 + Intent`) into deterministic 2D Arena
   */
  const dispatchLocalPhyFiIntent = useCallback(
    (playerSlot: 1 | 2, intentByte: number) => {
      rollingTickRef.current = (rollingTickRef.current + 1) & 0x0f;
      const tickNibble = rollingTickRef.current;
      const raw = pack16Bit(playerSlot, tickNibble, intentByte);
      const unpacked = unpack16Bit(raw);

      gameStateRef.current.players[playerSlot].packetsSent += 1;

      // 1. Emit acoustic wave via So-Fi Phoneme Synthesizer / Soundbank
      if (intentByte !== 0) {
        modemRef.current?.transmitPacketAcoustically(playerSlot, tickNibble, intentByte, false);
      }

      // 2. Transmit 2-byte frame over WebRTC P2P / Signaler
      transportRef.current?.send16BitPacket(raw);

      // 3. Apply Kine-Fi HID update deterministically
      injectPayloadIntoArena(unpacked, 'TX-SOFI', 'So-Fi Acústico -> WebRTC -> Kine-Fi HID');
    },
    [injectPayloadIntoArena]
  );

  // Keyboard Listeners (WASD for local player + Arrow keys for Player 2 in Dual Mode + Title/Pause shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (screenState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startSessionWithPin(pinInputDraft, localPlayerSlot);
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (screenState === 'playing') {
          setScreenState('paused');
          keysPressedRef.current.clear();
          return;
        } else if (screenState === 'paused') {
          setScreenState('playing');
          return;
        }
      }

      if (screenState !== 'playing') return;

      const code = e.code;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'Space',
          'KeyE',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftRight',
          'Enter',
        ].includes(code)
      ) {
        e.preventDefault();
      }

      keysPressedRef.current.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    const handleBlur = () => {
      keysPressedRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [localPlayerSlot, pinInputDraft, screenState, startSessionWithPin]);

  // Deterministic 60Hz Simulation & 20Hz Network Tick Loop
  useEffect(() => {
    let lastTime = performance.now();
    let hudTimer = 0;
    let inputTickTimer = 0;
    let animId = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      if (screenState === 'playing') {
        // Sample keyboard state at 20Hz (every 50ms) and dispatch Phy-Fi 16-bit packets on intent changes
        inputTickTimer += rawDt;
        if (inputTickTimer >= 0.05) {
          inputTickTimer = 0;
          const keys = keysPressedRef.current;

          const primaryIntent = encodeKeysToIntent({
            w: keys.has('KeyW') || (!dualKeyboardMode && keys.has('ArrowUp')),
            s: keys.has('KeyS') || (!dualKeyboardMode && keys.has('ArrowDown')),
            a: keys.has('KeyA') || (!dualKeyboardMode && keys.has('ArrowLeft')),
            d: keys.has('KeyD') || (!dualKeyboardMode && keys.has('ArrowRight')),
            dash: keys.has('Space'),
            pulse: keys.has('KeyE'),
          });

          if (localPlayerSlot === 1) {
            if (primaryIntent !== lastSentIntentP1Ref.current) {
              lastSentIntentP1Ref.current = primaryIntent;
              dispatchLocalPhyFiIntent(1, primaryIntent);
            }
          } else {
            if (primaryIntent !== lastSentIntentP2Ref.current) {
              lastSentIntentP2Ref.current = primaryIntent;
              dispatchLocalPhyFiIntent(2, primaryIntent);
            }
          }

          // In Dual-Node Test Mode, Arrow Keys drive the second player directly through Phy-Fi packets
          if (dualKeyboardMode) {
            const secondarySlot: 1 | 2 = localPlayerSlot === 1 ? 2 : 1;
            const secondaryIntent = encodeKeysToIntent({
              w: keys.has('ArrowUp'),
              s: keys.has('ArrowDown'),
              a: keys.has('ArrowLeft'),
              d: keys.has('ArrowRight'),
              dash: keys.has('ShiftRight'),
              pulse: keys.has('Enter'),
            });
            const lastRef =
              secondarySlot === 2 ? lastSentIntentP2Ref : lastSentIntentP1Ref;
            if (secondaryIntent !== lastRef.current) {
              lastRef.current = secondaryIntent;
              dispatchLocalPhyFiIntent(secondarySlot, secondaryIntent);
            }
          }
        }

        // Advance 2D Arena Physics
        stepArenaSimulation(gameStateRef.current, rawDt);

        // Update HUD & FFT Spectrum at ~15Hz
        hudTimer += rawDt;
        if (hudTimer >= 0.066) {
          hudTimer = 0;
          const st = gameStateRef.current;
          setHudSnapshot({
            tick: st.tick,
            p1: { ...st.players[1] },
            p2: { ...st.players[2] },
          });
          if (modemRef.current) {
            setSpectrum(modemRef.current.sampleSpectrum());
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [dispatchLocalPhyFiIntent, dualKeyboardMode, localPlayerSlot, screenState]);

  const handleToggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const next = !isMuted;
    setIsMuted(next);
    modemRef.current?.setMuted(next);
  };

  const handleToggleMic = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    if (!modemRef.current) return;
    if (isMicListening) {
      modemRef.current.stopMicrophoneCapture();
      setIsMicListening(false);
      appendRouterLog('Microfone So-Fi desativado.');
    } else {
      const ok = await modemRef.current.startMicrophoneCapture();
      setIsMicListening(ok);
      if (ok) {
        appendRouterLog('Microfone So-Fi ATIVO (44.1kHz, FFT 2048, Noise Gate 1kHz-4kHz).');
      } else {
        appendRouterLog('Permissão de microfone negada ou indisponível; usando Loopback Acústico Interno.');
      }
    }
  };

  const handleResetArena = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.currentTarget.blur();
    gameStateRef.current = createInitialArenaState();
    lastSentIntentP1Ref.current = 0;
    lastSentIntentP2Ref.current = 0;
    keysPressedRef.current.clear();
    setHudSnapshot({
      tick: 0,
      p1: { ...gameStateRef.current.players[1] },
      p2: { ...gameStateRef.current.players[2] },
    });
    appendRouterLog('Estado determinístico da Arena 2D reiniciado.');
  };

  const handleGracefulShutdown = () => {
    keysPressedRef.current.clear();
    modemRef.current?.stopMicrophoneCapture();
    setIsMicListening(false);
    transportRef.current?.shutdown('Encerramento automático solicitado pelo operador');
    transportRef.current = null;
    setScreenState('gameover');
  };

  const handleGenerateNewPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPinInputDraft(randomPin);
    setRoomPin(randomPin);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#07090E] text-slate-100 flex flex-col select-none">
      {/* =====================================================================
          TITLE / HANDSHAKE OVERLAY SCREEN
         ===================================================================== */}
      {screenState === 'title' && (
        <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
          <div className="w-full max-w-4xl border border-slate-800 bg-[#0B0E17] p-8 shadow-2xl">
            {/* Custom Inline SVG Emblem & Title Lockup */}
            <div className="flex flex-col items-start justify-between gap-6 border-b border-slate-800 pb-6 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <svg
                  viewBox="0 0 64 64"
                  className="h-14 w-14 shrink-0 border border-cyan-500/40 bg-[#07090E] p-2"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="56" height="56" fill="none" stroke="#1E293B" strokeWidth="2" />
                  <path
                    d="M10 32 Q 18 12, 26 32 T 42 32 T 54 32"
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="3"
                  />
                  <path
                    d="M10 38 Q 20 50, 30 26 T 54 36"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                  <circle cx="18" cy="22" r="3" fill="#06B6D4" />
                  <circle cx="46" cy="42" r="3" fill="#F59E0B" />
                </svg>
                <div>
                  <div className="font-mono text-xs tracking-widest text-cyan-400">
                    UNWALLED GARDENS · PHY-FI 16-BIT NETWORK PROTOCOL
                  </div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    PHY-FI ARENA & MODEM ACÚSTICO-MECÂNICO P2P
                  </h1>
                  <p className="mt-1 text-xs text-slate-400">
                    So-Fi (Sequenciamento Combinatório de 16 Fonemas Humanos 1.1–3.35 kHz) · WebRTC UDP · Kine-Fi (Teclado Bluetooth HID)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDocsOpen(true)}
                  className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500 hover:text-white whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                  Manual J1 & J2 (README)
                </button>
                <button
                  type="button"
                  onClick={() => setIsSoundbankOpen(true)}
                  className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-amber-500 hover:text-white whitespace-nowrap"
                >
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  Fonemas (18 .ogg)
                </button>
              </div>
            </div>

            {/* Connection & Role Handshake Grid */}
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Left: Player Role & Room PIN */}
              <div className="space-y-4 border border-slate-800 bg-[#111827]/60 p-5">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
                  01. Configurar Nó & PIN de Pareamento WebRTC
                </h2>

                <div>
                  <label className="block text-xs font-medium text-slate-400">
                    Papel desta Máquina na Topologia P2P
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalPlayerSlot(1)}
                      className={`border px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        localPlayerSlot === 1
                          ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-800 bg-[#07090E] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Jogador 1 (Host · Azul)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalPlayerSlot(2)}
                      className={`border px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        localPlayerSlot === 2
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-[#07090E] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Jogador 2 (Client · Âmbar)
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="room-pin-input"
                    className="block text-xs font-medium text-slate-400"
                  >
                    PIN Determinístico da Sala (6 Dígitos — Mesmo no PC e no Celular)
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="room-pin-input"
                      type="text"
                      maxLength={6}
                      value={pinInputDraft}
                      onChange={(e) => setPinInputDraft(e.target.value.replace(/\D/g, ''))}
                      className="w-full border border-slate-700 bg-[#07090E] px-3.5 py-2 font-mono text-base font-bold tracking-widest text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="482910"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateNewPin}
                      className="border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                    >
                      Gerar PIN
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={dualKeyboardMode}
                      onChange={(e) => setDualKeyboardMode(e.target.checked)}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    <span>
                      Habilitar Teste Simultâneo (WASD move Jogador 1 · Setas movem Jogador 2)
                    </span>
                  </label>
                </div>
              </div>

              {/* Right: Architecture Summary & Launch */}
              <div className="flex flex-col justify-between border border-slate-800 bg-[#111827]/60 p-5">
                <div className="space-y-3">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
                    02. Ciclo Físico de 16 Bits (Sem Steam / Sem Roblox)
                  </h2>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li>
                      <strong className="text-cyan-400">Downlink Acústico So-Fi:</strong> Cada input gera 4 nibbles hexadecimais
                      codificados por sobreposição combinatória de formantes vocais (<code className="text-slate-200">header.ogg</code> +{' '}
                      <code className="text-slate-200">p0..p15.ogg</code> + <code className="text-slate-200">tail.ogg</code>).
                    </li>
                    <li>
                      <strong className="text-amber-400">Ponte Mobile FFT + WebRTC:</strong> O celular escuta em 44.1kHz (mesmo em 2º plano),
                      extrai a frequência dominante via FFT de 2048 pontos e transmite 2 bytes puros via WebRTC UDP.
                    </li>
                    <li>
                      <strong className="text-emerald-400">Uplink Bluetooth HID Kine-Fi:</strong> O celular injeta o Chord Obscuro{' '}
                      <code className="text-slate-200">LCtrl + F15 + Intent</code> com jitter anatômico (5–22ms) movendo os jogadores na Arena X/Y.
                    </li>
                  </ul>
                </div>

                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startSessionWithPin(pinInputDraft, localPlayerSlot)}
                    className="flex w-full items-center justify-center gap-2 bg-cyan-500 px-4 py-3 font-display text-xs sm:text-sm font-bold tracking-wide text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap"
                  >
                    <Play className="h-4 w-4 shrink-0 fill-current" />
                    <span>INICIAR ARENA PHY-FI (PIN {pinInputDraft.padEnd(6, '0')})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Flat borderless control hint in bottom safe margin */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center font-mono text-xs text-slate-400">
              WASD Mover Jogador 1 · Setas Mover Jogador 2 · Espaço Dash · E Pulso Acústico · P Pausar
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          PLAYING STATE: TOP TELEMETRY RIBBON + ASYMMETRIC CONSOLE + ARENA 2D
         ===================================================================== */}
      {screenState !== 'title' && (
        <>
          {/* Top Telemetry Ribbon */}
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0B0E17] px-4 py-2">
            <div className="flex items-center gap-4">
              <span className="font-display text-sm font-bold tracking-wider text-white whitespace-nowrap">
                PHY-FI PROTOCOL v1.0
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono text-xs text-cyan-400 whitespace-nowrap">
                PIN SALA: <strong>{roomPin}</strong>
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono text-xs text-slate-300 whitespace-nowrap">
                WEBRTC P2P:{' '}
                <strong className={transportStatus.webrtcConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {transportStatus.webrtcConnected ? 'ONLINE (UDP 0-RET)' : 'AGUARDANDO PAR / LOOPBACK'}
                </strong>
              </span>
              <span className="text-slate-600 hidden lg:inline" aria-hidden="true">·</span>
              <span className="font-mono text-xs text-slate-300 hidden lg:inline whitespace-nowrap">
                KINE-FI HID: <strong className="text-emerald-400">SDP ATIVO ({transportStatus.latencyMs} ms)</strong>
              </span>
            </div>

            {/* Mode Switcher & Utility Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-800 bg-[#07090E] p-0.5">
                <button
                  type="button"
                  onClick={() => setOperatingMode('pc_arena')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    operatingMode === 'pc_arena'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Arena 2D (PC Host/Client)
                </button>
                <button
                  type="button"
                  onClick={() => setOperatingMode('mobile_router')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    operatingMode === 'mobile_router'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Roteador Mobile (App Celular)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSoundbankOpen(true)}
                className="border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500 whitespace-nowrap"
              >
                Fonemas (.ogg)
              </button>

              <button
                type="button"
                onClick={() => setIsDocsOpen(true)}
                className="border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500 whitespace-nowrap"
              >
                README
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={handleToggleMic}
                aria-label={isMicListening ? 'Desativar Microfone FFT' : 'Ativar Microfone FFT'}
                className={`flex h-7 w-7 items-center justify-center border ${
                  isMicListening
                    ? 'border-emerald-500 bg-emerald-950/50 text-emerald-400'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {isMicListening ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Ativar Som So-Fi' : 'Silenciar Som So-Fi'}
                className="flex h-7 w-7 items-center justify-center border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-400" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={handleResetArena}
                aria-label="Reiniciar Arena"
                className="flex h-7 w-7 items-center justify-center border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleGracefulShutdown}
                className="flex items-center gap-1 border border-rose-500/50 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-900/50 whitespace-nowrap"
              >
                <Power className="h-3.5 w-3.5" />
                Encerrar (FIN)
              </button>
            </div>
          </header>

          {/* Main Workspace Stage */}
          {operatingMode === 'pc_arena' ? (
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
              {/* Left Control & Protocol Telemetry Column (360px on desktop) */}
              <aside className="w-full lg:w-[370px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0B0E17] p-3.5 flex flex-col gap-3 overflow-y-auto">
                {/* Active Node & Player Controls */}
                <div className="border border-slate-800 bg-[#111827]/70 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      CONTROLE DE NÓ E INJEÇÃO
                    </span>
                    <span className="font-mono text-xs text-cyan-400">
                      TICK #{hudSnapshot.tick}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalPlayerSlot(1)}
                      className={`border px-2.5 py-1.5 font-mono text-xs font-semibold whitespace-nowrap ${
                        localPlayerSlot === 1
                          ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-800 bg-[#07090E] text-slate-400'
                      }`}
                    >
                      Controlar J1 (WASD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalPlayerSlot(2)}
                      className={`border px-2.5 py-1.5 font-mono text-xs font-semibold whitespace-nowrap ${
                        localPlayerSlot === 2
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-[#07090E] text-slate-400'
                      }`}
                    >
                      Controlar J2 (WASD)
                    </button>
                  </div>

                  {/* Quick Tactile Kine-Fi Injection Pad for mouse/mobile testing */}
                  <div className="pt-0.5">
                    <div className="mb-1.5 font-mono text-[11px] text-slate-400">
                      Injetor Rápido de Pacotes 16-Bits (Simulador Kine-Fi HID + So-Fi):
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x10)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-cyan-300 hover:border-cyan-500"
                      >
                        DASH (0x10)
                      </button>
                      <button
                        type="button"
                        onMouseDown={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x01)}
                        onMouseUp={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x00)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-white hover:border-cyan-500"
                      >
                        W · CIMA (0x01)
                      </button>
                      <button
                        type="button"
                        onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x20)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-amber-300 hover:border-amber-500"
                      >
                        PULSO (0x20)
                      </button>
                      <button
                        type="button"
                        onMouseDown={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x04)}
                        onMouseUp={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x00)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-white hover:border-cyan-500"
                      >
                        A · ESQ (0x04)
                      </button>
                      <button
                        type="button"
                        onMouseDown={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x02)}
                        onMouseUp={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x00)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-white hover:border-cyan-500"
                      >
                        S · BAIXO (0x02)
                      </button>
                      <button
                        type="button"
                        onMouseDown={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x08)}
                        onMouseUp={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x00)}
                        className="border border-slate-700 bg-[#07090E] py-1.5 text-white hover:border-cyan-500"
                      >
                        D · DIR (0x08)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live So-Fi Acoustic FFT Spectrograph (1kHz - 4kHz Golden Zone) */}
                <div className="border border-slate-800 bg-[#111827]/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      ESPECTRO FFT SO-FI (1.0 – 3.5 kHz)
                    </span>
                    <span className="font-mono text-xs text-cyan-400">
                      {spectrum.dominantFreqHz > 0 ? `${spectrum.dominantFreqHz} Hz` : 'GATE IDLE'}
                    </span>
                  </div>

                  {/* 32-Bar Spectrograph */}
                  <div className="flex h-12 items-end gap-0.5 border border-slate-800 bg-[#07090E] p-1">
                    {Array.from({ length: 32 }).map((_, idx) => {
                      const val = spectrum.bins[idx] || 0;
                      const heightPct = Math.max(10, Math.round(val * 100));
                      return (
                        <div
                          key={idx}
                          className="flex-1 bg-cyan-500/80 transition-all duration-75"
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>

                  {/* Sequenced Phoneme Frame Inspector */}
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-slate-400">
                      Última Rajada Combinatória de Fonemas (6 Slots · 44ms):
                    </div>
                    <div className="grid grid-cols-6 gap-1 font-mono text-[10px]">
                      {(lastTxSequence.length === 6
                        ? lastTxSequence
                        : encodePacketToPhonemeSequence(1, 0, 0)
                      ).map((spec, i) => (
                        <div
                          key={i}
                          className="border border-slate-800 bg-[#07090E] px-1 py-1 text-center"
                        >
                          <div className="font-bold text-cyan-400">{spec.id}</div>
                          <div className="text-slate-400">{spec.ipa}</div>
                          <div className="text-[9px] text-slate-500">{spec.fundamentalHz}Hz</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Kine-Fi Bluetooth HID Report Inspector */}
                <div className="border border-slate-800 bg-[#111827]/70 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      RELATÓRIO BLUETOOTH HID (KINE-FI)
                    </span>
                    <Bluetooth className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="border border-slate-800 bg-[#07090E] p-2 font-mono text-xs">
                    <div className="text-amber-400 font-semibold">{lastHidReport.chordLabel}</div>
                    <div className="mt-1 text-[11px] text-slate-300">
                      RAW 8B: <span className="text-cyan-300">[{lastHidReport.hexBytes}]</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      Jitter Anatômico: Down {lastHidReport.downJitterMs}ms · Hold{' '}
                      {lastHidReport.pressDurationMs}ms · Up {lastHidReport.upJitterMs}ms
                    </div>
                  </div>
                </div>

                {/* Live 16-Bit Packet Stream */}
                <div className="border border-slate-800 bg-[#111827]/70 p-3 flex-1 flex flex-col min-h-[130px]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                      TRÁFEGO DE PACOTES 16-BITS
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {packetLogs.length} eventos
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto font-mono text-[11px]">
                    {packetLogs.length === 0 ? (
                      <div className="text-slate-500 py-3 text-center">
                        Pressione WASD ou Setas para emitir ondas sonoras de fonemas e pacotes 16-bits.
                      </div>
                    ) : (
                      packetLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className="border border-slate-800/90 bg-[#07090E] px-2.5 py-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-400">
                              0x{entry.payload.hex} (J{entry.payload.actorId})
                            </span>
                            <span className="text-slate-400">{entry.direction}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            Fonemas: {entry.phonemes.join(' > ')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>

              {/* Center Stage: Deterministic 2D Arena with X/Y Boundaries + Perimeter HUD */}
              <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-4 overflow-hidden bg-[#07090E]">
                {/* Top Perimeter Player Telemetry Strip */}
                <div className="w-full max-w-[960px] shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5">
                  {/* Player 1 Card */}
                  <div className="flex items-center justify-between border border-slate-800 bg-[#0B0E17] px-4 py-2">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-400">
                        JOGADOR 1 (HOST · WASD)
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-300">
                        Pos X: <strong>{hudSnapshot.p1.x.toFixed(0)}</strong> · Pos Y:{' '}
                        <strong>{hudSnapshot.p1.y.toFixed(0)}</strong> · Teclas:{' '}
                        <span className="text-cyan-300">
                          {decodeIntentToKeys(hudSnapshot.p1.intent).join('+') || 'IDLE'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-2xl font-bold text-white tabular-nums">
                        {hudSnapshot.p1.score}
                      </div>
                      <div className="text-[10px] uppercase text-slate-400">
                        PONTOS · {hudSnapshot.p1.packetsReceived} PKTS
                      </div>
                    </div>
                  </div>

                  {/* Player 2 Card */}
                  <div className="flex items-center justify-between border border-slate-800 bg-[#0B0E17] px-4 py-2">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-amber-400">
                        JOGADOR 2 (CLIENT · SETAS / REMOTO)
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-300">
                        Pos X: <strong>{hudSnapshot.p2.x.toFixed(0)}</strong> · Pos Y:{' '}
                        <strong>{hudSnapshot.p2.y.toFixed(0)}</strong> · Teclas:{' '}
                        <span className="text-amber-300">
                          {decodeIntentToKeys(hudSnapshot.p2.intent).join('+') || 'IDLE'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-2xl font-bold text-white tabular-nums">
                        {hudSnapshot.p2.score}
                      </div>
                      <div className="text-[10px] uppercase text-slate-400">
                        PONTOS · {hudSnapshot.p2.packetsReceived} PKTS
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2D Bounded Arena Canvas */}
                <ArenaCanvas
                  gameStateRef={gameStateRef}
                  localPlayerSlot={localPlayerSlot}
                  dualTestMode={dualKeyboardMode}
                />

                {/* Bottom Perimeter Status & Bounds Bar */}
                <div className="w-full max-w-[960px] shrink-0 mt-2.5 flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-[#0B0E17] px-4 py-2 font-mono text-xs text-slate-400">
                  <div>
                    LIMITES DO MAPA: <strong className="text-slate-200">X [26 .. {ARENA_WIDTH - 26}] · Y [26 .. {ARENA_HEIGHT - 26}]</strong>
                  </div>
                  <div>
                    CONTROLES: <strong className="text-slate-200">WASD (J1) · Setas (J2) · Espaço (Dash) · E (Pulso) · P (Pausa)</strong>
                  </div>
                </div>
              </main>
            </div>
          ) : (
            /* =================================================================
               MOBILE ROUTER MODE (Simulates/Operates the Smartphone Bridge App)
               ================================================================= */
            <main className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
              <div className="w-full max-w-2xl border border-slate-800 bg-[#0B0E17] p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="font-mono text-xs text-amber-400">
                      MODO SMARTPHONE · PHY-FI ROUTER (BACKGROUND WAKE-LOCK & MIC)
                    </div>
                    <h2 className="font-display text-xl font-bold text-white">
                      ROTEADOR FÍSICO ACÚSTICO & BLUETOOTH HID
                    </h2>
                  </div>
                  <Activity className="h-6 w-6 text-amber-400" />
                </div>

                {/* Connection Status Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono text-xs">
                  <div className="border border-slate-800 bg-[#111827] p-3">
                    <div className="text-slate-400">1. ESCUTA SO-FI (MIC FFT)</div>
                    <div className="mt-1 text-sm font-bold text-emerald-400">
                      {isMicListening ? 'MICROFONE ATIVO (44.1kHz)' : 'LOOPBACK INTERNO ATIVO'}
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className="mt-2 w-full border border-slate-700 bg-[#07090E] py-1 text-xs text-cyan-300 hover:border-cyan-500"
                    >
                      {isMicListening ? 'Pausar Microfone Real' : 'Ativar Microfone Real'}
                    </button>
                  </div>

                  <div className="border border-slate-800 bg-[#111827] p-3">
                    <div className="text-slate-400">2. WEBRTC P2P (PIN {roomPin})</div>
                    <div className="mt-1 text-sm font-bold text-cyan-400">
                      {transportStatus.webrtcConnected ? 'TÚNEL P2P ABERTO' : 'SINALIZADOR ATIVO'}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Nós na Sala: {transportStatus.peerCount} · RTT: {transportStatus.latencyMs}ms
                    </div>
                  </div>

                  <div className="border border-slate-800 bg-[#111827] p-3">
                    <div className="text-slate-400">3. KINE-FI BLUETOOTH HID</div>
                    <div className="mt-1 text-sm font-bold text-emerald-400">
                      SDP KEYBOARD PRONTO
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Chord: LCtrl (0x01) + F15 (0x6A)
                    </div>
                  </div>
                </div>

                {/* Mobile Key / Phoneme Bridge Tester */}
                <div className="border border-slate-800 bg-[#111827]/70 p-4 space-y-3">
                  <div className="font-mono text-xs text-slate-300">
                    Testar Emissão/Injeção Direta do Roteador Celular para o Jogo (Jogador {localPlayerSlot}):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x01)}
                      className="border border-slate-700 bg-[#07090E] py-2.5 text-white hover:border-cyan-500"
                    >
                      INJETAR W (0x01)
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x02)}
                      className="border border-slate-700 bg-[#07090E] py-2.5 text-white hover:border-cyan-500"
                    >
                      INJETAR S (0x02)
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x04)}
                      className="border border-slate-700 bg-[#07090E] py-2.5 text-white hover:border-cyan-500"
                    >
                      INJETAR A (0x04)
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchLocalPhyFiIntent(localPlayerSlot, 0x08)}
                      className="border border-slate-700 bg-[#07090E] py-2.5 text-white hover:border-cyan-500"
                    >
                      INJETAR D (0x08)
                    </button>
                  </div>
                </div>

                {/* Analytical Terminal Logs (Matches RouterUI.kt) */}
                <div className="border border-slate-800 bg-[#07090E] p-4 font-mono text-xs">
                  <div className="mb-2 text-slate-400">
                    LOGS ANALÍTICOS DO SERVIÇO EM SEGUNDO PLANO (PhyFiService):
                  </div>
                  <div className="h-44 overflow-y-auto space-y-1 text-slate-300">
                    {routerLogs.map((line, idx) => (
                      <div key={idx}>&gt; {line}</div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          )}
        </>
      )}

      {/* =====================================================================
          PAUSED MODAL
         ===================================================================== */}
      {screenState === 'paused' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-slate-800 bg-[#0B0E17] p-6 text-center space-y-5">
            <h2 className="font-display text-2xl font-bold text-white">SIMULAÇÃO EM PAUSA</h2>
            <p className="text-xs text-slate-400">
              O loop de áudio So-Fi e a injeção Kine-Fi estão temporariamente suspensos.
            </p>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="border border-slate-800 bg-[#111827] p-3">
                <div className="text-slate-400">JOGADOR 1</div>
                <div className="mt-1 text-lg font-bold text-cyan-400 tabular-nums">
                  {hudSnapshot.p1.score} pts
                </div>
              </div>
              <div className="border border-slate-800 bg-[#111827] p-3">
                <div className="text-slate-400">JOGADOR 2</div>
                <div className="mt-1 text-lg font-bold text-amber-400 tabular-nums">
                  {hudSnapshot.p2.score} pts
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setScreenState('playing')}
                className="w-full bg-cyan-500 py-2.5 font-display text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                RETOMAR PARTIDA
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetArena();
                  setScreenState('playing');
                }}
                className="w-full border border-slate-700 bg-slate-900 py-2.5 font-display text-xs font-bold text-slate-200 hover:bg-slate-800"
              >
                REINICIAR ARENA
              </button>
              <button
                type="button"
                onClick={handleGracefulShutdown}
                className="w-full border border-rose-500/40 bg-rose-950/30 py-2.5 font-display text-xs font-bold text-rose-300 hover:bg-rose-900/40"
              >
                ENCERRAR SESSÃO (TEARDOWN FIN)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GAME OVER / AUTOMATIC SESSION TEARDOWN MODAL
         ===================================================================== */}
      {screenState === 'gameover' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-lg border border-slate-800 bg-[#0B0E17] p-6 space-y-5">
            <div>
              <div className="font-mono text-xs text-emerald-400">
                TEARDOWN AUTOMÁTICO CONCLUÍDO · PACOTE 0xF080 (FIN_CLOSE)
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-white">
                SESSÃO PHY-FI ENCERRADA COM SEGURANÇA
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                O DataChannel WebRTC foi fechado, o microfone em segundo plano foi liberado e o descritor SDP Bluetooth HID foi desregistrado.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="border border-slate-800 bg-[#111827] p-3">
                <div className="text-slate-400">SCORE J1</div>
                <div className="mt-1 text-xl font-bold text-cyan-400 tabular-nums">
                  {hudSnapshot.p1.score}
                </div>
              </div>
              <div className="border border-slate-800 bg-[#111827] p-3">
                <div className="text-slate-400">SCORE J2</div>
                <div className="mt-1 text-xl font-bold text-amber-400 tabular-nums">
                  {hudSnapshot.p2.score}
                </div>
              </div>
              <div className="border border-slate-800 bg-[#111827] p-3">
                <div className="text-slate-400">TICKS TOTAIS</div>
                <div className="mt-1 text-xl font-bold text-white tabular-nums">
                  {hudSnapshot.tick}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  handleResetArena();
                  startSessionWithPin(roomPin, localPlayerSlot);
                }}
                className="flex-1 bg-cyan-500 py-2.5 font-display text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                RECONECTAR E JOGAR NOVAMENTE
              </button>
              <button
                type="button"
                onClick={() => setScreenState('title')}
                className="border border-slate-700 bg-slate-900 px-4 py-2.5 font-display text-xs font-bold text-slate-200 hover:bg-slate-800"
              >
                VOLTAR AO INÍCIO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modemRef.current && (
        <PhonemeSoundbankModal
          isOpen={isSoundbankOpen}
          onClose={() => setIsSoundbankOpen(false)}
          modem={modemRef.current}
        />
      )}
      <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}
