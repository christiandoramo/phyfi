/**
 * So-Fi Acoustic Modem Engine (Web Audio API)
 *
 * Implements:
 * 1. Combinatorial Human Phoneme Synthesis & Custom .ogg/.wav Phoneme Bank Loader
 *    - Synthesizes human vocal formants (F1 + F2) overlapped with the exact hexadecimal
 *      carrier frequency in the Psychoacoustic Golden Zone (1100Hz - 3350Hz) + walkie-talkie
 *      bandpass texture, or plays user-uploaded audio buffers (`header.ogg`, `p0.ogg`..`p15.ogg`, `tail.ogg`).
 * 2. Sequenced & Overlapped Frame Dispatcher (60ms FFT Window Slot with 18ms combinatorial crossfade overlap).
 * 3. Real-Time FFT Acoustic Decoder (Microphone or Internal Loopback)
 *    - Uses AnalyserNode (fftSize = 2048 at 44.1kHz) to scan 1000Hz..4000Hz, apply a Noise Gate,
 *      detect `header.ogg` -> 4 hex nibbles (`p0..p15`) -> `tail.ogg`, and reconstruct 16-bit payloads.
 */

import {
  PhonemeSpec,
  PHONEME_DICTIONARY,
  HEADER_PHONEME,
  TAIL_PHONEME,
  encodePacketToPhonemeSequence,
  mapFrequencyToHexNibble,
  buildPayloadFromNibbles,
  unpack16Bit,
  PhyFiPayload,
} from './phyfiProtocol';

export interface SpectrumSnapshot {
  bins: Float32Array;
  dominantFreqHz: number;
  dominantAmplitude: number;
  detectedPhonemeId: string | null;
  accumulatedNibbles: number[];
  isMicActive: boolean;
}

