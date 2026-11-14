/** Read-only adapter for standard items and Smoke & Spectre 5.x local geometry. */
import type { State, Notice } from './engine.ts';
import { displayName } from './engine.ts';
export const SMOKE = 'com.battle-system.smoke';
export const SPECTRE = 'com.battle-system.spectre';
export interface Point { x: number; y: number; }
export interface MapItem {
  id: string; type: string; name: string; visible: boolean; position: Point;
  rotation: number; scale: Point; metadata: Record<string, unknown>; createdUserId: string;
  attachedTo?: string; zIndex?: number; layer?: string; points?: Point[]; lightType?: string;
  attenuationRadius?: number; sourceRadius?: number; innerAngle?: number; outerAngle?: number;
  doubleSided?: boolean; width?: number; height?: number; shapeType?: string;
  style?: { fillOpacity?: number }; commands?: number[][];
}
export interface Viewer { id: string; role: 'GM' | 'PLAYER'; }
export interface TokenView { id: string; name: string; position: Point; visible: boolean; hidden: boolean; }
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const rotate = (p: Point, angle: number) => ({ x: p.x*Math.cos(angle)-p.y*Math.sin(angle), y: p.x*Math.sin(angle)+p.y*Math.cos(angle) });
export function worldPoint(p: Point, item: MapItem): Point {
  const r = rotate({ x: p.x * item.scale.x, y: p.y * item.scale.y }, item.rotation * Math.PI / 180);
  return { x: r.x + item.position.x, y: r.y + item.position.y };
}
function localPoint(p: Point, item: MapItem): Point {
  const r = rotate({ x: p.x-item.position.x, y: p.y-item.position.y }, -item.rotation * Math.PI / 180);
  return { x: r.x/(item.scale.x || 1), y: r.y/(item.scale.y || 1) };
}
export function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a,b,c), abD = cross(a,b,d), cdA = cross(c,d,a), cdB = cross(c,d,b);
  // Endpoint contact at the viewer is ignored. A wall at the target remains blocking.
  if (Math.hypot(a.x-c.x,a.y-c.y)<.01 || Math.hypot(a.x-d.x,a.y-d.y)<.01) return false;
  return Math.max(a.x,b.x)>=Math.min(c.x,d.x) && Math.max(c.x,d.x)>=Math.min(a.x,b.x)
    && Math.max(a.y,b.y)>=Math.min(c.y,d.y) && Math.max(c.y,d.y)>=Math.min(a.y,b.y)
    && abC*abD <= 0 && cdA*cdB <= 0;
}
function inPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
function covers(point: Point, item: MapItem): boolean {
  const p = localPoint(point,item);
  if (item.type==='SHAPE' && item.width && item.height) {
    if (item.shapeType==='CIRCLE') return ((p.x-item.width/2)/(item.width/2))**2 + ((p.y-item.height/2)/(item.height/2))**2<=1;
    return p.x>=0 && p.y>=0 && p.x<=item.width && p.y<=item.height;
  }
  if (item.points?.length) return inPolygon(p,item.points);
  // Polygonal fog paths. Unsupported curved paths are not used as a reveal source.
  if (item.commands?.length) return inPolygon(p,item.commands.filter(c=>c[0]===0 || c[0]===1).map(c=>({x:c[1],y:c[2]})));
  return false;
}
export function lineVisible(point: Point, light: MapItem, walls: MapItem[]): boolean {
  const radius = light.attenuationRadius ?? 0;
  const dx=point.x-light.position.x, dy=point.y-light.position.y;
  if (!light.visible || radius<=0 || Math.hypot(dx,dy)>radius) return false;
  // A conservative cone uses the fully lit angle; fade edges stay private.
  const cone = light.innerAngle ?? 360;
  if (cone<360 && Math.hypot(dx,dy)>.1) {
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    const delta=((angle-light.rotation+540)%360)-180;
    if (Math.abs(delta)>cone/2) return false;
  }
  for (const wall of walls) {
    if (!wall.visible || !wall.points) continue;
    const points=wall.points.map(p=>worldPoint(p,wall));
    for(let i=1;i<points.length;i++) if(intersects(light.position,point,points[i-1],points[i])) return false;
  }
  return true;
}
export function tokenViews(items: MapItem[], local: MapItem[], metadata: Record<string,unknown>, fogFilled: boolean, viewer: Viewer): TokenView[] {
  // Local walls/lights already contain the Smoke user's ownership/door/blindness selection.
  const scene = [...items, ...local];
  const lights = scene.filter(i=>i.type==='LIGHT' && i.lightType==='PRIMARY' && i.visible);
  const walls = scene.filter(i=>i.type==='WALL' && i.visible);
  const coversInFog = scene.filter(i=>i.layer==='FOG' && i.type!=='LIGHT' && i.type!=='WALL' && i.visible && (i.style?.fillOpacity ?? 1)>0);
  const disabled=metadata[`${SMOKE}/disableVision`]===true;
  return items.filter(i=>i.type==='IMAGE').map(item=>{
    const spectre=item.metadata[`${SPECTRE}/isSpectre`]===true;
    const viewers=item.metadata[`${SPECTRE}/spectreViewers`];
    const allowed=spectre && (Array.isArray(viewers) ? viewers.includes(viewer.id) : item.createdUserId===viewer.id);
    const hasOwnVision=lights.some(l=>l.attachedTo===item.id);
    const covered=coversInFog.some(f=>covers(item.position,f));
    const inVision=!disabled && lights.some(l=>lineVisible(item.position,l,walls));
    const inFog=(fogFilled && !inVision && !hasOwnVision) || covered;
    const visible=(item.visible || allowed) && !inFog;
    return { id:item.id, name:item.name || 'Sem nome', position:item.position,
      visible:viewer.role==='GM' || visible, hidden:!visible };
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
