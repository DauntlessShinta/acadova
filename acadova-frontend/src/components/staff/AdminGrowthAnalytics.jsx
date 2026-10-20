import api from '../../services/api';
import { useDashboardData } from '../../utils/useDashboardData';
import { fillDays } from '../../utils/analyticsPresentation';
import { DashboardPanel } from './DashboardPrimitives';
import { StaffBars, StaffLineChart } from './StaffDashboardUi';
const sources=[['growth',(range,options)=>api.get('/api/admin/exp-analytics?'+new URLSearchParams(range),options)]];
const series=[{key:'awarded',label:'Recorded positive EXP'}];

export default function AdminGrowthAnalytics({ range, enabled }) {
  const {data,loading,busy,error,refresh}=useDashboardData(sources,range,enabled);
  const value=data.growth;
  return <section aria-label="EXP analytics">
    {loading&&<p role="status">Loading recorded EXP...</p>}
    {error&&<p role="alert">EXP analytics unavailable. <button type="button" className="btn btn-secondary" disabled={busy} onClick={refresh}>Retry EXP analytics</button></p>}
    {value?.active===false&&<p>{value.message}</p>}
    {value?.active&&<>
      <p>Recorded in period: <strong>{value.totals.awarded} EXP awarded</strong> · {value.totals.corrections} corrections · {value.totals.net} net EXP. <strong>{value.progressingStudents} students progressing</strong> with positive net EXP in this period.</p>
      <div className="staff-dashboard-pair"><DashboardPanel title="EXP awarded over time" description="Positive ledger entries in the selected UTC period."><StaffLineChart rows={fillDays(range,value.trend,['awarded'])} series={series}/></DashboardPanel><DashboardPanel title="Current level distribution" description="Current eligible Student population; not a historical cohort."><StaffBars rows={value.distribution.map(row=>({label:`Level ${row.level} · ${row.title}`,value:row.students}))}/></DashboardPanel></div>
      <div className="staff-dashboard-pair"><DashboardPanel title="Award types"><StaffBars rows={value.types.map(row=>({label:row.kind==='official_assessment'?'Official assessments':'Verified tutoring',value:row.exp}))}/>{!value.types.length&&<p>No recorded awards in this period.</p>}</DashboardPanel><DashboardPanel title="Current award review"><p>{value.claims.pending||0} pending claims · {value.claims.held||0} held claims · {value.claims.reversed||0} reversed claims.</p><p>{value.integrity.duplicateEventGroups} duplicate persisted owner/event groups detected; {value.integrity.negativeOwnerTotals} invalid negative owner totals.</p><p>{value.definitions.integrity}</p></DashboardPanel></div>
      <p>{value.definitions.progressingStudents} {value.definitions.distribution} Exact EXP and assessment records are not exposed through public peer profiles.</p>
    </>}
  </section>;
}
