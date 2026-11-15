/** Pure combat rules. No Owlbear, browser, clock or network dependencies. */
export type Trigger = 'none' | 'start' | 'end';
export type Tone = 'gold' | 'fire' | 'blue' | 'green' | 'violet';
export interface Participant { id: string; name: string; initiative: number; hidden?: boolean; participating: boolean; }
export interface Effect {
  id: string; name: string; description: string; sourceId: string; anchorId: string;
  targetIds: string[]; remaining: number; trigger: Trigger; message: string;
  firstCountAt: number; tone: Tone; notifyDuration: boolean;
}
export interface Notice {
  id: string; kind: 'trigger' | 'duration' | 'expired'; effectId: string; name: string;
  message: string; targetIds: string[]; anchorId: string; remaining: number; round: number;
}
export interface Combat {
  started: boolean; round: number; cycle: number; activeId: string | null;
  order: string[]; participants: Record<string, Participant>; effects: Effect[];
  visited: string[]; starts: Record<string, number>; log: Notice[];
}
export interface Settings { autoFocus: boolean; zoom: number; skipHidden: boolean; showPortraits: boolean; }
export interface State {
  version: 1; revision: number; combat: Combat; aliases: Record<string, string>;
  settings: Settings; history: Combat[]; processed: string[];
}
export type EffectInput = Omit<Effect, 'firstCountAt'>;
export type Command =
  | { type: 'add'; participants: { id: string; name: string; initiative: number; hidden?: boolean }[] }
  | { type: 'remove'; id: string }
  | { type: 'initiative'; id: string; value: number; hidden?: boolean }
  | { type: 'alias'; id: string; value: string }
  | { type: 'move'; id: string; beforeId: string | null }
  | { type: 'next' | 'nextRound' | 'previousRound' | 'reset' }
  | { type: 'round'; value: number }
  | { type: 'effect'; value: EffectInput }
  | { type: 'removeEffect'; id: string }
  | { type: 'settings'; value: Partial<Settings> };
export interface Environment { hiddenIds?: string[]; }
export interface Result { state: State; notices: Notice[]; focusId: string | null; }
const clone = <T>(v: T): T => structuredClone(v);
export const defaults = (): Settings => ({ autoFocus: false, zoom: 1.2, skipHidden: false, showPortraits: true });
const emptyCombat = (): Combat => ({ started: false, round: 1, cycle: 0, activeId: null, order: [], participants: {}, effects: [], visited: [], starts: {}, log: [] });
export const initialState = (): State => ({ version: 1, revision: 0, combat: emptyCombat(), aliases: {}, settings: defaults(), history: [], processed: [] });
export function displayName(state: State, id: string): string { return state.aliases[id] || state.combat.participants[id]?.name || 'Personagem'; }
const integer = (n: number, min = 1) => Number.isSafeInteger(n) && n >= min && n <= 99999;
const requireThat = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
export const navigation = (c: Command) => ['next', 'nextRound', 'previousRound', 'reset'].includes(c.type);

