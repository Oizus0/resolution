import OBR from '@owlbear-rodeo/sdk';
import type { Item, Player } from '@owlbear-rodeo/sdk';
import { readState, initialState } from './engine.ts';
import type { State } from './engine.ts';
import { tokenViews } from './visibility.ts';
import type { MapItem, TokenView, Viewer } from './visibility.ts';
import { STATE_KEY, SCENE_KEY } from './protocol.ts';

export class SceneClient {
  state: State = initialState();
  metadata: Record<string, unknown> = {};
  items: Item[] = []; local: Item[] = []; fogFilled = false;
  viewer: Viewer = { id: '', role: 'PLAYER' };
  connectionId = ''; peers: Player[] = []; ready = false; error = ''; generation = 0;
  private listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  sceneId(): string { return typeof this.metadata[SCENE_KEY]==='string' ? this.metadata[SCENE_KEY] as string : ''; }
  views(): TokenView[] { return tokenViews(this.items as MapItem[], this.local as MapItem[], this.metadata, this.fogFilled, this.viewer); }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(fn=>fn()); }
  private metadataChanged(metadata: Record<string,unknown>) {
    this.metadata=metadata;
    try { this.state=readState(metadata[STATE_KEY]); this.error=''; }
    catch(e) { this.error=String((e as Error).message); }
    this.emit();
  }
  async init(): Promise<void> {
    const [id,role,connectionId,peers]=await Promise.all([OBR.player.getId(),OBR.player.getRole(),OBR.player.getConnectionId(),OBR.party.getPlayers()]);
    this.viewer={id,role}; this.connectionId=connectionId; this.peers=peers;
    OBR.player.onChange(p=>{this.viewer={id:p.id,role:p.role};this.connectionId=p.connectionId;this.emit();});
    OBR.party.onChange(p=>{this.peers=p;this.emit();});
    OBR.scene.onReadyChange(ready=>{void this.load(ready).catch(e=>{this.error=String(e);this.emit();});});
    await this.load(await OBR.scene.isReady());
  }
  async load(ready: boolean): Promise<void> {
    const generation=++this.generation;
    this.stops.forEach(stop=>stop()); this.stops=[];
    this.ready=false; this.items=[]; this.local=[]; this.metadata={}; this.state=initialState(); this.emit();
    if(!ready) return;
    this.stops.push(
      OBR.scene.items.onChange(items=>{if(generation===this.generation){this.items=items;this.emit();}}),
      OBR.scene.local.onChange(items=>{if(generation===this.generation){this.local=items;this.emit();}}),
      OBR.scene.fog.onChange(fog=>{if(generation===this.generation){this.fogFilled=fog.filled;this.emit();}}),
      OBR.scene.onMetadataChange(meta=>{if(generation===this.generation)this.metadataChanged(meta);})
    );
    const [items,local,filled,metadata]=await Promise.all([OBR.scene.items.getItems(),OBR.scene.local.getItems(),OBR.scene.fog.getFilled(),OBR.scene.getMetadata()]);
    if(generation!==this.generation) return;
    this.items=items;this.local=local;this.fogFilled=filled;this.ready=true;this.metadataChanged(metadata);
  }
}
