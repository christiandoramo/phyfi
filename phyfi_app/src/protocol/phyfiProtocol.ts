/**
 * Phy-Fi 16-Bit Protocol, Combinatorial Phoneme Dictionary & Kine-Fi HID Translator
 *
 * Frame Structure (16 bits / 2 bytes / 4 Hex Nibbles):
 * - Bits 15..12 (4 bits): Actor ID (0x1 = Player 1 Host, 0x2 = Player 2 Client, 0xF = System/Control)
 * - Bits 11..8  (4 bits): Rolling Tick Timestamp (0x0 .. 0xF, modulo 16)
 * - Bits 7..0   (8 bits): Intent / WASD + Action Bitmask or Control OpCode
 *
 * Intent Bitmask (8 bits):
 * - Bit 0 (0x01): W (Move Up / -Y)
 * - Bit 1 (0x02): S (Move Down / +Y)
 * - Bit 2 (0x04): A (Move Left / -X)
 * - Bit 3 (0x08): D (Move Right / +X)
 * - Bit 4 (0x10): Dash / Boost (Space / Shift)
 * - Bit 5 (0x20): Pulse / Tag Action (E / Enter)
 * - Bit 6 (0x40): Handshake / Sync ACK
 * - Bit 7 (0x80): Session Terminate / Graceful Teardown (FIN)
 */

export const INTENT_NONE = 0x00;
export const INTENT_UP = 0x01;    // W
export const INTENT_DOWN = 0x02;  // S
export const INTENT_LEFT = 0x04;  // A
export const INTENT_RIGHT = 0x08; // D
export const INTENT_DASH = 0x10;  // Space
export const INTENT_PULSE = 0x20; // E
export const INTENT_SYN_ACK = 0x40;
export const INTENT_FIN_CLOSE = 0x80;

export interface PhyFiPayload {
  raw: number;        // 16-bit unsigned integer (0x0000 .. 0xFFFF)
  hex: string;        // 4-char uppercase hex string (e.g. "1A09")
  nibbles: [number, number, number, number]; // [h1, h2, h3, h4] each 0..15
  actorId: number;    // 0..15
  timestamp: number;  // 0..15
  intent: number;     // 0..255
}

export interface PhonemeSpec {
  index: number;      // 0..15 for p0..p15, 16 for header, 17 for tail
  id: string;         // 'p0'..'p15' | 'header' | 'tail'
  file: string;       // '/phonemes/p0.ogg' etc.
  ipa: string;        // Human vocal phoneme label (IPA)
  fundamentalHz: number; // Primary carrier frequency in Psychoacoustic Golden Zone (1100Hz - 3350Hz)
  formantF1Hz: number;   // First vocal formant (overlapping combinatorial harmonic)
  formantF2Hz: number;   // Second vocal formant (overlapping combinatorial harmonic)
  description: string;
}

/**
 * 16 Hexadecimal Phonemes (p0.ogg .. p15.ogg) + Header + Tail
 * Matches the exact frequency bins from AudioDecoder.kt (1100Hz .. 3350Hz, step 150Hz)
 * combined with human vowel/consonant formant pairs for psychoacoustic bypass.
 */
