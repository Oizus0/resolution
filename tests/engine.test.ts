import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, displayName, readState } from '../src/engine.ts';
import type { State, Command, EffectInput, Environment } from '../src/engine.ts';
const players = [{ id: 'ana', name: 'Ana', initiative: 22 }, { id: 'bruno', name: 'Bruno', initiative: 16 }, { id: 'pedro', name: 'Pedro', initiative: 10 }];
const setup = () => reduce(initialState(), { type: 'add', participants: players }).state;
const next = (s: State, env: Environment = {}) => reduce(s, { type: 'next' }, env).state;
const cast = (patch: Partial<EffectInput> = {}): Command => ({ type: 'effect', value: {
  id: 'e1', name: 'Efeito livre', description: '', sourceId: 'ana', anchorId: 'ana',
  targetIds: ['bruno'], remaining: 3, trigger: 'start', message: 'Mensagem personalizada.', tone: 'fire', notifyDuration: true, ...patch
} });

test('registration does not start combat; the first click starts Ana in round 1', () => {
  const s = setup(); assert.equal(s.combat.started, false); assert.equal(s.combat.activeId, null);
  const r = next(s); assert.equal(r.combat.activeId, 'ana'); assert.equal(r.combat.round, 1); assert.equal(r.history.length, 1);
});
test('a three-round buff skips the application turn and expires at the end of Ana in round 4', () => {
  let s = reduce(next(setup()), cast({ trigger: 'none' })).state;
  s = next(s); assert.equal(s.combat.effects[0].remaining, 3);
  s = next(next(next(s))); assert.equal(s.combat.round, 2); assert.equal(s.combat.effects[0].remaining, 2);
  s = next(next(next(s))); assert.equal(s.combat.effects[0].remaining, 1);
  const r = reduce(next(next(s)), { type: 'next' });
  assert.equal(r.state.combat.round, 4); assert.equal(r.state.combat.effects.length, 0);
  assert.equal(r.notices.filter(n => n.kind === 'expired').length, 1);
});
test('burning triggers at each target start, while one shared clock ticks at Ana end', () => {
  let s = reduce(next(setup()), cast({ targetIds: ['bruno','pedro'] })).state;
  let r = reduce(s, { type: 'next' }); assert.deepEqual(r.notices.map(n => n.targetIds), [['bruno']]);
  r = reduce(r.state, { type: 'next' }); assert.deepEqual(r.notices.map(n => n.targetIds), [['pedro']]);
  assert.equal(r.state.combat.effects[0].remaining, 3);
  s = next(r.state); r = reduce(s, { type: 'next' });
  assert.equal(r.state.combat.effects[0].remaining, 2);
  assert.deepEqual(r.notices.map(n => n.kind), ['duration','trigger']);
});
test('a reaction during Bruno turn uses Bruno as reference and waits for his next full turn', () => {
  let s = next(next(setup())); s = reduce(s, cast({ anchorId: 'bruno' })).state;
  let r = reduce(s, { type: 'next' }); assert.equal(r.notices.length, 0); assert.equal(r.state.combat.effects[0].remaining, 3);
  s = next(next(r.state)); assert.equal(s.combat.activeId, 'bruno');
  assert.equal(s.combat.effects[0].remaining, 3); s = next(s); assert.equal(s.combat.effects[0].remaining, 2);
});
test('effects created before combat count after the first complete reference turn', () => {
  let s = reduce(setup(), cast({ anchorId: 'bruno' })).state;
  s = next(next(next(s))); assert.equal(s.combat.effects[0].remaining, 2);
});
test('Apoio livre shows on Bruno, uses Ana, and never emits an activation notice', () => {
  let s = reduce(next(setup()), cast({ name: 'Apoio livre', trigger: 'none', description: 'Descrição do benefício.' })).state;
  const r = reduce(s, { type: 'nextRound' });
  assert.equal(r.notices.length, 0); assert.equal(r.state.combat.effects[0].remaining, 3);
  s = next(r.state); assert.equal(s.combat.log.at(-1)?.kind, 'duration');
});
test('Referência livre is a descriptive effect on Ana only; area/HP/dice are never calculated', () => {
  let s = reduce(next(setup()), cast({ name: 'Referência livre', targetIds: ['ana'], trigger: 'none', description: 'Área controlada manualmente pela mesa.' })).state;
  assert.deepEqual(s.combat.effects[0].targetIds, ['ana']);
  s = next(next(next(next(s)))); assert.equal(s.combat.effects[0].remaining, 2);
});
test('round jump processes all skipped starts and ends and stops at first next-round turn', () => {
  let s = reduce(next(setup()), cast()).state;
  let r = reduce(s, { type: 'nextRound' }); assert.equal(r.state.combat.activeId, 'ana');
  assert.equal(r.state.combat.round, 2); assert.equal(r.notices.filter(n => n.kind === 'trigger').length, 1);
  r = reduce(r.state, { type: 'nextRound' }); assert.equal(r.state.combat.effects[0].remaining, 2);
  assert.deepEqual(r.notices.map(n => n.kind), ['duration','trigger']);
});
test('rewind restores the previous round opening, including expired and newly added effects', () => {
  let s = reduce(setup(), cast({ remaining: 1 })).state;
  s = next(s); const original = structuredClone(s.combat);
  s = reduce(s, { type: 'nextRound' }).state; assert.equal(s.combat.effects.length, 0);
  s = reduce(s, cast({ id: 'new' })).state;
  const r = reduce(s, { type: 'previousRound' });
  assert.deepEqual(r.state.combat, original); assert.equal(r.notices.length, 0);
});
test('editing the round number has no effect on durations, turns or history', () => {
  const s = reduce(next(setup()), cast()).state;
  const r = reduce(s, { type: 'round', value: 42 }).state;
  assert.equal(r.combat.round, 42); assert.equal(r.combat.activeId, s.combat.activeId);
  assert.deepEqual(r.combat.effects, s.combat.effects); assert.deepEqual(r.history, s.history);
});
test('removing the caster retains the clock position, removing a target prunes only that target', () => {
  let s = reduce(next(setup()), cast({ targetIds: ['bruno','pedro'] })).state;
  s = reduce(s, { type: 'remove', id: 'ana' }).state;
  s = next(s); assert.equal(s.combat.activeId, 'bruno'); assert.equal(s.combat.effects[0].remaining, 3);
  s = next(next(s)); assert.equal(s.combat.activeId, 'bruno'); assert.equal(s.combat.effects[0].remaining, 2);
  s = reduce(s, { type: 'remove', id: 'bruno' }).state; assert.deepEqual(s.combat.effects[0].targetIds, ['pedro']);
});
test('hidden turns are traversed automatically without losing their effect clocks', () => {
  let s = reduce(setup(), cast({ anchorId: 'bruno', targetIds: ['ana'], remaining: 3 })).state;
  s = reduce(s, { type: 'settings', value: { skipHidden: true } }).state;
  s = next(s, { hiddenIds: ['bruno'] }); s = next(s, { hiddenIds: ['bruno'] });
  assert.equal(s.combat.activeId, 'pedro'); assert.equal(s.combat.effects[0].remaining, 2);
});
test('all hidden participants cannot cause an infinite loop or consume time', () => {
  const s = reduce(setup(), { type: 'settings', value: { skipHidden: true } }).state;
  assert.throws(() => next(s, { hiddenIds: ['ana','bruno','pedro'] }), /Nenhum participante/);
  assert.equal(s.combat.started, false);
});
test('a newcomer after the current actor acts this round; one before waits', () => {
  let s = next(setup());
  s = reduce(s, { type: 'add', participants: [{ id: 'new', name: 'Nova', initiative: 21 }, { id: 'early', name: 'Antes', initiative: 30 }] }).state;
  s = next(s); assert.equal(s.combat.activeId, 'new');
  s = next(next(next(s))); assert.equal(s.combat.activeId, 'early'); assert.equal(s.combat.round, 2);
});
test('manual ordering wins over initiative and already-acted participants never act twice', () => {
  let s = next(next(setup()));
  s = reduce(s, { type: 'move', id: 'ana', beforeId: null }).state;
  s = next(s); assert.equal(s.combat.activeId, 'pedro');
  s = next(s); assert.equal(s.combat.round, 2); assert.equal(s.combat.activeId, 'bruno');
});
test('reset preserves aliases only, and duplicate command IDs cannot double advance', () => {
  let s = reduce(setup(), { type: 'alias', id: 'ana', value: 'Ana, a Solar' }).state;
  s = reduce(s, { type: 'next' }, {}, 'click1').state;
  const duplicate = reduce(s, { type: 'next' }, {}, 'click1').state;
  assert.deepEqual(duplicate, s);
  s = reduce(s, cast()).state; s = reduce(s, { type: 'reset' }).state;
  assert.equal(displayName(s, 'ana'), 'Ana, a Solar'); assert.equal(s.combat.order.length, 0);
  assert.equal(s.combat.effects.length, 0); assert.equal(s.history.length, 0); assert.equal(s.combat.started, false);
});
test('separate applications never merge and malformed saves are preserved by rejecting them', () => {
  let s = reduce(setup(), cast()).state; s = reduce(s, cast({ id: 'e2' })).state;
  assert.equal(s.combat.effects.length, 2); assert.throws(() => readState({ version: 7 }), /preservados/);
});
test('end-turn reminder precedes expiration, while a new mid-turn effect waits', () => {
  let s = reduce(setup(), cast({ anchorId: 'bruno', remaining: 1, trigger: 'end' })).state;
  s = next(next(s)); const r = reduce(s, { type: 'next' });
  assert.deepEqual(r.notices.map(n => n.kind), ['trigger', 'expired']);
});
test('empty combat and invalid durations fail without modifying the state', () => {
  const s = initialState(); assert.throws(() => next(s));
  assert.throws(() => reduce(setup(), cast({ remaining: 0 }))); assert.equal(s.revision, 0);
});