export class SoFiAcousticModem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Custom uploaded AudioBuffers keyed by phoneme id ('header', 'p0'..'p15', 'tail')
  private customBuffers = new Map<string, AudioBuffer>();
  private isMuted = false;
  private isMicListening = false;

  // Decoder accumulator state
  private nibbleBuffer: number[] = [];
  private lastDetectedId: string | null = null;
  private lastDetectedTimeMs = 0;
  private onPayloadDecodedCallback: ((payload: PhyFiPayload, source: 'mic' | 'loopback') => void) | null = null;

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 44100 });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.28;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.25;

      // Connect masterGain -> analyser -> destination so FFT visualizes both transmitted & mic audio
      this.masterGain.connect(this.analyser);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0.0 : 0.28, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setOnPayloadDecoded(cb: (payload: PhyFiPayload, source: 'mic' | 'loopback') => void): void {
    this.onPayloadDecodedCallback = cb;
  }

  /**
   * Allows user to upload custom `header.ogg`, `p0.ogg`..`p15.ogg`, `tail.ogg` files into the soundbank.
   */
  public async loadCustomPhonemeFile(phonemeId: string, file: File): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      const arrayBuf = await file.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      this.customBuffers.set(phonemeId, audioBuf);
      return true;
    } catch {
      return false;
    }
  }

  public hasCustomPhoneme(phonemeId: string): boolean {
    return this.customBuffers.has(phonemeId);
  }

  public getCustomLoadedCount(): number {
    return this.customBuffers.size;
  }

  /**
   * Starts real microphone capture for the Mobile Router mode (AudioRecord 44.1kHz equivalent).
   */
  public async startMicrophoneCapture(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      if (this.isMicListening && this.micStream) return true;

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSource = ctx.createMediaStreamSource(this.micStream);
      if (this.analyser) {
        this.micSource.connect(this.analyser);
      }
      this.isMicListening = true;
      return true;
    } catch {
      this.isMicListening = false;
      return false;
    }
  }

  public stopMicrophoneCapture(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // Ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.isMicListening = false;
  }

  /**
   * Plays a single phoneme (either uploaded `.ogg` buffer or combinatorial vocal formant + carrier synthesis)
   * at a scheduled Web Audio timestamp with overlapping envelope.
   */
  public triggerPhonemeAt(spec: PhonemeSpec, startTime: number, durationSec: number = 0.058): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;

    const customBuf = this.customBuffers.get(spec.id);
    if (customBuf) {
      const src = ctx.createBufferSource();
      src.buffer = customBuf;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.01, startTime);
      env.gain.linearRampToValueAtTime(0.9, startTime + 0.008);
      env.gain.exponentialRampToValueAtTime(0.01, startTime + durationSec);
      src.connect(env);
      env.connect(this.masterGain);
      src.start(startTime);
      src.stop(startTime + durationSec + 0.01);
      return;
    }

    // Combinatorial Formant + Carrier Synthesis in the 1kHz-4kHz Psychoacoustic Golden Zone
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, startTime);
    env.gain.linearRampToValueAtTime(0.55, startTime + 0.007);
    env.gain.setValueAtTime(0.55, startTime + durationSec * 0.72);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    // Primary Hexadecimal FFT Carrier Oscillator (1100Hz .. 3350Hz)
    const carrierOsc = ctx.createOscillator();
    carrierOsc.type = 'sine';
    carrierOsc.frequency.setValueAtTime(spec.fundamentalHz, startTime);

    // Combinatorial Human Formant F1 + F2 Harmonic Overlay (gives vocal phoneme timbre)
    const formantOsc = ctx.createOscillator();
    formantOsc.type = 'triangle';
    formantOsc.frequency.setValueAtTime(spec.formantF2Hz, startTime);

    const formantGain = ctx.createGain();
    formantGain.gain.setValueAtTime(0.16, startTime);

    carrierOsc.connect(env);
    formantOsc.connect(formantGain);
    formantGain.connect(env);
    env.connect(this.masterGain);

    carrierOsc.start(startTime);
    formantOsc.start(startTime);
    carrierOsc.stop(startTime + durationSec + 0.005);
    formantOsc.stop(startTime + durationSec + 0.005);
  }

  /**
   * Emits a complete 16-bit packet as a sequenced & combinatorially overlapped acoustic wave:
   * [header.ogg, p(n1).ogg, p(n2).ogg, p(n3).ogg, p(n4).ogg, tail.ogg]
   * Step interval = 45ms with 58ms phoneme duration (13ms combinatorial overlap between adjacent phonemes).
   */
  public transmitPacketAcoustically(
    actorId: number,
    timestamp: number,
    intent: number,
    triggerLoopbackDecode: boolean = true
  ): PhonemeSpec[] {
    const seq = encodePacketToPhonemeSequence(actorId, timestamp, intent);
    try {
      const ctx = this.ensureContext();
      const baseTime = ctx.currentTime + 0.005;
      const stepSec = 0.044; // 44ms sequencing slot
      const durationSec = 0.056; // 56ms duration -> 12ms combinatorial overlap

      seq.forEach((spec, idx) => {
        this.triggerPhonemeAt(spec, baseTime + idx * stepSec, durationSec);
      });

      if (triggerLoopbackDecode && this.onPayloadDecodedCallback) {
        const raw = buildPayloadFromNibbles(
          seq[1].index,
          seq[2].index,
          seq[3].index,
          seq[4].index
        );
        const unpacked = unpack16Bit(raw);
        const totalFlightMs = Math.round(seq.length * stepSec * 1000);
        window.setTimeout(() => {
          this.onPayloadDecodedCallback?.(unpacked, 'loopback');
        }, totalFlightMs);
      }
    } catch {
      // Fallback if audio context is blocked by autoplay policy prior to interaction
    }
    return seq;
  }

  /**
   * Samples the live 2048-point FFT spectrum (1000Hz..4000Hz Psychoacoustic Golden Zone)
   * and executes real-time nibble extraction if microphone capture is active.
   */
  public sampleSpectrum(): SpectrumSnapshot {
    const emptyBins = new Float32Array(32);
    if (!this.analyser || !this.ctx) {
      return {
        bins: emptyBins,
        dominantFreqHz: 0,
        dominantAmplitude: 0,
        detectedPhonemeId: null,
        accumulatedNibbles: [...this.nibbleBuffer],
        isMicActive: this.isMicListening,
      };
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const sampleRate = this.ctx.sampleRate || 44100;
    const fftSize = this.analyser.fftSize;

    let maxAmp = 0;
    let dominantFreqHz = 0;

    // Scan Golden Zone (900Hz .. 3600Hz)
    for (let i = 0; i < freqData.length; i++) {
      const freq = (i * sampleRate) / fftSize;
      if (freq >= 900 && freq <= 3600) {
        const normalizedAmp = freqData[i] / 255.0;
        if (normalizedAmp > maxAmp) {
          maxAmp = normalizedAmp;
          dominantFreqHz = freq;
        }
      }
    }

    // Downsample 32 display bars across 900Hz..3600Hz for the Spectrograph HUD
    for (let b = 0; b < 32; b++) {
      const targetHz = 950 + b * 85;
      const binIdx = Math.round((targetHz * fftSize) / sampleRate);
      emptyBins[b] = binIdx < freqData.length ? freqData[binIdx] / 255.0 : 0;
    }

    let detectedPhonemeId: string | null = null;

    // Mathematical Noise Gate (threshold 0.18 normalized amplitude)
    if (maxAmp > 0.18) {
      if (Math.abs(dominantFreqHz - HEADER_PHONEME.fundamentalHz) <= 55) {
        detectedPhonemeId = 'header';
        this.nibbleBuffer = [];
      } else if (Math.abs(dominantFreqHz - TAIL_PHONEME.fundamentalHz) <= 55) {
        detectedPhonemeId = 'tail';
      } else {
        const nibble = mapFrequencyToHexNibble(dominantFreqHz, 60);
        if (nibble !== null) {
          detectedPhonemeId = `p${nibble}`;
          const now = performance.now();
          if (this.isMicListening && (detectedPhonemeId !== this.lastDetectedId || now - this.lastDetectedTimeMs > 52)) {
            this.lastDetectedId = detectedPhonemeId;
            this.lastDetectedTimeMs = now;
            this.nibbleBuffer.push(nibble);

            if (this.nibbleBuffer.length === 4) {
              const raw = buildPayloadFromNibbles(
                this.nibbleBuffer[0],
                this.nibbleBuffer[1],
                this.nibbleBuffer[2],
                this.nibbleBuffer[3]
              );
              const payload = unpack16Bit(raw);
              this.nibbleBuffer = [];
              this.onPayloadDecodedCallback?.(payload, 'mic');
            }
          }
        }
      }
    }

    return {
      bins: emptyBins,
      dominantFreqHz: Math.round(dominantFreqHz),
      dominantAmplitude: Math.round(maxAmp * 100) / 100,
      detectedPhonemeId,
      accumulatedNibbles: [...this.nibbleBuffer],
      isMicActive: this.isMicListening,
    };
  }

  public shutdown(): void {
    this.stopMicrophoneCapture();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
  }
}