export const PHONEME_DICTIONARY: PhonemeSpec[] = [
  { index: 0,  id: 'p0',  file: '/phonemes/p0.ogg',  ipa: '/ɑː/', fundamentalHz: 1100, formantF1Hz: 730, formantF2Hz: 1090, description: 'Vogal Aberta Posterior (Hex 0x0)' },
  { index: 1,  id: 'p1',  file: '/phonemes/p1.ogg',  ipa: '/ɛ/',  fundamentalHz: 1250, formantF1Hz: 530, formantF2Hz: 1840, description: 'Vogal Semiaberta Anterior (Hex 0x1)' },
  { index: 2,  id: 'p2',  file: '/phonemes/p2.ogg',  ipa: '/iː/', fundamentalHz: 1400, formantF1Hz: 270, formantF2Hz: 2290, description: 'Vogal Fechada Anterior (Hex 0x2)' },
  { index: 3,  id: 'p3',  file: '/phonemes/p3.ogg',  ipa: '/ɔː/', fundamentalHz: 1550, formantF1Hz: 570, formantF2Hz: 840,  description: 'Vogal Semiaberta Posterior (Hex 0x3)' },
  { index: 4,  id: 'p4',  file: '/phonemes/p4.ogg',  ipa: '/uː/', fundamentalHz: 1700, formantF1Hz: 300, formantF2Hz: 870,  description: 'Vogal Fechada Posterior (Hex 0x4)' },
  { index: 5,  id: 'p5',  file: '/phonemes/p5.ogg',  ipa: '/ə/',  fundamentalHz: 1850, formantF1Hz: 500, formantF2Hz: 1500, description: 'Vogal Central Xevá (Hex 0x5)' },
  { index: 6,  id: 'p6',  file: '/phonemes/p6.ogg',  ipa: '/eɪ/', fundamentalHz: 2000, formantF1Hz: 400, formantF2Hz: 2050, description: 'Ditongo Vocal Frontal (Hex 0x6)' },
  { index: 7,  id: 'p7',  file: '/phonemes/p7.ogg',  ipa: '/aɪ/', fundamentalHz: 2150, formantF1Hz: 660, formantF2Hz: 1720, description: 'Ditongo Aberto-Fechado (Hex 0x7)' },
  { index: 8,  id: 'p8',  file: '/phonemes/p8.ogg',  ipa: '/ʃ/',  fundamentalHz: 2300, formantF1Hz: 450, formantF2Hz: 2450, description: 'Fricativa Pós-Alveolar (Hex 0x8)' },
  { index: 9,  id: 'p9',  file: '/phonemes/p9.ogg',  ipa: '/s/',  fundamentalHz: 2450, formantF1Hz: 380, formantF2Hz: 2650, description: 'Sibilante Alveolar Surda (Hex 0x9)' },
  { index: 10, id: 'p10', file: '/phonemes/p10.ogg', ipa: '/m/',  fundamentalHz: 2600, formantF1Hz: 280, formantF2Hz: 1150, description: 'Nasal Bilabial Sonora (Hex 0xA)' },
  { index: 11, id: 'p11', file: '/phonemes/p11.ogg', ipa: '/n/',  fundamentalHz: 2750, formantF1Hz: 320, formantF2Hz: 1650, description: 'Nasal Alveolar Sonora (Hex 0xB)' },
  { index: 12, id: 'p12', file: '/phonemes/p12.ogg', ipa: '/l/',  fundamentalHz: 2900, formantF1Hz: 360, formantF2Hz: 1350, description: 'Aproximante Lateral (Hex 0xC)' },
  { index: 13, id: 'p13', file: '/phonemes/p13.ogg', ipa: '/r/',  fundamentalHz: 3050, formantF1Hz: 420, formantF2Hz: 1580, description: 'Vibrante Alveolar Vocal (Hex 0xD)' },
  { index: 14, id: 'p14', file: '/phonemes/p14.ogg', ipa: '/f/',  fundamentalHz: 3200, formantF1Hz: 520, formantF2Hz: 1950, description: 'Fricativa Labiodental (Hex 0xE)' },
  { index: 15, id: 'p15', file: '/phonemes/p15.ogg', ipa: '/k/',  fundamentalHz: 3350, formantF1Hz: 340, formantF2Hz: 2850, description: 'Plosiva Velar Rádio (Hex 0xF)' },
];

export const HEADER_PHONEME: PhonemeSpec = {
  index: 16,
  id: 'header',
  file: '/phonemes/header.ogg',
  ipa: '/SYNC/',
  fundamentalHz: 950,
  formantF1Hz: 950,
  formantF2Hz: 1900,
  description: 'Header de Sincronismo Acústico (Preamble 950Hz)',
};

export const TAIL_PHONEME: PhonemeSpec = {
  index: 17,
  id: 'tail',
  file: '/phonemes/tail.ogg',
  ipa: '/EOT/',
  fundamentalHz: 3500,
  formantF1Hz: 1750,
  formantF2Hz: 3500,
  description: 'Tail de Fechamento de Frame (Postamble 3500Hz)',
};

/**
 * Packs [4-bit actorId] + [4-bit timestamp] + [8-bit intent] into an unsigned 16-bit integer.
 */
export function pack16Bit(actorId: number, timestamp: number, intent: number): number {
  const a = (actorId & 0x0f) << 12;
  const t = (timestamp & 0x0f) << 8;
  const i = intent & 0xff;
  return (a | t | i) & 0xffff;
}

/**
 * Unpacks an unsigned 16-bit integer into structured PhyFiPayload.
 */
export function unpack16Bit(rawPayload: number): PhyFiPayload {
  const clean = rawPayload & 0xffff;
  const actorId = (clean >> 12) & 0x0f;
  const timestamp = (clean >> 8) & 0x0f;
  const intent = clean & 0xff;

  const h1 = actorId;
  const h2 = timestamp;
  const h3 = (intent >> 4) & 0x0f;
  const h4 = intent & 0x0f;

  const hex = clean.toString(16).toUpperCase().padStart(4, '0');

  return {
    raw: clean,
    hex,
    nibbles: [h1, h2, h3, h4],
    actorId,
    timestamp,
    intent,
  };
}

/**
 * Builds a 16-bit payload directly from 4 hexadecimal nibbles (0x0 .. 0xF).
 */
export function buildPayloadFromNibbles(h1: number, h2: number, h3: number, h4: number): number {
  return (
    (((h1 & 0x0f) << 12) |
      ((h2 & 0x0f) << 8) |
      ((h3 & 0x0f) << 4) |
      (h4 & 0x0f)) &
    0xffff
  );
}

