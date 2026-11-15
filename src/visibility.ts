import type { State, Notice } from './engine.ts';
import { displayName } from './engine.ts';
export interface Point { x: number; y: number; }
export interface MapItem {
  id: string; type: string; name: string; visible: boolean; position: Point;
  rotation: number; scale: Point; metadata: Record<string, unknown>; createdUserId: string;
  attachedTo?: string; zIndex?: number; layer?: string; points?: Point[]; lightType?: string;
  attenuationRadius?: number; sourceRadius?: number; innerAngle?: number; outerAngle?: number;
  doubleSided?: boolean; width?: number; height?: number; shapeType?: string;
  style?: { fillOpacity?: number }; commands?: number[][];
  image?: { url: string; mime?: string };
}
export interface Viewer { id: string; role: 'GM' | 'PLAYER'; }
export interface TokenView { id: string; name: string; position: Point; visible: boolean; hidden: boolean; portraitUrl?: string; }
export function tokenViews(items: MapItem[], participants: State['combat']['participants'], viewer: Viewer): TokenView[] {
  return items.filter(i=>i.type==='IMAGE').map(item=>{
    const hidden=participants[item.id]?.hidden===true;
    const visible=viewer.role==='GM'||!hidden;
    const url=item.image?.url;
    const portraitUrl=visible && typeof url==='string' && /^(https?:\/\/|blob:|data:image\/)/i.test(url)?url:undefined;
    return {id:item.id,name:item.name||'Sem nome',position:item.position,hidden,visible,portraitUrl};
  });
}
export function visibleNotice(n: Notice, state: State, visibleIds: Set<string>, gm: boolean): string | null {
  const targets=n.targetIds.filter(id=>gm || visibleIds.has(id));
  if(!targets.length) return null;
  const names=targets.map(id=>displayName(state,id)).join(', ');
  if(n.kind==='trigger') return `${names} · ${n.name}: ${n.message}`;
  if(n.kind==='expired') return `${n.name} terminou · ${names}.`;
  return `${n.name} · ${names}: ${n.remaining} ${n.remaining===1?'rodada restante':'rodadas restantes'}.`;
}
