import './style.css';
import './compact.css';
import { createController } from './controller.ts';
import type { Command, Effect, EffectInput, Tone, Trigger } from './engine.ts';
import { displayName } from './engine.ts';
import { visibleNotice } from './visibility.ts';
import { icon } from './icons.ts';

const controller=createController();
const app=document.querySelector<HTMLDivElement>('#app')!;
const modalRoot=document.querySelector<HTMLDivElement>('#modal-root')!;
const expanded=new Set<string>();
let showHidden=false,showLog=false,busy=false,dragged:string|null=null;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let visibleIds=new Set<string>();
let portraitUrls=new Map<string,string>();
const safeIds=()=>visibleIds;
const visible=(id:string)=>controller.gm || safeIds().has(id);
const name=(id:string)=>visible(id)?displayName(controller.state,id):'Personagem oculto';
const related=(id:string)=>controller.state.combat.effects.filter(e=>(e.targetIds.includes(id)||e.sourceId===id||e.anchorId===id) && (controller.gm || e.targetIds.some(visible)));
const button=(action:string,label:string,glyph:string,id='',extra='')=>`<button class="icon-button" data-action="${action}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(glyph)}</button>`;
const options=(selected:string,includeGhosts=false)=>controller.state.combat.order
  .filter(id=>includeGhosts || controller.state.combat.participants[id]?.participating)
  .filter(id=>visible(id)||id===selected)
  .map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(name(id))}${!controller.state.combat.participants[id]?.participating?' · referência preservada':''}</option>`).join('');

function toast(message:string){
  const box=document.createElement('div');box.className='toast';box.textContent=message;
  document.querySelector('#toasts')!.append(box);
  setTimeout(()=>box.remove(),Math.min(18000,Math.max(6000,message.length*45)));
}
controller.notify=toast;
async function perform(command:Command){
  if(busy)return;
  busy=true;render();
  try{await controller.send(command);}catch(e){toast(e instanceof Error?e.message:String(e));}
  finally{busy=false;render();}
}
function effectCard(e:Effect){
  return `<article class="effect-card tone-${e.tone}">
    <div class="effect-top"><span class="effect-symbol">${icon(e.trigger==='none'?'shield':'spark')}</span><strong>${esc(e.name)}</strong><span class="duration">${e.remaining} ${e.remaining===1?'rodada':'rodadas'}</span></div>
    <p class="effect-description">${esc(e.description)}</p>
    <div class="effect-meta">${icon('clock')} <span>Conta no final do turno de <b>${esc(name(e.anchorId))}</b>.</span></div>
    ${e.trigger!=='none'?`<div class="effect-meta">${icon('spark')} <span>${e.trigger==='start'?'Início':'Final'} do turno: ${esc(e.message)}</span></div>`:''}
    <div class="effect-bottom"><span>${e.sourceId?'Aplicado por '+esc(name(e.sourceId)):''}</span><div>${button('edit-effect','Editar '+e.name,'edit',e.id)}${button('remove-effect','Remover '+e.name,'trash',e.id)}</div></div>
  </article>`;
}
function referenceLine(e:Effect,id:string){
  const targets=e.targetIds.filter(visible).map(name).join(', ');
  const applied=e.sourceId===id;
  const text=applied ? 'Aplicou '+e.name+' em '+targets : 'Conta '+e.name+' no fim do turno · afeta '+targets;
  const detail=e.anchorId===id?'Conta no final deste turno': 'Conta no final do turno de '+name(e.anchorId);
  return `<button class="effect-reference" data-action="edit-effect" data-id="${esc(e.id)}" title="${esc(detail+' · '+e.remaining+' rodadas')}" aria-label="${esc(text+'. '+detail)}">${icon(applied?'arrow':'clock')}<span>${esc(text)}</span>${e.anchorId===id && applied?icon('clock'):''}<small>${e.remaining}r</small></button>`;
}
function row(id:string,hidden=false){
  const c=controller.state.combat,p=c.participants[id],active=c.activeId===id;
  const effects=related(id),received=effects.filter(e=>e.targetIds.includes(id)),references=effects.filter(e=>!e.targetIds.includes(id));
  const portrait=portraitUrls.get(id);
  const portraitName='Imagem de '+name(id);
  const tooltip=received.length?received.map(e=>`${e.name} · ${e.remaining} rodadas\n${e.description}\nContagem: ${name(e.anchorId)}`).join('\n\n'):'Adicionar ou consultar efeitos';
  return `<li class="participant ${active?'is-active':''} ${hidden?'is-hidden':''}" data-row="${esc(id)}">
    <div class="participant-main">
      <button class="drag-handle" draggable="true" data-drag="${esc(id)}" data-action="reorder" data-id="${esc(id)}" title="Arrastar para reordenar" aria-label="Mover ${esc(name(id))}">${icon('grip')}</button>
      ${button('remove','Remover '+name(id)+' da iniciativa','close',id)}
      ${controller.state.settings.showPortraits!==false?`<span class="token-portrait" role="img" aria-label="${esc(portraitName)}" title="${esc(portraitName)}">${icon('shield')}${portrait?`<img src="${esc(portrait)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</span>`:''}
      <div class="participant-label"><button class="name-button" data-action="focus" data-id="${esc(id)}" title="Focar ${esc(name(id))} no mapa de todos">${esc(name(id))}</button>
        <span class="row-status">${active?'Em seu turno':hidden?'Oculto para jogadores':c.started&&c.visited.includes(id)?'Já agiu nesta rodada':'Aguardando'}${received.length?` · ${received.length} ${received.length===1?'efeito':'efeitos'}`:''}</span></div>
      <button class="effects-marker ${received.length?'has-effects':''}" data-action="effects" data-id="${esc(id)}" title="${esc(tooltip)}" aria-label="Efeitos de ${esc(name(id))}" aria-expanded="${expanded.has(id)}">${icon('spark')}${received.length?`<span>${received.length}</span>`:''}</button>
      ${button('rename','Editar nome de '+name(id),'edit',id)}
      <button class="initiative-number" data-action="initiative" data-id="${esc(id)}" aria-label="Editar iniciativa de ${esc(name(id))}: ${p.initiative}">${p.initiative}</button>
    </div>
    ${references.map(e=>referenceLine(e,id)).join('')}
    ${expanded.has(id)?`<div class="effects-drawer">${received.map(e=>effectCard(e)).join('') || '<p class="muted empty-effects">Nenhum efeito recebido.</p>'}<button class="add-effect-inline" data-action="add-effect" data-id="${esc(id)}">${icon('plus')} Adicionar efeito</button></div>`:''}
  </li>`;
}
function render(){
  const oldScroll=app.querySelector('.list-area')?.scrollTop??0;
  const state=controller.state,c=state.combat;
  const sceneViews=controller.views;
  visibleIds=new Set(sceneViews.filter(v=>v.visible).map(v=>v.id));
  portraitUrls=new Map(sceneViews.filter(v=>v.visible && v.portraitUrl).map(v=>[v.id,v.portraitUrl!]));
  const views=new Map(sceneViews.map(v=>[v.id,v]));
  const listed=c.order.filter(id=>c.participants[id]?.participating && visible(id));
  const hidden=listed.filter(id=>views.get(id)?.hidden);
  const shown=listed.filter(id=>!controller.gm || !views.get(id)?.hidden);
  const visibleEffects=c.effects.filter(e=>e.targetIds.some(visible));
  const log=c.log.map(n=>({n,text:visibleNotice(n,state,safeIds(),controller.gm)})).filter(x=>x.text).reverse();
  document.body.classList.toggle('demo',controller.demo);
  app.innerHTML=`${controller.demo?`<div class="demo-label"><span class="status-dot"></span> PRÉVIA INTERATIVA <button data-action="role">${controller.gm?'Visão do mestre':'Visão de jogador'} ${icon('eye')}</button></div>`:''}
  <section class="tracker" aria-label="Iniciativa e efeitos">
    <header class="app-header"><div class="brand-mark" title="Iniciativa">${icon('spark')}</div>
    <section class="turn-control" aria-label="Controle de rodadas">
      <div class="round-navigation">${button('previous-round','Voltar ao início da rodada anterior','back','',state.history.length<2||busy?'disabled':'')}
      <button class="round-label" data-action="round" title="Editar apenas o número da rodada"><strong>${c.round}<sup>ª</sup> Rodada<span class="period">.</span></strong></button>
      ${button('next-round','Avançar até o início da próxima rodada','arrow','',!c.order.length||busy?'disabled':'')}</div>
      <button class="primary next-turn" data-action="next" aria-label="${c.started?'Próximo turno':'Iniciar primeiro turno'}" title="${c.started?'Próximo turno · Alt + →':'Iniciar combate'}" ${busy||!c.order.some(id=>c.participants[id]?.participating)||!controller.ready||controller.error?'disabled':''}>${icon(c.started?'next':'play')}<span>${busy?'Salvando…':c.started?'Próximo':'Iniciar'}</span>${c.started?'<kbd title="Alt + seta para a direita">Alt →</kbd>':''}</button>
    </section>
    ${button('settings','Configurações','gear')}</header>
    ${controller.error?`<div class="error-banner" role="alert">${esc(controller.error)}</div>`:''}
    <div class="list-heading"><span>ORDEM DE COMBATE <b>${shown.length}</b></span><button class="text-button" data-action="add">${icon('plus')} Adicionar</button></div>
    <div class="list-area"><ol class="participants" aria-label="Ordem de iniciativa">${shown.map(id=>row(id)).join('')}</ol>
      ${!listed.length?`<div class="empty-state"><div class="empty-symbol">${icon('shield')}</div><h2>${controller.ready?'A mesa está pronta.':'Abra uma cena no Owlbear.'}</h2><p>${controller.ready?'Selecione uma imagem no mapa e escolha “Iniciativa”, ou adicione por aqui.':'Os participantes e seus efeitos aparecerão aqui.'}</p>${controller.ready?'<button class="secondary" data-action="add">Adicionar participantes</button>':''}</div>`:''}
      ${controller.gm&&hidden.length?`<div class="hidden-section"><button class="hidden-toggle" data-action="hidden">${icon('hidden')}<span>${hidden.length} ${hidden.length===1?'participante oculto':'participantes ocultos'}</span><span>${showHidden?'−':'+'}</span></button>${showHidden?`<ol class="participants">${hidden.map(id=>row(id,true)).join('')}</ol>`:''}<p>${state.settings.skipHidden?'Os turnos ocultos são processados automaticamente.':'Os ocultos continuam na sequência de turnos.'}</p></div>`:''}
      ${listed.length?'<div class="drop-end" data-drop-end>Arraste para definir a ordem</div>':''}
    </div>
    <footer class="tracker-footer"><button class="log-toggle ${showLog?'selected':''}" data-action="log">${icon('book')} Registro${log.length?`<span>${log.length}</span>`:''}</button></footer>
    ${showLog?`<section class="event-log" aria-label="Registro de efeitos"><div class="section-label">ÚLTIMOS AVISOS</div>${log.length?log.slice(0,30).map(({n,text})=>`<p><span class="log-round">R${n.round}</span><span>${esc(text)}</span></p>`).join(''):'<p class="muted">Os avisos dos efeitos aparecerão aqui.</p>'}</section>`:''}
    <div class="status-bar"><span><i class="status-dot"></i>${controller.demo?'Demonstração local':controller.ready?'Mesa conectada':'Aguardando cena'}</span><span>${visibleEffects.length} ${visibleEffects.length===1?'efeito ativo':'efeitos ativos'}</span></div>
  </section>${controller.demo?'<p class="demo-note">Use os personagens de exemplo para testar turnos e efeitos.<br>Esta prévia não altera seu tabuleiro do Owlbear.</p>':''}`;
  const area=app.querySelector('.list-area');if(area)area.scrollTop=oldScroll;
}
type FormHandler=(data:FormData,form:HTMLFormElement)=>Promise<void>;
function formDialog(title:string,body:string,label:string,submit:FormHandler){
  const previousFocus=document.activeElement as HTMLElement;
  modalRoot.innerHTML=`<dialog aria-labelledby="dialog-title"><form><div class="dialog-heading"><h2 id="dialog-title">${esc(title)}</h2><button type="button" class="icon-button" data-close aria-label="Fechar">${icon('close')}</button></div><div class="dialog-body">${body}</div><p class="form-error" role="alert"></p><div class="dialog-footer"><button type="button" class="secondary" data-close>Cancelar</button><button type="submit" class="primary">${esc(label)}</button></div></form></dialog>`;
  const dialog=modalRoot.querySelector('dialog')!,form=dialog.querySelector('form')!;
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('close',()=>{
    // close is queued: an old dialog must never erase its replacement.
    if(dialog.parentElement!==modalRoot)return;
    dialog.remove();
    if(previousFocus?.isConnected)previousFocus.focus();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector<HTMLButtonElement>('[type=submit]')!;
    button.disabled=true;
    try{await submit(new FormData(form),form);if(dialog.isConnected)dialog.close();}
    catch(e){form.querySelector('.form-error')!.textContent=e instanceof Error?e.message:String(e);}
    finally{button.disabled=false;render();}
  });
  dialog.showModal();return form;
}
const field=(label:string,input:string,hint='')=>`<label class="field"><span>${label}</span>${input}${hint?`<small>${hint}</small>`:''}</label>`;
const value=(data:FormData,key:string)=>String(data.get(key)??'');
function editSimple(kind:'alias'|'initiative'|'round',id=''){
  const current=kind==='alias'?name(id):kind==='initiative'?controller.state.combat.participants[id].initiative:controller.state.combat.round;
  const title=kind==='alias'?'Nome na iniciativa':kind==='initiative'?'Valor de iniciativa':'Número da rodada';
  const hint=kind==='alias'?'Este nome permanece depois de reiniciar o combate.':kind==='round'?'Altera somente o número exibido. Para restaurar turnos e efeitos, use a seta de voltar.':'A posição será atualizada pelo valor. Você pode ajustar a ordem arrastando.';
  formDialog(title,field(title,`<input autofocus name="value" type="${kind==='alias'?'text':'number'}" value="${esc(current)}" ${kind==='alias'?'maxlength="100"':kind==='round'?'min="1" max="99999" step="1"':'min="-99999" max="99999" step="any"'} required>`,hint),'Salvar',async data=>{
    const v=value(data,'value');await controller.send(kind==='alias'?{type:'alias',id,value:v}:kind==='initiative'?{type:'initiative',id,value:Number(v)}:{type:'round',value:Number(v)});
  });
}
async function addParticipants(selected:string[]=[]){
  if(controller.demo){
    formDialog('Adicionar personagem',field('Nome','<input name="name" placeholder="Nome do personagem" maxlength="100" required autofocus>')+field('Iniciativa','<input type="number" name="initiative" value="10" step="any" min="-99999" max="99999" required>'),'Adicionar',async data=>{
      await controller.send({type:'add',participants:[{id:crypto.randomUUID(),name:value(data,'name'),initiative:Number(value(data,'initiative'))}]});
    });return;
  }
  const available=controller.views.filter(v=>v.visible);
  if(!available.length){toast('Não há imagens disponíveis nesta cena.');return;}
  const selection=selected.length?selected:await controller.selected();
  const chosen=available.filter(v=>selection.includes(v.id));
  const targets=chosen.length?chosen:available;
  const checkbox=targets.map(v=>`<label class="check-row"><input type="checkbox" name="targets" value="${esc(v.id)}" ${chosen.length?'checked':''}><span>${esc(controller.state.aliases[v.id]||v.name)}</span></label>`).join('');
  const initial=chosen.length===1?controller.state.combat.participants[chosen[0].id]?.initiative??10:10;
  formDialog('Iniciativa',field('Valor',`<input name="initiative" type="number" step="any" min="-99999" max="99999" value="${initial}" required autofocus>`)+`<fieldset class="target-list"><legend>Imagens ${chosen.length?'selecionadas':'da cena'}</legend>${checkbox}</fieldset>`,'Adicionar à iniciativa',async data=>{
    const ids=data.getAll('targets').map(String);
    if(!ids.length)throw new Error('Selecione pelo menos uma imagem.');
    await controller.send({type:'add',participants:ids.map(id=>({id,name:available.find(v=>v.id===id)!.name,initiative:Number(value(data,'initiative'))}))});
  });
}
function effectDialog(targetId='',existing?:Effect){
  const c=controller.state.combat;
  const first=c.order.find(id=>c.participants[id]?.participating && visible(id));
  if(!first){toast('Adicione um participante antes de criar efeitos.');return;}
  const sourceId=existing?.sourceId ?? (c.activeId && visible(c.activeId)?c.activeId:targetId||first);
  const anchorId=existing?.anchorId || c.activeId || sourceId;
  const targets=existing?.targetIds || [targetId || sourceId || first];
  const body=`${field('Nome do efeito',`<input name="name" value="${esc(existing?.name||'')}" placeholder="Nome do efeito" maxlength="100" required autofocus>`)}
    ${field('Descrição',`<textarea name="description" rows="3" maxlength="5000" placeholder="O que este efeito faz?">${esc(existing?.description||'')}</textarea>`)}
    <div class="form-grid">${field('Quem aplicou',`<select name="sourceId"><option value="" ${sourceId===''?'selected':''}>Nenhum</option>${options(sourceId,true)}</select>`)}${field('Conta no final do turno de',`<select name="anchorId">${options(anchorId,true)}</select>`)}</div>
    <div class="form-grid">${field('Rodadas restantes',`<input name="remaining" type="number" min="1" max="999" step="1" value="${existing?.remaining||3}" required>`)}${field('Cor do marcador',`<select name="tone">${[['gold','Dourado'],['fire','Vermelho'],['blue','Azul'],['green','Verde'],['violet','Violeta']].map(([v,l])=>`<option value="${v}" ${existing?.tone===v?'selected':''}>${l}</option>`).join('')}</select>`)}</div>
    <fieldset class="target-list"><legend>Quem recebe o efeito</legend>${c.order.filter(id=>c.participants[id].participating && visible(id)).map(id=>`<label class="check-row"><input name="targets" type="checkbox" value="${esc(id)}" ${targets.includes(id)?'checked':''}><span>${esc(name(id))}</span></label>`).join('')}</fieldset>
    ${field('Aviso de ativação',`<select name="trigger">${[['none','Sem aviso — buff ou referência'],['start','No início do turno de cada alvo'],['end','No final do turno de cada alvo']].map(([v,l])=>`<option value="${v}" ${existing?.trigger===v?'selected':''}>${l}</option>`).join('')}</select>`)}
    <div id="message-field">${field('Mensagem para a mesa',`<textarea name="message" rows="2" maxlength="1200" placeholder="Mensagem exibida quando o efeito for ativado.">${esc(existing?.message||'')}</textarea>`)}</div>
    <label class="check-row setting-check"><input name="notifyDuration" type="checkbox" ${existing?.notifyDuration===false?'':'checked'}><span>Avisar rodadas restantes e encerramento</span></label>
    <p class="form-note">${icon('info')} O turno em andamento não consome uma rodada do novo efeito. Áreas, dados, dano e vida ficam a cargo da mesa.</p>`;
  const form=formDialog(existing?'Editar efeito':'Novo efeito',body,existing?'Salvar efeito':'Adicionar efeito',async data=>{
    // Preserve unseen targets while editing an effect from a player's filtered view.
    const unseen=existing?.targetIds.filter(id=>!visible(id))??[];
    const input:EffectInput={id:existing?.id||crypto.randomUUID(),name:value(data,'name'),description:value(data,'description'),
      sourceId:value(data,'sourceId'),anchorId:value(data,'anchorId'),remaining:Number(value(data,'remaining')),
      targetIds:[...data.getAll('targets').map(String),...unseen],trigger:value(data,'trigger') as Trigger,
      message:value(data,'message'),tone:value(data,'tone') as Tone,notifyDuration:data.has('notifyDuration')};
    await controller.send({type:'effect',value:input});
    input.targetIds.filter(visible).forEach(id=>expanded.add(id));
  });
  const element=(key:string)=>form.elements.namedItem(key) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  const updateTrigger=()=>{form.querySelector<HTMLElement>('#message-field')!.hidden=element('trigger').value==='none';};
  element('trigger').addEventListener('change',updateTrigger);updateTrigger();
}
function settingsDialog(){
  const s=controller.state.settings;
  const form=formDialog('Configurações',`<label class="setting-option"><span><strong>Mostrar imagens dos personagens</strong><small>Exibe a imagem do token em uma bolha circular. Esta preferência vale para toda a mesa.</small></span><input type="checkbox" name="showPortraits" ${s.showPortraits!==false?'checked':''}></label><label class="setting-option"><span><strong>Focar no personagem do turno</strong><small>Centraliza a câmera com uma aproximação moderada.</small></span><input type="checkbox" name="autoFocus" ${s.autoFocus?'checked':''}></label>
    ${field('Aproximação da câmera',`<div class="range-wrap"><input name="zoom" type="range" min="0.5" max="2" step="0.1" value="${s.zoom}"><output>${s.zoom.toFixed(1)}×</output></div>`)}
    <label class="setting-option"><span><strong>Passar automaticamente pelos ocultos</strong><small>Recolhe os nomes e processa seus turnos e efeitos sem cliques individuais.</small></span><input type="checkbox" name="skipHidden" ${s.skipHidden?'checked':''}></label>
    <p class="form-note">${icon('hidden')} A lista, os avisos e a câmera respeitam os personagens visíveis para cada jogador.</p>
    <div class="danger-zone"><div><strong>Reiniciar combate</strong><p>Limpa participantes, efeitos, rodadas, histórico e configurações. Preserva nomes personalizados.</p></div><button type="button" class="danger-outline" data-reset>${icon('reset')} Reiniciar tudo</button></div>`,'Salvar configurações',async data=>{
    await controller.send({type:'settings',value:{showPortraits:data.has('showPortraits'),autoFocus:data.has('autoFocus'),skipHidden:data.has('skipHidden'),zoom:Number(value(data,'zoom'))}});
  });
  form.querySelector('[name=zoom]')!.addEventListener('input',e=>{form.querySelector('output')!.textContent=Number((e.target as HTMLInputElement).value).toFixed(1)+'×';});
  form.querySelector('[data-reset]')!.addEventListener('click',()=>{
    form.closest('dialog')!.close();
    formDialog('Reiniciar todo o combate?',`<p class="confirm-text">Todos os participantes, efeitos, rodadas e configurações desta extensão serão removidos. Os nomes personalizados serão mantidos.</p><p class="muted">As imagens do mapa permanecem no lugar.</p>`,'Reiniciar tudo',async()=>{await controller.send({type:'reset'});expanded.clear();});
  });
}
function reorder(id:string){
  formDialog('Mover '+name(id),field('Posicionar antes de',`<select name="before"><option value="">Final da lista</option>${controller.state.combat.order.filter(x=>x!==id&&visible(x)).map(x=>`<option value="${esc(x)}">${esc(name(x))}</option>`).join('')}</select>`),'Mover',async data=>{await controller.send({type:'move',id,beforeId:value(data,'before')||null});});
}
app.addEventListener('error',event=>{
  const image=event.target;
  if(image instanceof HTMLImageElement && image.closest('.token-portrait')){image.parentElement!.title='Imagem indisponível';image.remove();}
},true);
app.addEventListener('click',async event=>{
  const b=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!b || (b as HTMLButtonElement).disabled)return;
  const id=b.dataset.id||'';
  switch(b.dataset.action){
    case 'next':void perform({type:'next'});break;
    case 'next-round':void perform({type:'nextRound'});break;
    case 'previous-round':void perform({type:'previousRound'});break;
    case 'round':editSimple('round');break;
    case 'rename':editSimple('alias',id);break;
    case 'initiative':editSimple('initiative',id);break;
    case 'focus':void controller.focus(id).catch(e=>toast(String(e)));break;
    case 'remove':void perform({type:'remove',id});break;
    case 'add':void addParticipants().catch(e=>toast(String(e)));break;
    case 'effects':expanded.has(id)?expanded.delete(id):expanded.add(id);render();break;
    case 'add-effect':effectDialog(id);break;
    case 'edit-effect':effectDialog('',controller.state.combat.effects.find(e=>e.id===id));break;
    case 'remove-effect':void perform({type:'removeEffect',id});break;
    case 'settings':settingsDialog();break;
    case 'reorder':reorder(id);break;
    case 'hidden':showHidden=!showHidden;render();break;
    case 'log':showLog=!showLog;render();break;
    case 'role':controller.setDemoRole?.(!controller.gm);render();break;
  }
});
app.addEventListener('dragstart',event=>{
  const handle=(event.target as HTMLElement).closest<HTMLElement>('[data-drag]');if(!handle||!event.dataTransfer)return;
  dragged=handle.dataset.drag!;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';
  handle.closest('.participant')?.classList.add('dragging');
});
app.addEventListener('dragover',event=>{
  const row=(event.target as HTMLElement).closest<HTMLElement>('[data-row],[data-drop-end]');
  if(row&&dragged){event.preventDefault();app.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));row.classList.add('drop-target');}
});
app.addEventListener('drop',event=>{
  event.preventDefault();const row=(event.target as HTMLElement).closest<HTMLElement>('[data-row],[data-drop-end]');
  if(row&&dragged)void perform({type:'move',id:dragged,beforeId:row.dataset.row||null});
  dragged=null;render();
});
app.addEventListener('dragend',()=>{dragged=null;render();});
document.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight' && event.altKey && !modalRoot.querySelector('dialog') && !busy){event.preventDefault();void perform({type:'next'});}
});
let renderFrame=0;
controller.subscribe(()=>{if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;if(!dragged)render();});});
controller.context(ids=>{void addParticipants(ids).catch(e=>toast(String(e)));});
render();
controller.start().then(render).catch(e=>{toast(String(e));render();});
