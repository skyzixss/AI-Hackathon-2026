// Historical diagnostic for product snapshot 3a5130e; not a passing-regression test.
// Read-only audit: actual source transformed with installed Vite/Oxc.
// React hook semantics are modelled deterministically; no browser or real server.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { transformWithOxc } from 'vite';
import * as dates from '../../src/features/studies/dates.ts';
import * as tuitionModel from '../../src/features/payments/model.ts';

function engine() {
  const slots = []; let cursor = 0, effects = [], dirty = false;
  const same = (a,b) => !!a && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  return {
    start() {cursor = 0; dirty = false;},
    dirty() {return dirty;},
    flush() {const pending=effects;effects=[];for(const f of pending)f();},
    hooks: {
      useState(initial) {
        const i=cursor++; if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
        return [slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i])){slots[i]=value;dirty=true;}}];
      },
      useRef(initial) {const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
      useCallback(fn,deps) {const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
      useEffect(fn,deps) {const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){slots[i]={deps};effects.push(fn);}},
    },
  };
}
const jsx = (type,props,key) => ({type,props:props??{},key});
const jsxBindings = {_jsx:jsx,_jsxs:jsx,_Fragment:Symbol('fragment')};
async function sourceFunction(path, names, bindings) {
  const input=await readFile(path,'utf8');
  let {code}=await transformWithOxc(input,path);
  code=code.replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'');
  return new Function(...Object.keys(bindings), code+`;return {${names.join(',')}};`)(...Object.values(bindings));
}
function find(tree,predicate) {
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree)){for(const child of tree){const result=find(child,predicate);if(result)return result;}return null;}
  if(predicate(tree))return tree;
  return find(tree.props?.children,predicate);
}
const results=[];

// 1. An in-flight initial list fetch overwrites/loses a successful local insertion.
{
  const e=engine();let resolveGet;
  const get=new Promise(resolve=>{resolveGet=resolve;});
  const {useLoad}=await sourceFunction('src/features/requests/useLoad.ts',['useLoad'],e.hooks);
  const render=()=>{e.start();return useLoad('student-A',()=>get);};
  let result=render();e.flush();result=render();
  assert.equal(result.state.status,'loading');
  const created={id:'new-request',body:'Fictional audit request'};
  result.update(list=>[created,...list]);
  resolveGet([]);await Promise.resolve();
  result=render();assert.equal(result.state.status,'ready');assert.deepEqual(result.state.data,[]);
  // Control: after loading finishes the same successful insertion is retained.
  result.update(list=>[created,...list]);result=render();assert.equal(result.state.data[0].id,created.id);
  results.push({finding:'request-created-during-initial-read',confirmed:true,lostBeforeReady:true,controlAfterReadyRetains:true});
}

// 2. The Today event handler captures yesterday. Equal state updates cannot repaint it.
{
  const RealDate=globalThis.Date;let now=Date.parse('2026-11-04T20:59:00Z');
  globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  try{
    const e=engine();
    const {Schedule}=await sourceFunction('src/features/studies/Schedule.tsx',['Schedule'],{
      ...e.hooks,...jsxBindings,...dates,Icon:()=>null,ResourceState:()=>null,
      useResource:()=>({state:{status:'ready',data:[]},retry(){}}),
    });
    e.start();const tree=Schedule({api:{schedule:async()=>[]},sessionKey:'student-A'});
    const todayButton=find(tree,n=>n.type==='button'&&n.props.children==='Сегодня');
    assert.ok(todayButton);
    now=RealDate.parse('2026-11-04T21:01:00Z');
    todayButton.props.onClick();
    assert.equal(dates.moscowDay(),'2026-11-05');assert.equal(e.dirty(),false);
    const input=find(tree,n=>n.type==='input'&&n.props.type==='date');assert.equal(input.props.value,'2026-11-04');
    results.push({finding:'today-after-midnight',confirmed:true,actualToday:dates.moscowDay(),displayedDay:input.props.value,stateChangedOnTodayClick:e.dirty()});
  } finally {globalThis.Date=RealDate;}
}

// 3. With a stalled payment promise every built-in dialog exit is blocked.
{
  const e=engine();const charge={id:'10000000-0000-4000-8000-000000000001',student_id:'student-A',title:'Fictional audit tuition',contract_number:'DEMO',amount_kopecks:10000,due_on:'2026-11-15',paid_at:null,payment_reference:null,demo_only:true};
  let paymentCalls=0;
  const api={charges:async()=>[charge],payDemo:()=>{paymentCalls++;return new Promise(()=>{});}};
  const savedDocument=globalThis.document;globalThis.document={body:{style:{overflow:''}}};
  try{
    const {Tuition}=await sourceFunction('src/features/payments/Tuition.tsx',['Tuition'],{
      ...e.hooks,...jsxBindings,...dates,...tuitionModel,Icon:()=>null,ResourceState:()=>null,
      useResource:()=>({state:{status:'ready',data:[charge]},retry(){}}),
    });
    const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}};
    function render(){e.start();const t=Tuition({api,sessionKey:'student-A'});find(t,n=>n.type==='dialog').props.ref.current=dialog;e.flush();return t;}
    let tree=render();find(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Оплатить в демо').props.onClick();
    tree=render();find(tree,n=>n.type==='button'&&n.props.children==='Подтвердить демо-оплату').props.onClick();
    tree=render();assert.ok(dialog.open);assert.equal(paymentCalls,1);
    let prevented=false;find(tree,n=>n.type==='dialog').props.onCancel({preventDefault(){prevented=true;}});
    assert.ok(prevented);assert.equal(e.dirty(),false);assert.ok(dialog.open);
    const exits=['Закрыть оплату','Отмена'].map(label=>find(tree,n=>n.type==='button'&&(n.props['aria-label']===label||n.props.children===label)));
    assert.ok(exits.every(button=>button.props.disabled));
    results.push({finding:'stalled-payment-traps-modal',confirmed:true,paymentCalls,modalStillOpen:dialog.open,escapePrevented:prevented,allCloseControlsDisabled:true});
  } finally {globalThis.document=savedDocument;}
}

await mkdir('work/audit-2026-11-05', {recursive:true});
await writeFile('work/audit-2026-11-05/poc-results.json',JSON.stringify({sourceCommit:'3a5130e4c85664b3c5a31b651918d340477a3748',method:'Actual transformed source; deterministic model of React hooks, no browser/DB writes',results},null,2));
console.log(JSON.stringify(results,null,2));
