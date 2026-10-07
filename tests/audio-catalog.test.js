import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC_TRACKS, AMBIENCE_SOUNDS, normalizeZenSettings} from '../zen.js';

test('only approved recordings are selectable, and legacy saved choices migrate', () => {
  assert.deepEqual(MUSIC_TRACKS, ['magicPuzzle', 'cozyPuzzle', 'spaceCity']);
  assert.deepEqual(AMBIENCE_SOUNDS, ['stream', 'rain', 'forest', 'rainforest']);
  for (const musicTrack of ['sereno', 'cidade', 'jardim', 'horizonte', 'estrelas']) {
    const migrated = normalizeZenSettings({music: true, ambience: true, musicTrack, ambienceSound: 'white'});
    assert.equal(migrated.musicTrack, 'cozyPuzzle');
    assert.equal(migrated.ambienceSound, 'rain');
    assert.equal(migrated.music, true);
    assert.equal(migrated.ambience, true);
  }
  for (const ambienceSound of ['white', 'storm', 'field'])
    assert.equal(normalizeZenSettings({ambienceSound}).ambienceSound, 'rain');
});
