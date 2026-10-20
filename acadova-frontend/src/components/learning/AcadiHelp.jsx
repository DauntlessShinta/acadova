import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Layers, ArrowRight } from 'lucide-react';
import Modal from '../common/Modal';
import { AcadiMark } from './AcademicUi';
import './acadiHelp.css';
import AcadiChatPanel from './AcadiChatPanel';
import AcadiLocalGuide from './AcadiLocalGuide';
import { useAuth } from '../../context/AuthContext';

// Local guidance stays available; separate Gemini mode requires server consent and availability.
export default function AcadiHelp({ isOpen, onClose }) {
  const { user } = useAuth();
  return isOpen && user?.role === 'student' ? <LocalHelpPanel key={user._id || user.id} onClose={onClose}/> : null;
}
function LocalHelpPanel({ onClose }) {
  const { freeLearning } = useAuth();
  const [help, setHelp] = useState(false);
  const [gemini,setGemini]=useState(false);
  return <><Modal isOpen onClose={onClose} title="Acadi / Learning help" className="acadi-help acadi-help-drawer" maxWidth="480px">
    <div className="acadi-help-intro"><AcadiMark/><div><span className="acadi-help-label">{gemini?'Gemini study assistance':'Local rule-based guidance'}</span><p>{gemini?'Read-only conversation; server availability and consent apply.':'This panel does not use an AI model. Choose Gemini chat to check its separate availability.'}</p></div><button type="button" className="btn btn-ghost" onClick={()=>setHelp(true)}>Navigation &amp; help</button></div>
    <div className="acadi-mode-tabs" aria-label="Assistance mode"><button className="btn btn-ghost" aria-pressed={!gemini} onClick={()=>setGemini(false)}>Local guidance</button><button className="btn btn-ghost" aria-pressed={gemini} onClick={()=>setGemini(true)}>Gemini study chat</button></div>{gemini?<AcadiChatPanel fallback={()=>setGemini(false)}/>:<AcadiLocalGuide onNavigate={onClose}/>}</Modal><Modal isOpen={help} onClose={()=>setHelp(false)} title="Navigation and help" className="acadi-help acadi-help-reference" maxWidth="480px"><nav className="acadi-help-links" aria-label="Acadi learning shortcuts">{[
      ['/subjects', BookOpen, 'My Subjects', 'Open a module and study its authorized resources.'],
      ['/study-sets', Layers, 'My Study Sets', 'Revisit saved flashcards and practice quizzes.'],
      ['/study-together', CalendarDays, 'Study Together', 'Find Study Circles and peer learning options.'],
    ].map(([to, Icon, label, description]) => <Link key={to} to={to} onClick={onClose}><Icon size={22} aria-hidden="true"/><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={16} aria-hidden="true"/></Link>)}</nav>
    <section className="acadi-help-faq" aria-label="Common questions"><h2>A little guidance</h2>
      <details><summary>How do I generate study material from a module?</summary><p>Open My Subjects, choose a subject and module, then select Generate Study Material on an authorized resource. Review the permission and consent requirements. Choose Flashcards, Practice Quiz or Both. Strict Source requires supporting source evidence; generation can fail if the source cannot support the requested material.</p><p>Module generation saves only after the backend confirms success. Failed generations are not saved sets. Standalone AI Study Tools remains available for work outside a module.</p></details>
      <details><summary>Where are my saved materials?</summary><p>Reopen the originating module for module-generated material, or open Study Sets. Archived material is retained and can be restored through its study-material controls. Keep the same account when checking saved work.</p></details>
      <details><summary>Are Credits already EXP?</summary><p>{freeLearning?'EXP recognizes qualifying learning and verified tutoring; it is never spent. Historical Credits are preserved and never converted. Private practice does not earn EXP.':'EXP recognition is not active. Historical Credits remain unchanged. Qualifying assessments and verified tutoring follow the existing credit rules.'}</p><Link to="/growth" onClick={onClose}>View Growth status</Link></details>
      <details><summary>What information does Acadi use?</summary><p>This panel uses fixed local rules. Only after you opt in does it retrieve your authorized workspace to select subject/module names, status and entered plan titles/dates. It does not use grades, notes or source documents in suggestions. Closing or clearing the panel discards its local context and messages. Gemini study chat uses separate explicit consent, availability and privacy controls. Chat is read-only and short-lived. AI Study Tools has separate source and consent safeguards.</p></details>
    </section>
    <p className="acadi-help-support">Need platform information? <Link to="/about" onClick={onClose}>Open Help &amp; support</Link></p>
  </Modal></>;
}
