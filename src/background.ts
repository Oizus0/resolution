import OBR from '@owlbear-rodeo/sdk';
import { SceneClient } from './scene-client.ts';
import { reduce, readState, navigation } from './engine.ts';
import { visibleNotice } from './visibility.ts';
import { NS, CHANNEL, STATE_KEY, ALIAS_KEY, CONTEXT_KEY, SCENE_KEY, leader, validEnvelope } from './protocol.ts';
import type { CommandRequest, WireMessage } from './protocol.ts';

const client=new SceneClient();
const seen=new Set<string>();
let seenGeneration=-1, lastRevision=-1, initializing=false, queue=Promise.resolve();
const allPeers=()=>[...client.peers.filter(p=>p.connectionId!==client.connectionId),{connectionId:client.connectionId,role:client.viewer.role}];
const isLeader=()=>leader(allPeers())===client.connectionId;
const send=(data:WireMessage,destination:'ALL'|'LOCAL'='ALL')=>OBR.broadcast.sendMessage(CHANNEL,data,{destination});
const reportError=(e:unknown)=>{console.error('[Iniciativa]',e);};

async function ensureScene() {
  if(!client.ready || client.sceneId() || !isLeader() || initializing || client.error) return;
  initializing=true;
  const generation=client.generation;
  try {
    const meta=await OBR.scene.getMetadata();
    if(generation!==client.generation || !isLeader()) return;
    if(!meta[SCENE_KEY]) await OBR.scene.setMetadata({[SCENE_KEY]:crypto.randomUUID()});
  } finally { initializing=false; }
}
async function focus(id:string) {
  if(!client.ready) return;
  const v=client.views().find(v=>v.id===id);
  if(!v?.visible) return;
  const [width,height,dpi]=await Promise.all([OBR.viewport.getWidth(),OBR.viewport.getHeight(),OBR.scene.grid.getDpi()]);
  // Keep at least eight grid cells around the token; repeated focusing never compounds zoom.
  const scale=Math.max(.08, Math.min(3, Math.min(width,height)/(dpi*8)*client.state.settings.zoom));
  await OBR.viewport.animateToBounds({center:v.position,width:width/scale,height:height/scale,
    min:{x:v.position.x-width/(2*scale),y:v.position.y-height/(2*scale)},
    max:{x:v.position.x+width/(2*scale),y:v.position.y+height/(2*scale)}});
}
async function process(request:CommandRequest, sender:string, generation:number) {
  if(!isLeader()) return;
  const ack=(error?:string)=>send({kind:'ack',requestId:request.requestId,clientId:request.clientId,...(error?{error}:{})});
  try {
    if(!client.ready || generation!==client.generation || request.sceneId!==client.sceneId()) throw new Error('A cena mudou. Abra a iniciativa novamente.');
    if(!allPeers().some(p=>p.connectionId===sender)) throw new Error('Participante desconectado.');
    const meta=await OBR.scene.getMetadata();
    if(generation!==client.generation || meta[SCENE_KEY]!==request.sceneId || !isLeader()) return;
    const before=readState(meta[STATE_KEY]);
    if(before.processed.includes(request.requestId)) {await ack();return;}
    if(navigation(request.command) && before.revision!==request.baseRevision) throw new Error('A lista foi atualizada por outra pessoa. Confira o turno e clique novamente.');
    const gm=allPeers().find(p=>p.connectionId===sender)?.role==='GM';
    if(!gm){
      if(request.command.type==='initiative')delete request.command.hidden;
      if(request.command.type==='add')for(const p of request.command.participants){delete p.hidden;if(before.combat.participants[p.id]?.hidden)throw new Error('Personagem oculto pelo mestre.');}
    }
    // Context-menu payloads are resolved against current scene images, using original image IDs.
    if(request.command.type==='add') {
      const images=await OBR.scene.items.getItems(i=>i.type==='IMAGE');
      request.command.participants=request.command.participants.map(p=>{
        const item=images.find(i=>i.id===p.id);
        if(!item) throw new Error('Uma das imagens não está mais nesta cena.');
        return {...p,name:item.name || 'Sem nome'};
      });
      for(const p of request.command.participants) {
        const alias=images.find(i=>i.id===p.id)?.metadata[ALIAS_KEY];
        if(typeof alias==='string' && !before.aliases[p.id]) before.aliases[p.id]=alias;
      }
    }
    const result=reduce(before,request.command,{},request.requestId);
    if(generation!==client.generation || !isLeader()) return;
    await OBR.scene.setMetadata({[STATE_KEY]:result.state});
    await ack();
    if(request.command.type==='alias') {
      const {id,value}=request.command;
      // Display aliases are separate from combat data and from Owlbear's actual image name.
      await OBR.scene.items.updateItems([id],items=>{for(const item of items)item.metadata[ALIAS_KEY]=value.trim();}).catch(reportError);
    }
    if(result.focusId) await send({kind:'focus',id:result.focusId,sceneId:request.sceneId,requestId:request.requestId});
  } catch(e) { await ack(e instanceof Error?e.message:'Não foi possível salvar a alteração.'); }
}
function changed() {
  if(client.generation!==seenGeneration) {seenGeneration=client.generation;lastRevision=-1;seen.clear();}
  if(!client.ready) return;
  void ensureScene().catch(reportError);
  if(lastRevision<0) lastRevision=client.state.revision;
  else if(client.state.revision>lastRevision) {
    const previous=lastRevision;lastRevision=client.state.revision;
    const ids=new Set(client.views().filter(v=>v.visible).map(v=>v.id));
    const messages=client.state.combat.log.filter(n=>Number(n.id.split(':')[0])>previous).map(n=>visibleNotice(n,client.state,ids,client.viewer.role==='GM')).filter((s):s is string=>Boolean(s));
    // One notification per transition, preserving every effect line when skipping a round.
    if(messages.length) void OBR.notification.show(messages.join('\n'),'INFO').catch(reportError);
  }
}
async function context() {
  await OBR.contextMenu.create({id:`${NS}/initiative`,icons:[{icon:new URL(`${import.meta.env.BASE_URL}icon.svg`,location.href).href,label:'Iniciativa',filter:{every:[{key:'type',value:'IMAGE'}]}}],
    async onClick(ctx) {
      const ids=ctx.items.map(i=>i.id);
      sessionStorage.setItem(CONTEXT_KEY,JSON.stringify({ids,sceneId:client.sceneId(),nonce:crypto.randomUUID()}));
      await OBR.action.open();
      await send({kind:'context'},'LOCAL');
    }
  });
}
if(OBR.isAvailable) OBR.onReady(async()=>{
  try {
    OBR.broadcast.onMessage(CHANNEL,event=>{
      const message=event.data;
      if(!validEnvelope(message)) return;
      if(message.kind==='command') {
        if(!message.command || typeof message.requestId!=='string' || typeof message.clientId!=='string') return;
        const generation=client.generation;
        queue=queue.then(()=>process(message,event.connectionId,generation)).catch(reportError);

      } else if(message.kind==='focus' && message.sceneId===client.sceneId() && !seen.has(message.requestId)) {
        seen.add(message.requestId); if(seen.size>500)seen.delete(seen.values().next().value!);
        void focus(message.id).catch(reportError);
      }
    });
    client.onChange(changed);
    await client.init(); await context(); changed();
    // Refresh reports without writing heartbeat data to the scene.
    setInterval(()=>{void ensureScene().catch(reportError);},5000);
    // A removed map item becomes an inactive reference; history can still restore its combat data.
    let removing=false;
    setInterval(async()=>{
      if(removing || !client.ready || !isLeader() || client.error) return;
      const missing=Object.values(client.state.combat.participants).filter(p=>p.participating && !client.items.some(i=>i.id===p.id));
      if(!missing.length) return;
      removing=true;
      try {
        const generation=client.generation,sceneId=client.sceneId();
        for(const p of missing){
          queue=queue.then(()=>process({kind:'command',clientId:'cleanup',requestId:crypto.randomUUID(),sceneId,baseRevision:client.state.revision,command:{type:'remove',id:p.id}},client.connectionId,generation)).catch(reportError);
        }
        await queue;
      }
      finally{removing=false;}
    },2000);
  } catch(e) {reportError(e);await OBR.notification.show('Iniciativa: não foi possível conectar. Recarregue a extensão.','ERROR');}
});
