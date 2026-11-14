import OBR from '@owlbear-rodeo/sdk';
import { SceneClient } from './scene-client.ts';
import { initialState, readState, reduce } from './engine.ts';
import type { State, Command } from './engine.ts';
import type { TokenView } from './visibility.ts';
import { visibleNotice } from './visibility.ts';
import { CHANNEL, CONTEXT_KEY, validEnvelope } from './protocol.ts';
import type { CommandRequest } from './protocol.ts';
export interface Controller {
  demo:boolean; state:State; ready:boolean; gm:boolean; error:string; views:TokenView[];
  send(command:Command):Promise<void>; focus(id:string):Promise<void>;
  subscribe(callback:()=>void):void; context(callback:(ids:string[])=>void):void;
  start():Promise<void>; selected():Promise<string[]>;
  notify:(text:string)=>void; setDemoRole?:(gm:boolean)=>void;
}
export class OwlbearController implements Controller {
  demo=false; notify=(_text:string)=>{};
  private client=new SceneClient();private callbacks=new Set<()=>void>();
  private onContext=(ids:string[])=>{};private clientId=crypto.randomUUID();
  private pending=new Map<string,{resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>;retry:ReturnType<typeof setTimeout>}>();
  get state(){return this.client.state;}get ready(){return this.client.ready && Boolean(this.client.sceneId());}
  get gm(){return this.client.viewer.role==='GM';}get error(){return this.client.error;}
  get views(){return this.client.views();}
  subscribe(callback:()=>void){this.callbacks.add(callback);}
  context(callback:(ids:string[])=>void){this.onContext=callback;this.checkContext();}
  private checkContext(){
    if(!this.ready)return;
    const value=sessionStorage.getItem(CONTEXT_KEY);if(!value)return;
    sessionStorage.removeItem(CONTEXT_KEY);
    try{const c=JSON.parse(value);if(c.sceneId===this.client.sceneId() && Array.isArray(c.ids))this.onContext(c.ids);}catch{/* Ignore stale selection. */}
  }
  async start(){
    await new Promise<void>(resolve=>OBR.onReady(resolve));
    OBR.broadcast.onMessage(CHANNEL,event=>{
      const m=event.data;if(!validEnvelope(m))return;
      if(m.kind==='context')this.checkContext();
      if(m.kind==='ack' && m.clientId===this.clientId){
        const p=this.pending.get(m.requestId);if(!p)return;
        clearTimeout(p.timer);clearTimeout(p.retry);this.pending.delete(m.requestId);
        if(m.error)p.reject(new Error(m.error));else p.resolve();
      }
    });
    let generation=-1;
    this.client.onChange(()=>{
      if(generation!==this.client.generation){
        generation=this.client.generation;
        for(const p of this.pending.values()){clearTimeout(p.timer);clearTimeout(p.retry);p.reject(new Error('A cena mudou. Tente novamente.'));}this.pending.clear();
      }
      this.callbacks.forEach(fn=>fn());this.checkContext();
    });
    await this.client.init();
  }
  async send(command:Command):Promise<void>{
    if(!this.ready || this.error)throw new Error(this.error || 'Aguarde a conexão com a cena.');
    const request:CommandRequest={kind:'command',requestId:crypto.randomUUID(),clientId:this.clientId,sceneId:this.client.sceneId(),baseRevision:this.state.revision,command};
    await new Promise<void>((resolve,reject)=>{
      const transmit=()=>OBR.broadcast.sendMessage(CHANNEL,request,{destination:'ALL'}).catch(e=>{const p=this.pending.get(request.requestId);if(p){clearTimeout(p.timer);clearTimeout(p.retry);this.pending.delete(request.requestId);reject(e);}});
      const timer=setTimeout(()=>{const p=this.pending.get(request.requestId);if(p){clearTimeout(p.retry);this.pending.delete(request.requestId);reject(new Error('Não houve confirmação da sala. Confira a conexão e tente novamente.'));}},12000);
      const retry=setTimeout(()=>void transmit(),4000);
      this.pending.set(request.requestId,{resolve,reject,timer,retry});void transmit();
    });
  }
  async focus(id:string){await OBR.broadcast.sendMessage(CHANNEL,{kind:'focus',id,sceneId:this.client.sceneId(),requestId:crypto.randomUUID()},{destination:'ALL'});}
  async selected(){return (await OBR.player.getSelection())??[];}
}
const DEMO_KEY='initiative-effects-demo-v1'+(new URLSearchParams(location.search).get('demo')||'');
export class DemoController implements Controller {
  demo=true;ready=true;gm=true;error='';state=initialState();notify=(_text:string)=>{};
  private callbacks=new Set<()=>void>();
  private hidden=new Set(['oculto']);
  get views():TokenView[]{return this.state.combat.order.map((id,i)=>({id,name:this.state.combat.participants[id].name,position:{x:i*100,y:0},visible:this.gm || !this.hidden.has(id),hidden:this.hidden.has(id)}));}
  subscribe(callback:()=>void){this.callbacks.add(callback);}context(_callback:(ids:string[])=>void){}
  async start(){
    try{const saved=localStorage.getItem(DEMO_KEY);if(saved){this.state=readState(JSON.parse(saved));return;}}catch{this.notify('A prévia anterior não pôde ser aberta.');}
    this.state=reduce(initialState(),{type:'add',participants:[
      {id:'ana',name:'Ana',initiative:22},{id:'bruno',name:'Bruno',initiative:16},
      {id:'pedro',name:'Pedro',initiative:10},{id:'oculto',name:'Sentinela oculta',initiative:7}
    ]}).state;
  }
  async send(command:Command){
    const result=reduce(this.state,command,{hiddenIds:[...this.hidden]},crypto.randomUUID());
    this.state=result.state;localStorage.setItem(DEMO_KEY,JSON.stringify(this.state));
    this.callbacks.forEach(fn=>fn());
    const visible=new Set(this.views.filter(v=>v.visible).map(v=>v.id));
    for(const n of result.notices){const text=visibleNotice(n,this.state,visible,this.gm);if(text)this.notify(text);}
    if(result.focusId)await this.focus(result.focusId);
  }
  async focus(id:string){if(this.views.find(v=>v.id===id)?.visible)this.notify(`Foco em ${this.state.aliases[id] || this.state.combat.participants[id]?.name}. Na sala, a câmera dos participantes será centralizada.`);}
  async selected(){return [];}
  setDemoRole(gm:boolean){this.gm=gm;this.callbacks.forEach(fn=>fn());}
}
export function createController():Controller{return OBR.isAvailable ? new OwlbearController() : new DemoController();}
