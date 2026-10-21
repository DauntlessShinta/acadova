import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
async function render(file,name,props,states,extra={}){
  const source=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace('export default function '+name,'function '+name);
  const {code}=await transformWithOxc(source,name+'.jsx',{jsx:{runtime:'classic'}});let index=0;
  const context=vm.createContext({React,useState:()=>[states[index++],()=>{}],useEffect:()=>{},useAuth:()=>({user:{id:'synthetic-learner',role:'student'}}),useConfirm:()=>()=>{},Link:({to,children})=>React.createElement('a',{href:to},children),...extra});
  vm.runInContext(code+'\nglobalThis.subject='+name+';',context);
  return renderToStaticMarkup(React.createElement(context.subject,props));
}
test('actual historical review UI retains claims and removes consent controls under the first-release freeze',async()=>{
  const html=await render('components/student/EconomySessionReview.jsx','EconomySessionReview',{session:{id:'synthetic-session',learner:'synthetic-learner',creditAmount:20}},[{caseWritesAllowed:false,review:{state:'proposed',reason:'Retained historical proposal'}},'',false,0]);
  assert.match(html,/Historical session - read only/);assert.match(html,/unresolved claims are preserved/);assert.doesNotMatch(html,/20 Credits|Retained historical proposal|Staff proposal/);assert.doesNotMatch(html,/<button[^>]*>Review and consent/);
});
test('actual Staff review UI cannot propose legacy dispositions while EXP reports remain actionable',async()=>{
  const html=await render('components/staff/GrowthReviewPanel.jsx','GrowthReviewPanel',{},[[{_id:'synthetic-case',subject:'Historical case',creditAmount:20,status:'completed',caseWritesAllowed:false}],[{_id:'synthetic-report',subject:'Free contribution',expReport:{reason:'Synthetic concern'}}],'',false,0,'']);
  assert.match(html,/Proposals and dispositions are deferred/);assert.doesNotMatch(html,/>Propose no-transfer closure</);assert.match(html,/>Dismiss report</);assert.match(html,/>Uphold report</);
});
test('actual free contribution UI keeps its report window and My Growth link',async()=>{
  const html=await render('components/student/EconomySessionReview.jsx','EconomySessionReview',{session:{id:'synthetic-free',learner:'synthetic-learner',economyVersion:'free-v1'}},[{canReport:true},'',false,0]);
  assert.match(html,/at least 48 hours/);assert.match(html,/Report contribution concern/);assert.match(html,/href="\/growth"/);assert.doesNotMatch(html,/Credits|closure/);
});
test('actual active Student account menu exposes My Growth and retires Credits history',async()=>{
  const Icon=()=>React.createElement('svg');const icons=Object.fromEntries(['ChevronDown','LogOut','User','Settings','Layers','BookOpen','Coins','Sparkles'].map(k=>[k,Icon]));
  const html=await render('components/common/AccountMenu.jsx','AccountMenu',{},[true],{...icons,useId:()=> 'synthetic-menu',useRef:()=>({current:null}),useNavigate:()=>()=>{},useAuth:()=>({user:{id:'synthetic-learner',role:'student',name:'Synthetic'},freeLearning:true,logout:()=>{}})});
  assert.match(html,/My Growth/);assert.doesNotMatch(html,/Credits|wallet|payment|href="\/credits"/);
});
