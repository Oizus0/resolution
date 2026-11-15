import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenViews, visibleNotice } from '../src/visibility.ts';
import type { MapItem } from '../src/visibility.ts';
import { initialState, reduce } from '../src/engine.ts';
import { leader } from '../src/protocol.ts';
const viewer={id:'player1',role:'PLAYER' as const};
test('manual visibility overrides map hiding and Smoke metadata',()=>{
 const item:MapItem={id:'a',type:'IMAGE',name:'A',visible:false,position:{x:0,y:0},rotation:0,scale:{x:1,y:1},metadata:{'com.battle-system.smoke/disableVision':false},createdUserId:'gm',image:{url:'https://example.test/a.png'}};
 let s=reduce(initialState(),{type:'add',participants:[{id:'a',name:'A',initiative:20,hidden:true},{id:'b',name:'B',initiative:10}]}).state;
 assert.equal(tokenViews([item],s.combat.participants,viewer)[0].visible,false);
 assert.equal(tokenViews([item],s.combat.participants,viewer)[0].portraitUrl,undefined);
 assert.equal(tokenViews([item],s.combat.participants,{id:'gm',role:'GM'})[0].visible,true);
 s=reduce(s,{type:'initiative',id:'a',value:20}).state;
 assert.equal(s.combat.participants.a.hidden,true);
 s=reduce(s,{type:'settings',value:{skipHidden:true}}).state;
 assert.equal(reduce(s,{type:'next'}).state.combat.activeId,'b');
 s=reduce(s,{type:'initiative',id:'a',value:20,hidden:false}).state;
 assert.equal(tokenViews([item],s.combat.participants,viewer)[0].visible,true);
 assert.equal(tokenViews([item],s.combat.participants,viewer)[0].portraitUrl,item.image!.url);
});
test('notifications never enumerate hidden targets or reveal an invisible source',()=>{
  const s=reduce(initialState(),{type:'add',participants:[{id:'ana',name:'Segredo',initiative:22},{id:'bruno',name:'Bruno',initiative:16}]}).state;
  const n={id:'n',kind:'duration' as const,effectId:'e',name:'Buff',message:'',targetIds:['bruno','ana'],anchorId:'ana',remaining:2,round:1};
  assert.equal(visibleNotice(n,s,new Set(['bruno']),false),'Buff · Bruno: 2 rodadas restantes.');
  assert.equal(visibleNotice({...n,targetIds:['ana']},s,new Set(['bruno']),false),null);
});
test('coordinator election prefers GM and is stable regardless of arrival order',()=>{
  const p=[{connectionId:'z',role:'GM' as const},{connectionId:'a',role:'PLAYER' as const},{connectionId:'b',role:'GM' as const}];
  assert.equal(leader(p),'b'); assert.equal(leader([...p].reverse()),'b');
});
