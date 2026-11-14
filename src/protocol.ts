import type { Command } from './engine.ts';
export const NS = 'br.iniciativa-efeitos.v1';
export const STATE_KEY = `${NS}/state`;
export const ALIAS_KEY = `${NS}/name`;
export const CHANNEL = `${NS}/messages`;
export const CONTEXT_KEY = `${NS}/context`;
export const SCENE_KEY = `${NS}/scene`;
export interface CommandRequest {
  kind: 'command'; requestId: string; clientId: string; sceneId: string;
  baseRevision: number; command: Command;
}
export interface Ack { kind: 'ack'; requestId: string; clientId: string; error?: string; }
export type WireMessage = CommandRequest | Ack
  | { kind: 'focus'; id: string; sceneId: string; requestId: string }
  | { kind: 'context' }
  | { kind: 'vision'; ids: string[]; sceneId: string; playerId: string }
  | { kind: 'ping' };
export interface Peer { connectionId: string; role: 'GM'|'PLAYER'; }
export function leader(peers: Peer[]): string | undefined {
  return [...peers].sort((a,b)=>(a.role===b.role ? a.connectionId.localeCompare(b.connectionId) : a.role==='GM' ? -1 : 1))[0]?.connectionId;
}
export function validEnvelope(v: unknown): v is WireMessage {
  if(!v || typeof v!=='object') return false;
  const x=v as WireMessage;
  return ['command','ack','focus','context','vision','ping'].includes(x.kind);
}