export function reduce(previous: State, command: Command, env: Environment = {}, commandId = ''): Result {
  if (commandId && previous.processed.includes(commandId)) return { state: previous, notices: [], focusId: null };
  // Recorded rounds are immutable; avoid cloning the whole history on every click.
  const state: State = clone({ ...previous, history: [] });
  state.history = [...previous.history];
  state.revision++;
  let c = state.combat;
  const notices: Notice[] = [];
  const hidden = new Set([...env.hiddenIds ?? [], ...Object.values(c.participants).filter(p=>p.hidden).map(p=>p.id)]);
  let focusId: string | null = null;
  const isSelectable = (id: string) => c.participants[id]?.participating && !(state.settings.skipHidden && hidden.has(id));
  const canAdvance = () => c.order.some(isSelectable);
  const emit = (effect: Effect, kind: Notice['kind'], targets = effect.targetIds) => {
    const n: Notice = { id: `${state.revision}:${notices.length}`, kind, effectId: effect.id,
      name: effect.name, message: kind === 'trigger' ? effect.message : '', targetIds: [...targets],
      anchorId: effect.anchorId, remaining: effect.remaining, round: c.round };
    notices.push(n); c.log.push(n);
  };
  const start = (id: string) => {
    c.activeId = id;
    c.starts[id] = (c.starts[id] ?? 0) + 1;
    c.visited.push(id);
    for (const e of c.effects) if (e.trigger === 'start' && e.targetIds.includes(id)) emit(e, 'trigger', [id]);
  };
  const end = (id: string) => {
    for (const e of c.effects) {
      if (e.trigger === 'end' && e.targetIds.includes(id)) emit(e, 'trigger', [id]);
      if (e.anchorId === id && (c.starts[id] ?? 0) >= e.firstCountAt) {
        e.remaining--;
        if (e.notifyDuration) emit(e, e.remaining === 0 ? 'expired' : 'duration');
      }
    }
    c.effects = c.effects.filter(e => e.remaining > 0);
  };
  // Removed references retain their exact place in the order, without being selectable.
  const cleanGhosts = () => {
    for (const id of [...c.order]) {
      if (!c.participants[id]?.participating && id !== c.activeId && !c.effects.some(e => e.anchorId === id || e.sourceId === id)) {
        c.order = c.order.filter(x => x !== id);
        delete c.participants[id];
      }
    }
  };
  const advance = () => {
    requireThat(canAdvance(), 'Nenhum participante disponível. Inclua alguém ou permita turnos dos ocultos.');
    let beganRound = false;
    if (!c.started) {
      c.started = true; c.cycle = 1; c.round = Math.max(1, c.round); c.visited = []; beganRound = true;
    } else if (c.activeId) end(c.activeId);
    const oldId = c.activeId;
    let index = oldId ? c.order.indexOf(oldId) + 1 : 0;
    // At most one wrap is necessary because canAdvance() guarantees a selectable entry.
    for (let step = 0; step < c.order.length * 3 + 3; step++) {
      if (index >= c.order.length) {
        c.round++; c.cycle++; c.visited = []; index = 0; beganRound = true;
      }
      const id = c.order[index++];
      if (!id || c.visited.includes(id)) continue;
      start(id);
      if (isSelectable(id)) {
        focusId = state.settings.autoFocus ? id : null;
        cleanGhosts();
        if (beganRound) state.history.push(clone(c));
        return;
      }
      end(id);
    }
    throw new Error('Não foi possível encontrar o próximo turno.');
  };
  const placeByInitiative = (id: string) => {
    c.order = c.order.filter(x => x !== id);
    const n = c.participants[id].initiative;
    const at = c.order.findIndex(x => c.participants[x].initiative < n);
    c.order.splice(at < 0 ? c.order.length : at, 0, id);
  };
  switch (command.type) {
    case 'add': {
      requireThat(Array.isArray(command.participants) && command.participants.length > 0 && command.participants.length <= 100, 'Selecione entre 1 e 100 imagens.');
      for (const p of command.participants) {
        requireThat(string(p.id, 150) && p.id.length && string(p.name, 200) && Number.isFinite(p.initiative) && Math.abs(p.initiative) <= 99999, 'Nome ou iniciativa inválidos.');
        if (c.participants[p.id]?.participating) {
          c.participants[p.id].initiative = p.initiative;
          if(p.hidden!==undefined)c.participants[p.id].hidden=p.hidden;
          placeByInitiative(p.id);
        } else {
          c.participants[p.id] = { ...p, participating: true };
          placeByInitiative(p.id);
        }
        if (c.started && c.activeId && c.order.indexOf(p.id) < c.order.indexOf(c.activeId) && !c.visited.includes(p.id)) c.visited.push(p.id);
      }
      break;
    }
    case 'remove': {
      const p = c.participants[command.id];
      requireThat(p, 'Esse participante já foi removido.');
      p.participating = false;
      for (const e of c.effects) e.targetIds = e.targetIds.filter(x => x !== command.id);
      c.effects = c.effects.filter(e => e.targetIds.length > 0);
      // Retain current slot until the next transition so its neighbours are not skipped.
      cleanGhosts();
      if (!c.order.some(id => c.participants[id].participating)) c.activeId = null;
      break;
    }
    case 'initiative': {
      requireThat(c.participants[command.id], 'Participante não encontrado.');
      requireThat(Number.isFinite(command.value) && Math.abs(command.value) <= 99999, 'Digite uma iniciativa válida.');
      c.participants[command.id].initiative = command.value;
      if(command.hidden!==undefined)c.participants[command.id].hidden=command.hidden;
      placeByInitiative(command.id);
      break;
    }
    case 'alias': {
      requireThat(c.participants[command.id], 'Participante não encontrado.');
      requireThat(string(command.value, 100) && command.value.trim().length, 'Digite um nome de até 100 caracteres.');
      state.aliases[command.id] = command.value.trim();
      break;
    }
    case 'move': {
      requireThat(c.order.includes(command.id), 'Participante não encontrado.');
      requireThat(command.beforeId === null || c.order.includes(command.beforeId), 'Destino não encontrado.');
      if (command.beforeId === command.id) break;
      c.order = c.order.filter(x => x !== command.id);
      const at = command.beforeId ? c.order.indexOf(command.beforeId) : c.order.length;
      c.order.splice(at, 0, command.id);
      break;
    }
    case 'next': advance(); break;
    case 'nextRound': {
      if (!c.started) { advance(); break; }
      const oldCycle = c.cycle;
      const limit = c.order.length + 2;
      for (let i = 0; i < limit && c.cycle === oldCycle; i++) advance();
      break;
    }
    case 'previousRound': {
      requireThat(state.history.length > 1, 'Você já está na primeira rodada registrada.');
      state.history.pop();
      state.combat = clone(state.history.at(-1)!);
      c = state.combat;
      focusId = state.settings.autoFocus ? c.activeId : null;
      break;
    }
    case 'round': requireThat(integer(command.value), 'Digite uma rodada entre 1 e 99999.'); c.round = command.value; break;
    case 'effect': {
      const v = command.value;
      requireThat(string(v.id, 150) && v.id.length && string(v.name, 100) && v.name.trim().length && string(v.description, 5000) && string(v.message, 1200), 'Preencha nome e descrição com valores válidos.');
      requireThat(integer(v.remaining, 1) && v.remaining <= 999, 'A duração deve ser de 1 a 999 rodadas.');
      requireThat(c.participants[v.anchorId] && c.order.includes(v.anchorId), 'Escolha a referência da duração.');
      requireThat(v.sourceId === '' || c.participants[v.sourceId], 'Escolha quem aplicou o efeito ou Nenhum.');
      requireThat(['none','start','end'].includes(v.trigger) && ['gold','fire','blue','green','violet'].includes(v.tone), 'Configuração de efeito inválida.');
      requireThat(Array.isArray(v.targetIds) && v.targetIds.length > 0 && v.targetIds.every(id => c.participants[id]?.participating), 'Selecione ao menos um alvo presente na iniciativa.');
      requireThat(v.trigger === 'none' || v.message.trim().length, 'Escreva a mensagem do aviso.');
      const existing = c.effects.find(e => e.id === v.id);
      const effect: Effect = { ...v, name: v.name.trim(), targetIds: [...new Set(v.targetIds)],
        firstCountAt: existing?.anchorId === v.anchorId ? existing.firstCountAt : (c.starts[v.anchorId] ?? 0) + 1 };
      c.effects = c.effects.filter(e => e.id !== v.id);
      c.effects.push(effect);
      break;
    }
    case 'removeEffect': c.effects = c.effects.filter(e => e.id !== command.id); cleanGhosts(); break;
    case 'settings': {
      const v = command.value;
      if (v.showPortraits !== undefined) { requireThat(typeof v.showPortraits === 'boolean', 'Configuração inválida.'); state.settings.showPortraits = v.showPortraits; }
      if (v.autoFocus !== undefined) { requireThat(typeof v.autoFocus === 'boolean', 'Configuração inválida.'); state.settings.autoFocus = v.autoFocus; }
      if (v.skipHidden !== undefined) { requireThat(typeof v.skipHidden === 'boolean', 'Configuração inválida.'); state.settings.skipHidden = v.skipHidden; }
      if (v.zoom !== undefined) { requireThat(Number.isFinite(v.zoom) && v.zoom >= .25 && v.zoom <= 3, 'Zoom inválido.'); state.settings.zoom = v.zoom; }
      break;
    }
    case 'reset': state.combat = emptyCombat(); state.history = []; state.settings = defaults(); break;
    default: throw new Error('Ação desconhecida.');
  }
  // A round jump can emit more than 120 notices. Preserve the entire new batch
  // so connected clients receive every traversed activation and reduction.
  state.combat.log = state.combat.log.slice(-Math.max(120, notices.length));
  if (commandId) state.processed = [...state.processed, commandId].slice(-200);
  return { state, notices, focusId };
}

/** Reject corrupt/incompatible saves instead of silently overwriting them. */
export function readState(value: unknown): State {
  if (value === undefined || value === null) return initialState();
  const v = value as State;
  if (v.version !== 1 || !Number.isSafeInteger(v.revision) || !v.combat || !Array.isArray(v.combat.order) || !Array.isArray(v.combat.effects) || !Array.isArray(v.history) || !Array.isArray(v.processed) || !v.aliases || !v.settings) {
    throw new Error('Os dados desta cena não são compatíveis com esta versão. Eles foram preservados.');
  }
  const state = clone(v);
  state.settings = { ...defaults(), ...state.settings };
  return state;
}
