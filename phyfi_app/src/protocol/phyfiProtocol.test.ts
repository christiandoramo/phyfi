import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pack16Bit,
  unpack16Bit,
  buildPayloadFromNibbles,
  encodePacketToPhonemeSequence,
  mapFrequencyToHexNibble,
  buildKineFiHidReport,
  encodeKeysToIntent,
  decodeIntentToKeys,
  INTENT_UP,
  INTENT_LEFT,
  INTENT_DASH,
  PHONEME_DICTIONARY,
} from './phyfiProtocol';
import {
  createInitialArenaState,
  applyPlayerIntent,
  stepArenaSimulation,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_RADIUS,
} from './arenaSimulation';

test('Protocol16Bit packs and unpacks actorId, timestamp, and intent losslessly', () => {
  const actorId = 0x2;
  const timestamp = 0xb;
  const intent = INTENT_UP | INTENT_LEFT | INTENT_DASH; // 0x01 | 0x04 | 0x10 = 0x15

  const packed = pack16Bit(actorId, timestamp, intent);
  assert.equal(packed, 0x2b15);

  const unpacked = unpack16Bit(packed);
  assert.equal(unpacked.actorId, 2);
  assert.equal(unpacked.timestamp, 11);
  assert.equal(unpacked.intent, 0x15);
  assert.equal(unpacked.hex, '2B15');
  assert.deepEqual(unpacked.nibbles, [2, 11, 1, 5]);
});

test('buildPayloadFromNibbles reconstructs exact 16-bit short from 4 hex nibbles', () => {
  const raw = buildPayloadFromNibbles(0x1, 0xf, 0x0, 0x9);
  assert.equal(raw, 0x1f09);
  const unpacked = unpack16Bit(raw);
  assert.equal(unpacked.actorId, 1);
  assert.equal(unpacked.timestamp, 15);
  assert.equal(unpacked.intent, 0x09);
});

test('encodePacketToPhonemeSequence generates [header, p(n1), p(n2), p(n3), p(n4), tail]', () => {
  const seq = encodePacketToPhonemeSequence(1, 7, 0x0a);
  assert.equal(seq.length, 6);
  assert.equal(seq[0].id, 'header');
  assert.equal(seq[1].id, 'p1');
  assert.equal(seq[2].id, 'p7');
  assert.equal(seq[3].id, 'p0');
  assert.equal(seq[4].id, 'p10');
  assert.equal(seq[5].id, 'tail');
});

test('mapFrequencyToHexNibble maps Golden Zone frequencies (1100Hz - 3350Hz) and rejects noise', () => {
  for (let i = 0; i < 16; i++) {
    const exactFreq = PHONEME_DICTIONARY[i].fundamentalHz;
    // Slight acoustic drift (+25Hz) must still resolve to nibble i
    assert.equal(mapFrequencyToHexNibble(exactFreq + 25), i);
  }
  // Low frequency footsteps (250Hz) and ultrasonic (15000Hz) are rejected by psychoacoustic bypass
  assert.equal(mapFrequencyToHexNibble(250), null);
  assert.equal(mapFrequencyToHexNibble(15000), null);
});

test('KineFiTranslator builds 8-byte HID report with LCtrl (0x01) + F15 (0x6A) + Intent and jitter', () => {
  const intent = encodeKeysToIntent({ w: true, d: true });
  const report = buildKineFiHidReport(intent, 42);
  assert.equal(report.bytes.length, 8);
  assert.equal(report.bytes[0], 0x01); // Left Ctrl
  assert.equal(report.bytes[2], 0x6a); // F15
  assert.equal(report.bytes[3], intent);
  assert.ok(report.downJitterMs >= 5 && report.downJitterMs <= 22);
  assert.ok(report.pressDurationMs >= 30 && report.pressDurationMs <= 80);
  assert.ok(report.upJitterMs >= 5 && report.upJitterMs <= 22);
  assert.deepEqual(decodeIntentToKeys(intent), ['W', 'D']);
});

test('ArenaSimulation moves players deterministically and clamps X and Y boundaries strictly', () => {
  const state = createInitialArenaState();
  const initialX = state.players[1].x;
  const initialY = state.players[1].y;

  // Move Player 1 Left + Up repeatedly toward (0,0) top-left corner
  const moveUpLeft = encodeKeysToIntent({ w: true, a: true });
  applyPlayerIntent(state, 1, moveUpLeft, 1, 1000);

  for (let i = 0; i < 60; i++) {
    stepArenaSimulation(state, 0.033);
  }

  assert.ok(state.players[1].x < initialX);
  assert.ok(state.players[1].y < initialY);
  // Must never cross minX or minY bounds
  assert.equal(state.players[1].x, state.bounds.minX);
  assert.equal(state.players[1].y, state.bounds.minY);
  assert.equal(state.players[1].isCollidingBoundary, true);

  // Move Player 2 Down + Right toward bottom-right boundary
  const moveDownRight = encodeKeysToIntent({ s: true, d: true });
  applyPlayerIntent(state, 2, moveDownRight, 2, 2000);
  for (let i = 0; i < 60; i++) {
    stepArenaSimulation(state, 0.033);
  }
  assert.equal(state.players[2].x, ARENA_WIDTH - PLAYER_RADIUS - 8);
  assert.equal(state.players[2].y, ARENA_HEIGHT - PLAYER_RADIUS - 8);
  assert.equal(state.players[2].isCollidingBoundary, true);
});
