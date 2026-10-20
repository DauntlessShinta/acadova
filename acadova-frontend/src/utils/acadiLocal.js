// Fixed local rules only. No provider, prompt execution, HTML or arbitrary URLs.
const text = value => typeof value === 'string' ? [...value].filter(char=>char.charCodeAt(0)>=32&&char.charCodeAt(0)!==127).join('').trim().slice(0,120) : '';
const id = value => /^[a-f\d]{24}$/i.test(String(value || '')) ? String(value) : null;
const rows = value => Array.isArray(value) ? value : [];
export function localStudyContext(state, plans) {
  const subjects=rows(state?.subjects).filter(row=>id(row.id)&&text(row.name)&&!row.archived).slice(0,12).map(row=>({id:id(row.id),name:text(row.name)}));
  const allowed=new Set(subjects.map(row=>row.id)), m=state?.continueModule;
  const module=m && id(m.id||m._id) && allowed.has(id(m.subjectId)) && text(m.title) && m.status==='in_progress' ? {id:id(m.id||m._id),subjectId:id(m.subjectId),title:text(m.title),status:'in_progress'} : null;
  const items=rows(plans?.items).filter(row=>id(row.id)&&allowed.has(id(row.subjectId))&&!row.completed&&text(row.title)&&['exam','goal','task'].includes(row.kind)).slice(0,8).map(row=>({id:id(row.id),subjectId:id(row.subjectId),title:text(row.title),kind:row.kind,dueAt:row.dueAt&&Number.isFinite(Date.parse(row.dueAt))?new Date(row.dueAt).toISOString():null}));
  return {subjects,module,plans:items};
}
export function localAcadiReply(input, context, now=Date.now(), {freeLearning=false}={}) {
  const value=String(input).toLowerCase();
  const base={facts:[],links:[]};
  if(/study sets?|flashcards?|saved (?:materials?|quiz)|quiz(?:zes)?/.test(value))return {...base,message:'Open My Study Sets for saved practice. Module-generated material also stays in its originating module. I have not read your study-set content.',links:[{to:'/study-sets',label:'My Study Sets'},{to:'/subjects',label:'My Subjects'}]};
  if(/together|circle|peer|tutor|session/.test(value))return {...base,message:freeLearning?'Study Circles and new peer tutoring are free. I can guide you to these pages; joining, hosting and requesting sessions require your action. Historical obligations remain preserved for review.':'Study Circles are free group learning. Peer tutoring still follows the existing Credit rules. I can guide you to these pages; joining, hosting and requesting sessions require your action.',links:[{to:'/study-together',label:'Study Circles'},{to:'/tutors',label:'Find peer help'},{to:'/sessions',label:'My Sessions'}]};
  if(/exam|schedule|date/.test(value)){
    if(!context)return {...base,message:'I have not loaded any saved account facts. Opt in to local context to inspect dates you entered. I cannot infer a school timetable.',links:[{to:'/dashboard#study-planning',label:'My Study Plan'}]};
    const next=context.plans.filter(row=>row.kind==='exam'&&row.dueAt&&Date.parse(row.dueAt)>=now).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt))[0];
    return next?{...base,message:'This is the next future exam entry among the loaded current-term plans. It is a date you entered, not a verified school schedule.',facts:[{label:'Entered exam',value:next.title+' / '+new Date(next.dueAt).toLocaleString(),to:'/dashboard#study-planning'}],links:[{to:'/dashboard#study-planning',label:'Review entered dates'}]}:{...base,message:'No upcoming exam date was found among the loaded current-term plans. This does not prove that no exam is scheduled. Add or check the dates yourself.',links:[{to:'/dashboard#study-planning',label:'My Study Plan'}]};
  }
  if(/study|review|plan|tonight|30.minute/.test(value)){
    if(!context)return {...base,message:'I have not loaded your saved subjects or plans. You can opt in locally, or choose a module yourself.',suggestion:'For a 30-minute session, try 5 minutes of source review, 20 minutes of practice and 5 minutes checking your answers. This is a suggestion, not a saved plan.',links:[{to:'/subjects',label:'Choose a module'}]};
    const m=context.module, subject=context.subjects.find(row=>row.id===m?.subjectId)||context.subjects[0];
    const to=m?`/subjects/${m.subjectId}#module-${m.id}`:subject?`/subjects/${subject.id}`:'/subjects';
    return {...base,message:m?'Your workspace returned this module marked In progress. That is a self-reported status, not a mastery measurement.':subject?'A current-term subject is available, but no In progress module was returned. Choose the module you want to review.':'No current-term subjects were returned. Set up a subject or use the learning library.',facts:m?[{label:'Saved module status',value:m.title+' / In progress',to}]:subject?[{label:'Current-term subject',value:subject.name,to}]:[],suggestion:'Try 5 minutes reviewing the authorized source, 20 minutes practicing and 5 minutes checking answers. This does not create or change a study plan.',links:[{to,label:m?'Open saved module':'Open My Subjects'},{to:'/dashboard#study-planning',label:'My Study Plan'}]};
  }
  return {...base,message:'Local guidance does not call Gemini. Check the separate Gemini study chat tab for provider availability. I provide fixed local navigation and study-plan guidance, not generated topic explanations. Use an authorized learning source or ask a peer for an explanation.',links:[{to:'/subjects',label:'My authorized modules'},{to:'/learning',label:'Browse learning'}]};
}
