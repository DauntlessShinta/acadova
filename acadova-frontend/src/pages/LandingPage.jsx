import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Upload, Layers, Users, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleHomeRoute } from '../config/roleNavigation';
import '../styles/landing.css';
const steps=[
 [BookOpen,'Add your subjects','Choose your academic year and semester, then create the subjects you study.'],
 [Upload,'Upload learning materials','Keep PDFs, presentations, notes and external references beside the relevant module.'],
 [Layers,'Generate and review study sets','Use available AI tools to create practice, check the evidence, and save material for review.'],
];
const features=[
 [BookOpen,'Subjects','A private workspace for independent terms, examination periods, modules and learning resources.'],
 [Sparkles,'AI Study Tools','Source-based quizzes and flashcards with consent, provenance and review. Generation currently remains restricted to synthetic QA material.'],
 [Users,'Study Together','Find peer help, manage sessions, offer your skills, or join a free Study Circle. Expertise is self-declared.'],
];
const faqs=[
 ['Who can create an account?','New student registration requires an email whose domain exactly matches phinmaed.com and verified ownership of that email. Other domains and subdomains are not automatically approved. Existing authorized staff accounts retain their sign-in path.'],
 ['Is Acadova free?','Account creation, your personal academic workspace and Study Circles have no credit cost. Legacy tutoring sessions and some library unlocks currently use internal credits. Current costs are shown before an eligible action. Credits have no cash value.'],
 ['What can I upload?','Personal subject resources support PDF and PPTX files, notes, Google Forms and external references. Upload only material you are permitted to use. AI processing has separate file limits and currently permits synthetic, non-sensitive local QA documents only.'],
 ['Can I trust every AI answer?','AI can make mistakes. Strict Source validates literal answers and evidence against extracted text; it does not certify conceptual correctness. Review every item. No unlimited generation or live-provider availability is promised.'],
 ['Who can see my files?','Personal academic uploads and AI-generated sets are private by default. Other study sets may be shared only through their explicit private, unlisted or moderated-public controls. Do not put confidential information into external AI tools.'],
 ['How does tutoring work?','Students can both learn and teach. Request and manage tutoring with the existing session workflow; join external meetings and use check-ins and mutual confirmations. A meeting link alone does not prove attendance. Tutor skills are not formally certified by Acadova.'],
 ['What is EXP?','EXP is planned recognition for verified learning and contributions, not currency. EXP recognition is not active yet. Historical credits are not automatically converted. There is no launch leaderboard.'],
];
export const LandingPage=()=>{
 const {isAuthenticated,user}=useAuth();const target=isAuthenticated?getRoleHomeRoute(user?.role):'/register';
 return <div className="landing-page landing-v2">
  <section className="landing-hero"><div className="container landing-v2-hero-grid"><div>
   <span className="landing-kicker">Your academic workspace</span>
   <h1>Turn your class materials into practice.</h1>
   <p className="landing-v2-intro">Organize your subjects, generate flashcards and quizzes from your learning materials, and study with classmates.</p>
   <div className="landing-action-row"><Link to={target} className="btn btn-primary btn-lg">{isAuthenticated?'Open my workspace':'Get Started Free'}<ArrowRight size={19} aria-hidden="true"/></Link><a href="#how-it-works" className="btn btn-secondary btn-lg">See How It Works</a></div>
   <p className="landing-v2-eligibility"><ShieldCheck size={17} aria-hidden="true"/>Requires a verified PHINMAED email.</p>
   <p className="form-hint landing-v2-limit">AI generation currently remains limited to synthetic QA documents under the existing provider safeguards.</p>
  </div><figure className="landing-v2-product" id="dashboard-preview"><img src="/images/acadova-empty-workspace.png" width="1536" height="864" alt="Actual Acadova My Subjects interface in its empty state, with term selection and no academic records"/><figcaption>Actual product interface, shown as an empty demonstration. No student academic records.</figcaption></figure></div></section>
  <section className="landing-section" id="how-it-works" aria-labelledby="how-title"><div className="container"><div className="landing-section-heading"><span className="landing-kicker">A simple study routine</span><h2 id="how-title">From materials to meaningful practice</h2></div><div className="landing-v2-three">{steps.map(([Icon,title,text],i)=><article className="landing-feature-card" key={title}><span className="landing-v2-step">0{i+1}</span><Icon size={24} aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div><p className="landing-v2-note">Peer collaboration is optional. Organize and study at your own pace, then ask for help when you need it.</p></div></section>
  <section className="landing-section landing-v2-soft" id="features" aria-labelledby="features-title"><div className="container"><div className="landing-section-heading"><span className="landing-kicker">One place to keep learning</span><h2 id="features-title">Your subjects. Your practice. Your peers.</h2></div><div className="landing-v2-three">{features.map(([Icon,title,text])=><article className="landing-feature-card" key={title}><span className="landing-feature-icon"><Icon size={25} aria-hidden="true"/></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
  <section className="landing-section" id="community" aria-labelledby="trust-title"><div className="container landing-v2-trust"><div><span className="landing-kicker">Privacy &amp; trust</span><h2 id="trust-title">Keep learning under your control</h2><p>Clear permissions and honest limits support a useful academic workspace.</p></div><div className="landing-v2-trust-list"><p><ShieldCheck size={21} aria-hidden="true"/><span><strong>Institutional email verification</strong> confirms account email ownership. It is not an institutional endorsement or a certification of tutor qualifications.</span></p><p><LockKeyhole size={21} aria-hidden="true"/><span><strong>Private uploads by default.</strong> You manage your own terms, subjects and materials independently.</span></p><p><Users size={21} aria-hidden="true"/><span><strong>Reporting and moderation</strong> support learning content, circles and session exceptions. Normal sessions use the existing validation workflow.</span></p><p><Sparkles size={21} aria-hidden="true"/><span><strong>Review AI output.</strong> External processing requires consent and remains subject to synthetic-only provider restrictions.</span></p></div></div></section>
  <section className="landing-section landing-v2-soft" id="faq" aria-labelledby="faq-title"><div className="container landing-v2-faq"><div className="landing-section-heading"><span className="landing-kicker">Before you begin</span><h2 id="faq-title">Frequently asked questions</h2></div>{faqs.map(([question,answer],i)=><details key={question} id={i===1?'credit-system':undefined}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
  <section className="landing-final-cta"><div className="container"><div className="landing-cta-box"><h2>Make room for your next learning step.</h2><p>Start with a subject. Build a study routine that works for you.</p><Link className="btn btn-primary btn-lg" to={target}>{isAuthenticated?'Open workspace':'Create Account'}<ArrowRight size={18} aria-hidden="true"/></Link></div><div id="sdg-section" className="landing-v2-note"><h3 id="sdg-title">Supporting accessible learning</h3><p>Acadova's learning-first direction aligns with SDG 4: Quality Education.</p></div></div></section>
 </div>;
};
export default LandingPage;
