import React from 'react';
export default function WorkflowTabs({ id, tabs, active, onChange }) {
  return <div className="workflow-tabs" role="tablist" aria-label="Workflow sections">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" id={id + '-tab-' + key} aria-controls={id + '-panel-' + key} aria-selected={active === key} tabIndex={active === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={(event) => {
    const index = tabs.findIndex(([value]) => value === key);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next !== null) { event.preventDefault(); onChange(tabs[next][0]); document.getElementById(id + '-tab-' + tabs[next][0])?.focus(); }
  }}>{label}</button>)}</div>;
}