test('an effect without a caster keeps its duration reference on edit and expires normally', () => {
  let s = reduce(next(setup()), cast({ sourceId: '', remaining: 1, targetIds: ['pedro'] })).state;
  s = reduce(s, { type: 'effect', value: { ...s.combat.effects[0], description: 'Editado' } }).state;
  assert.equal(s.combat.effects[0].sourceId, '');
  s = next(s);
  assert.equal(s.combat.effects[0].remaining, 1);
  s = next(next(next(s)));
  assert.equal(s.combat.effects.length, 0);
});

test('removing a caster with another duration reference still permits editing the effect', () => {
  let s = reduce(next(setup()), cast({ anchorId: 'bruno' })).state;
  s = reduce(s, { type: 'remove', id: 'ana' }).state;
  s = next(s);
  assert.equal(s.combat.participants.ana.participating, false);
  s = reduce(s, cast({ anchorId: 'bruno', remaining: 2 })).state;
  assert.equal(s.combat.effects[0].remaining, 2);
  s = reduce(s, { type: 'removeEffect', id: 'e1' }).state;
  assert.equal(s.combat.participants.ana, undefined);
});

test('a large round jump persists all its notifications for background clients', () => {
  let s = next(setup());
  for (let i = 0; i < 70; i++) s = reduce(s, cast({ id: `e${i}`, targetIds: ['bruno','pedro'] })).state;
  const r = reduce(s, { type: 'nextRound' });
  assert.equal(r.notices.length, 140);
  assert.equal(r.state.combat.log.length, 140);
  assert.deepEqual(r.state.combat.log, r.notices);
});
