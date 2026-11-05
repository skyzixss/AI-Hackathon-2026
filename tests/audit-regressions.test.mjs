// Actual source with deterministic hook/JSX model; not browser or cloud proof.
import { test } from "node:test";
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { transformWithOxc } from 'vite';
import * as dates from '../src/features/studies/dates.ts';
import * as tuitionModel from '../src/features/payments/model.ts';

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

test('confirmed insertion survives stale initial GET and duplicate server row', async()=>{
 const e=engine();let resolveGet;let get=new Promise(r=>resolveGet=r);
 const {useLoad}=await sourceFunction('src/features/requests/useLoad.ts',['useLoad'],e.hooks);
 const render=()=>{e.start();return useLoad('A',()=>get);};
 let result=render();e.flush();result=render();
 const created={id:'created'};
 const insert=list=>list.some(row=>row.id===created.id)?list:[created,...list];
 result.update(insert);resolveGet([]);await Promise.resolve();
 result=render();assert.deepEqual(result.state.data,[created]);
 get=Promise.resolve([created]);result.reload();await Promise.resolve();
 result=render();assert.deepEqual(result.state.data,[created]);
});

test('Today follows Moscow midnight while an explicit selected date stays selected',async()=>{
 const RealDate=globalThis.Date;const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let now=RealDate.parse('2026-11-04T20:59:59Z');let tick;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 globalThis.window={setInterval(fn){tick=fn;return 1;},clearInterval(){},addEventListener(){},removeEventListener(){}};
 globalThis.document={addEventListener(){},removeEventListener(){}};
 try{
  const e=engine();
  const {useMoscowDay}=await sourceFunction('src/features/studies/useMoscowDay.ts',['useMoscowDay'],{...e.hooks,...dates});
  const {Schedule}=await sourceFunction('src/features/studies/Schedule.tsx',['Schedule'],{...e.hooks,...jsxBindings,...dates,useMoscowDay,Icon:()=>null,ResourceState:()=>null,useResource:()=>({state:{status:'ready',data:[]},retry(){}})});
  const render=()=>{e.start();const t=Schedule({api:{schedule:async()=>[]},sessionKey:'A'});e.flush();return t;};
  let tree=render();now=RealDate.parse('2026-11-04T21:00:01Z');tick();tree=render();
  assert.equal(find(tree,n=>n.type==='input').props.value,'2026-11-05');
  find(tree,n=>n.type==='input').props.onChange({target:{value:'2026-11-01'}});tree=render();
  now=RealDate.parse('2026-11-05T21:00:01Z');tick();tree=render();
  assert.equal(find(tree,n=>n.type==='input').props.value,'2026-11-01');
  find(tree,n=>n.type==='button'&&n.props.children==='Сегодня').props.onClick();tree=render();
  assert.equal(find(tree,n=>n.type==='input').props.value,'2026-11-06');
 }finally{globalThis.Date=RealDate;globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

test('stalled payment can close without cancelling or submitting twice; late success is retained',async()=>{
 const e=engine();let resolvePayment,calls=0,retries=0;
 const charge={id:'demo',student_id:'A',title:'Demo',amount_kopecks:100,contract_number:'DEMO',due_on:'2026-11-15',paid_at:null,payment_reference:null,demo_only:true};
 const api={payDemo(){calls++;return new Promise(r=>resolvePayment=r);}};
 const oldDocument=globalThis.document;globalThis.document={body:{style:{overflow:''}}};
 try{
  const {Tuition}=await sourceFunction('src/features/payments/Tuition.tsx',['Tuition'],{...e.hooks,...jsxBindings,...dates,...tuitionModel,useMoscowDay:()=> '2026-11-05',Icon:()=>null,ResourceState:()=>null,useResource:()=>({state:{status:'ready',data:[charge]},retry(){retries++;}})});
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}};
  const render=()=>{e.start();const t=Tuition({api,sessionKey:'A'});find(t,n=>n.type==='dialog').props.ref.current=dialog;e.flush();return t;};
  let tree=render();find(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Оплатить в демо').props.onClick();tree=render();
  const pending=find(tree,n=>n.type==='button'&&n.props.children==='Подтвердить демо-оплату').props.onClick();tree=render();
  assert.equal(find(tree,n=>n.props['aria-label']==='Закрыть оплату').props.disabled,undefined);
  find(tree,n=>n.type==='dialog').props.onCancel({preventDefault(){}});tree=render();assert.equal(dialog.open,false);
  find(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Оплатить в демо').props.onClick();tree=render();
  assert.equal(find(tree,n=>n.type==='button'&&n.props.children==='Подтверждаем…').props.disabled,true);assert.equal(calls,1);
  resolvePayment({...charge,paid_at:'2026-11-05T12:00:00Z',payment_reference:'DEMO-test'});await pending;tree=render();
  assert.equal(retries,1);assert.ok(find(tree,n=>n.type==='strong'&&n.props.children==='Демо-платёж проведён'));assert.equal(dialog.open,false);
 }finally{globalThis.document=oldDocument;}
});