/**
 * Encodes a 16-bit packet into a sequenced & combinatorially overlapped phoneme frame:
 * [header.ogg, p(n1).ogg, p(n2).ogg, p(n3).ogg, p(n4).ogg, tail.ogg]
 */
export function encodePacketToPhonemeSequence(actorId: number, timestamp: number, intent: number): PhonemeSpec[] {
  const raw = pack16Bit(actorId, timestamp, intent);
  const unpacked = unpack16Bit(raw);
  const [n1, n2, n3, n4] = unpacked.nibbles;

  return [
    HEADER_PHONEME,
    PHONEME_DICTIONARY[n1],
    PHONEME_DICTIONARY[n2],
    PHONEME_DICTIONARY[n3],
    PHONEME_DICTIONARY[n4],
    TAIL_PHONEME,
  ];
}

/**
 * Maps a detected dominant frequency (in Hz) from the FFT spectrum (1000Hz - 4000Hz)
 * to its corresponding hexadecimal nibble (0..15), using the 60Hz tolerance defined in AudioDecoder.kt.
 */
export function mapFrequencyToHexNibble(freqHz: number, toleranceHz: number = 65): number | null {
  if (freqHz < 1000 || freqHz > 4000) return null;

  let bestIndex: number | null = null;
  let bestDiff = Infinity;

  for (let i = 0; i < PHONEME_DICTIONARY.length; i++) {
    const diff = Math.abs(freqHz - PHONEME_DICTIONARY[i].fundamentalHz);
    if (diff <= toleranceHz && diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Kine-Fi Bluetooth HID Report structure (8 bytes standard USB/BLE HID boot keyboard report)
 * [0: Modifiers (0x01 = Left Ctrl), 1: Reserved (0x00), 2: Key1 (0x6A = F15), 3: Key2 (Dynamic Intent), 4..7: 0x00]
 */
export interface KineFiHidReport {
  bytes: [number, number, number, number, number, number, number, number];
  hexBytes: string;
  chordLabel: string;
  downJitterMs: number;
  pressDurationMs: number;
  upJitterMs: number;
  decodedKeys: string[];
}

export function buildKineFiHidReport(intent: number, deterministicSeed?: number): KineFiHidReport {
  const cleanIntent = intent & 0xff;

  // Anatomical jitter simulation (5..22ms keydown, 30..80ms hold, 5..22ms keyup)
  const rand1 = deterministicSeed !== undefined ? ((deterministicSeed * 17) % 18) : Math.floor(Math.random() * 18);
  const rand2 = deterministicSeed !== undefined ? ((deterministicSeed * 31) % 51) : Math.floor(Math.random() * 51);
  const rand3 = deterministicSeed !== undefined ? ((deterministicSeed * 13) % 18) : Math.floor(Math.random() * 18);

  const downJitterMs = 5 + rand1;
  const pressDurationMs = 30 + rand2;
  const upJitterMs = 5 + rand3;

  const bytes: [number, number, number, number, number, number, number, number] = [
    0x01, // Left Ctrl modifier
    0x00, // Reserved
    0x6a, // F15 obscure chord marker
    cleanIntent, // Dynamic intent byte
    0x00,
    0x00,
    0x00,
    0x00,
  ];

  const hexBytes = bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const decodedKeys = decodeIntentToKeys(cleanIntent);
  const chordLabel = `LCtrl + F15 + [0x${cleanIntent.toString(16).toUpperCase().padStart(2, '0')}: ${decodedKeys.join('+') || 'IDLE'}]`;

  return {
    bytes,
    hexBytes,
    chordLabel,
    downJitterMs,
    pressDurationMs,
    upJitterMs,
    decodedKeys,
  };
}

export function decodeIntentToKeys(intent: number): string[] {
  const keys: string[] = [];
  if (intent & INTENT_UP) keys.push('W');
  if (intent & INTENT_DOWN) keys.push('S');
  if (intent & INTENT_LEFT) keys.push('A');
  if (intent & INTENT_RIGHT) keys.push('D');
  if (intent & INTENT_DASH) keys.push('DASH');
  if (intent & INTENT_PULSE) keys.push('PULSE');
  if (intent & INTENT_SYN_ACK) keys.push('SYN_ACK');
  if (intent & INTENT_FIN_CLOSE) keys.push('FIN_CLOSE');
  return keys;
}

export function encodeKeysToIntent(keys: {
  w?: boolean;
  s?: boolean;
  a?: boolean;
  d?: boolean;
  dash?: boolean;
  pulse?: boolean;
}): number {
  let intent = 0;
  if (keys.w) intent |= INTENT_UP;
  if (keys.s) intent |= INTENT_DOWN;
  if (keys.a) intent |= INTENT_LEFT;
  if (keys.d) intent |= INTENT_RIGHT;
  if (keys.dash) intent |= INTENT_DASH;
  if (keys.pulse) intent |= INTENT_PULSE;
  return intent;
}
