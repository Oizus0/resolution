import { CHANNEL, SCENE_KEY, STATE_KEY, ALIAS_KEY } from '../src/protocol.ts';
import type { WireMessage, CommandRequest } from '../src/protocol.ts';
import type { Command, State } from '../src/engine.ts';
type Person={id:string;connectionId:string;role:'GM'|'PLAYER';name:string};
const gm:Person={id:'gm',connectionId:'gm-conn',role:'GM',name:'Mestre'};
const player:Person={id:'player',connectionId:'player-conn',role:'PLAYER',name:'Jogador'};
let people=[gm,player];
let metadata:Record<string,unknown>={};
let frames:{element:HTMLIFrameElement;person:Person;channels:Set<string>}[]=[];
let notifications:{person:string;message:string}[]=[], focuses:string[]=[], menus:unknown[]=[];
const pending=new Map<string,(ack:WireMessage)=>void>();
let unsupported=new Set<string>();
const testPortrait=(id:string)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="'+(id==='ana'?'#624852':id==='bruno'?'#3a5369':'#526146')+'"/><path d="M8 80Q9 48 40 48Q71 48 72 80" fill="#253347"/><ellipse cx="40" cy="32" rx="19" ry="23" fill="#d7ad89"/><path d="M19 35Q10 1 40 3Q69 0 61 35L52 18L32 25L21 22Z" fill="#302b32"/><path d="M31 35h4m10 0h4" stroke="#332c30" stroke-width="3"/><path d="M34 46q6 4 12 0" fill="none" stroke="#8b5f53" stroke-width="2"/></svg>');
const item=(id:string,name:string,layer='CHARACTER',visible=true)=>({id,name,image:{url:testPortrait(id),mime:'image/svg+xml',width:80,height:80},type:'IMAGE',visible,layer,position:{x:100,y:100},rotation:0,scale:{x:1,y:1},metadata:{} as Record<string,unknown>,createdUserId:'gm'});
let items=[item('ana','Ana','PROP'),item('bruno','Bruno','MAP'),item('pedro','Pedro'),item('oculto','Segredo','ATTACHMENT',false)];
function publish(id:string,data:unknown){for(const f of frames)f.element.contentWindow?.postMessage({id,data},location.origin);}
function wire(message:WireMessage,person:Person){
  if(message.kind==='ack')pending.get(message.requestId)?.(message);
  for(const f of frames)if(f.channels.has(CHANNEL))f.element.contentWindow?.postMessage({id:`OBR_BROADCAST_MESSAGE_${CHANNEL}`,data:{connectionId:person.connectionId,data:message}},location.origin);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const f=frames.find(f=>f.element.contentWindow===event.source);if(!f)return;
  const {id,data,nonce}=event.data??{};if(typeof id!=='string'||!id.startsWith('OBR_'))return;
  let result:unknown={};
  switch(id){
    case 'OBR_PLAYER_GET_ID':result={id:f.person.id};break;
    case 'OBR_PLAYER_GET_ROLE':result={role:f.person.role};break;
    case 'OBR_PLAYER_GET_CONNECTION_ID':result={connectionId:f.person.connectionId};break;
    case 'OBR_PARTY_GET_PLAYERS':result={players:people.filter(p=>p.id!==f.person.id)};break;
    case 'OBR_SCENE_IS_READY':result={ready:true};break;
    case 'OBR_SCENE_GET_METADATA':result={metadata};break;
    case 'OBR_SCENE_SET_METADATA':metadata={...metadata,...data.update};publish('OBR_SCENE_METADATA_EVENT_CHANGE',{metadata});break;
    case 'OBR_SCENE_ITEMS_GET_ALL_ITEMS':result={items};break;
    case 'OBR_SCENE_ITEMS_GET_ITEMS':result={items:items.filter(i=>data.ids.includes(i.id))};break;
    case 'OBR_SCENE_LOCAL_GET_ALL_ITEMS':result={items:[]};break;
    case 'OBR_SCENE_FOG_GET_FILLED':result={filled:false};break;
    case 'OBR_SCENE_ITEMS_UPDATE_ITEMS':items=items.map(i=>({...i,...data.updates.find((u:{id:string})=>u.id===i.id)}));publish('OBR_SCENE_ITEMS_EVENT_CHANGE',{items});break;
    case 'OBR_BROADCAST_SUBSCRIBE':f.channels.add(data.channel);break;
    case 'OBR_BROADCAST_UNSUBSCRIBE':f.channels.delete(data.channel);break;
    case 'OBR_BROADCAST_SEND_MESSAGE': {
      if(data.data.kind==='ack')pending.get(data.data.requestId)?.(data.data);
      for(const t of frames){const local=t.person.id===f.person.id;if(t.channels.has(data.channel) && (data.options?.destination==='ALL' || (data.options?.destination==='LOCAL'?local:!local)))t.element.contentWindow?.postMessage({id:`OBR_BROADCAST_MESSAGE_${data.channel}`,data:{data:data.data,connectionId:f.person.connectionId}},location.origin);}
      break;
    }
    case 'OBR_CONTEXT_MENU_CREATE':menus.push(data);break;
    case 'OBR_NOTIFICATION_SHOW':notifications.push({person:f.person.id,message:data.message});result={id:crypto.randomUUID()};break;
    case 'OBR_VIEWPORT_GET_WIDTH':result={width:1200};break;
    case 'OBR_VIEWPORT_GET_HEIGHT':result={height:800};break;
    case 'OBR_SCENE_GRID_GET_DPI':result={dpi:100};break;
    case 'OBR_VIEWPORT_ANIMATE_TO_BOUNDS':focuses.push(f.person.id);break;
    default:if(!id.includes('SUBSCRIBE'))unsupported.add(id);
  }
  if(nonce)f.element.contentWindow?.postMessage({id:`${id}_RESPONSE${nonce}`,data:result},location.origin);
});
const wait=async(check:()=>boolean,message='A operação não terminou.')=>{
  const start=Date.now();while(!check()){if(Date.now()-start>6000)throw new Error(message);await new Promise(r=>setTimeout(r,25));}
};
async function frame(person:Person,panel=false){
  const element=document.createElement('iframe');
  if(panel){element.style.cssText='width:388px;height:592px;position:relative;display:block;border:1px solid #52616c;border-radius:8px;margin-top:12px;background:#111';if(new URLSearchParams(location.search).has('visual')){element.style.background='linear-gradient(135deg,#304037,#202e40 55%,#493b2a)';element.style.width='min(480px,100%)';element.style.height='592px';element.style.boxShadow='0 12px 45px #0007';}element.title='Painel de teste';}
  element.src=`/${panel?'index':'background'}.html?obrref=${encodeURIComponent(btoa(`${location.origin} simulated-room`))}`;
  const f={element,person,channels:new Set<string>()};frames.push(f);
  const loaded=new Promise<void>(resolve=>element.addEventListener('load',()=>{
    element.contentWindow!.postMessage({id:'OBR_READY',data:{ref:person.connectionId,userId:person.id}},location.origin);resolve();},{once:true}));
  document.body.append(element);await loaded;
}
const state=()=>metadata[STATE_KEY] as State;
async function command(command:Command,who=player,revision=state()?.revision??0,requestId=crypto.randomUUID()){
  const message:CommandRequest={kind:'command',command,clientId:'test',requestId,sceneId:metadata[SCENE_KEY] as string,baseRevision:revision};
  let ack:WireMessage|undefined;
  pending.set(requestId,result=>{ack=result;});wire(message,who);
  await wait(()=>Boolean(ack),'Sem confirmação do coordenador.');pending.delete(requestId);
  if(ack!.kind==='ack'&&ack!.error)throw new Error(ack!.error);
  return requestId;
}
function expect(condition:unknown,message:string){if(!condition)throw new Error(message);}
const runButton=document.querySelector<HTMLButtonElement>('#run')!;
runButton.addEventListener('click',async()=>{
  runButton.disabled=true;document.querySelector('#results')!.innerHTML='';
  const record=(label:string,error?:unknown)=>{const li=document.createElement('li');li.className=error?'fail':'ok';li.textContent=(error?'FALHOU — ':'PASSOU — ')+label+(error?': '+String(error):'');document.querySelector('#results')!.append(li);};
  const check=async(label:string,action:()=>Promise<void>)=>{try{await action();record(label);}catch(e){record(label,e);throw e;}};
  try{
    frames.forEach(f=>f.element.remove());frames=[];metadata={};notifications=[];focuses=[];menus=[];unsupported=new Set();people=[gm,player];
    await frame(gm);await frame(player);
    await check('SDK real conecta dois participantes e registra o menu para imagens em qualquer camada',async()=>{
      await wait(()=>Boolean(metadata[SCENE_KEY])&&menus.length===2);
      const text=JSON.stringify(menus);expect(text.includes('IMAGE')&&!text.includes('CHARACTER'),'O menu restringiu a camada.');
    });
    await check('Jogador adiciona imagens de camadas diferentes; preparação não inicia turnos',async()=>{
      await command({type:'add',participants:items.map((i,n)=>({id:i.id,name:i.name,initiative:22-n*6}))});
      expect(!state().combat.started && state().combat.order.length===4,'Estado inicial incorreto.');
    });
    await check('Dois cliques simultâneos não avançam dois turnos',async()=>{
      const revision=state().revision;
      const results=await Promise.allSettled([command({type:'next'},player,revision),command({type:'next'},gm,revision)]);
      expect(results.filter(r=>r.status==='fulfilled').length===1,'Os dois cliques foram aplicados.');
      expect(state().combat.activeId==='ana','O primeiro turno foi pulado.');
    });
    await check('Duração compartilhada e notificações chegam uma vez a cada participante com painéis fechados',async()=>{
      await command({type:'effect',value:{id:'fire',name:'Queimadura',description:'Teste',sourceId:'ana',anchorId:'ana',targetIds:['bruno','oculto'],remaining:3,trigger:'start',message:'Aviso de dano.',tone:'fire',notifyDuration:true}});
      const count=notifications.length;await command({type:'next'});
      await wait(()=>notifications.length===count+2);
      expect(state().combat.effects[0].remaining===3,'Descontou o turno de aplicação.');
      expect(notifications.slice(count).every(n=>n.message.includes('Bruno')),'Aviso errado.');
    });
    await check('O turno oculto avisa o mestre sem vazar o nome ao jogador',async()=>{
      await command({type:'next'});const count=notifications.length;await command({type:'next'});
      await wait(()=>notifications.length>count);
      expect(notifications.slice(count).every(n=>n.person==='gm'),'Vazou aviso de alvo oculto.');
    });
    await check('Volta de rodada restaura o estado inicial sem repetir avisos antigos',async()=>{
      await command({type:'next'});expect(state().combat.round===2,'Não avançou a rodada.');
      const count=notifications.length;await command({type:'previousRound'});
      expect(state().combat.round===1&&state().combat.effects.length===0,'Histórico não restaurado.');
      expect(notifications.length===count,'Repetiu avisos antigos.');
    });
    await check('Reenvio da mesma ação é idempotente',async()=>{
      const requestId=await command({type:'next'});const revision=state().revision;
      await command({type:'next'},player,revision,requestId);expect(state().revision===revision,'Processou a mesma ação duas vezes.');
    });
    await check('Foco global respeita a visibilidade individual',async()=>{
      wire({kind:'focus',id:'bruno',sceneId:metadata[SCENE_KEY] as string,requestId:crypto.randomUUID()},player);
      await wait(()=>focuses.length===2);
      wire({kind:'focus',id:'oculto',sceneId:metadata[SCENE_KEY] as string,requestId:crypto.randomUUID()},gm);
      await wait(()=>focuses.length===3);expect(focuses.at(-1)==='gm','Jogador focou alvo oculto.');
    });
    await check('Nomes persistem separadamente na imagem e sobrevivem ao reinício',async()=>{
      await command({type:'alias',id:'ana',value:'Ana Solar'});await wait(()=>items[0].metadata[ALIAS_KEY]==='Ana Solar');
      await command({type:'reset'});expect(state().aliases.ana==='Ana Solar'&&state().combat.order.length===0,'Reset apagou o nome ou manteve o combate.');
    });
    await check('A saída do mestre transfere a coordenação ao jogador',async()=>{
      const f=frames.find(f=>f.person.id==='gm')!;f.element.remove();frames=frames.filter(x=>x!==f);people=[player];
      publish('OBR_PARTY_EVENT_CHANGE',{players:[]});
      await command({type:'add',participants:[{id:'bruno',name:'Bruno',initiative:16}]});
      expect(state().combat.order.includes('bruno'),'O jogador não assumiu a coordenação.');
    });
    await check('Nenhuma API usada pelo aplicativo ficou sem resposta no simulador',async()=>expect(!unsupported.size,[...unsupported].join(', ')));
    document.title='11 testes de integração passaram';
    document.querySelector<HTMLButtonElement>('#panel')!.disabled=false;
  }catch{document.title='Falha nos testes de integração';}
  finally{runButton.disabled=false;}
});

document.querySelector('#panel')!.addEventListener('click',async()=>{
  try {
    await command({type:'add',participants:[{id:'ana',name:'Ana',initiative:22},{id:'pedro',name:'Pedro',initiative:10}]});
    await command({type:'alias',id:'ana',value:'Lymna ATO II Token'});
    await command({type:'alias',id:'bruno',value:'Maliah'});
    await command({type:'next'});
    await frame(player,true);
  }catch(e){document.querySelector('#results')!.append(String(e));}
});
