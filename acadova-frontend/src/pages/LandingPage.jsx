import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Code2,
  Coins,
  Compass,
  Database,
  GraduationCap,
  Layers,
  Lock,
  MessageSquare,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';

const learningSteps = [
  {
    number: '01',
    title: 'Create your profile',
    description: 'Share the subjects you can teach and the skills you want to develop.',
    tags: ['Skills to teach', 'Skills to learn'],
  },
  {
    number: '02',
    title: 'Find your match',
    description: 'Explore peer tutors by subject, academic focus, and community reputation.',
    tags: ['Subject discovery', 'Peer compatibility'],
  },
  {
    number: '03',
    title: 'Exchange knowledge',
    description: 'Request a focused study session and use credits instead of direct payment.',
    tags: ['Shared sessions', 'No cash payment'],
  },
  {
    number: '04',
    title: 'Grow together',
    description: 'Teach, learn, leave constructive feedback, and strengthen the community.',
    tags: ['Peer ratings', 'Continued growth'],
  },
];

const features = [
  {
    icon: Search,
    title: 'Skill-based discovery',
    description: 'Find students who can help with the exact topic you want to understand.',
  },
  {
    icon: Calendar,
    title: 'Session workflow',
    description: 'Request, accept, schedule, complete, or cancel sessions from one clear flow.',
  },
  {
    icon: Coins,
    title: 'Learning credits',
    description: 'Earn credits by teaching and use them to learn from another student.',
  },
  {
    icon: Star,
    title: 'Community reputation',
    description: 'Ratings after completed sessions encourage helpful, accountable exchanges.',
  },
  {
    icon: ShieldCheck,
    title: 'Protected accounts',
    description: 'Authenticated profiles keep personal sessions and credit activity private.',
  },
  {
    icon: Compass,
    title: 'One student workspace',
    description: 'Move between tutor discovery, sessions, credits, and profile management.',
  },
];

const skillOptions = [
  {
    key: 'web',
    title: 'Web Development',
    category: 'Software Development',
    icon: Code2,
    description: 'Explore peer support for frontend foundations, JavaScript, React, and full-stack concepts.',
    topics: ['JavaScript', 'React', 'APIs'],
  },
  {
    key: 'math',
    title: 'Mathematics',
    category: 'Foundational Studies',
    icon: Layers,
    description: 'Work through calculus, algebra, statistics, and problem-solving techniques with peers.',
    topics: ['Calculus', 'Algebra', 'Statistics'],
  },
  {
    key: 'networking',
    title: 'Networking',
    category: 'IT Infrastructure',
    icon: Network,
    description: 'Review network fundamentals, addressing, routing, and practical troubleshooting concepts.',
    topics: ['TCP/IP', 'Routing', 'CCNA'],
  },
  {
    key: 'security',
    title: 'Cybersecurity',
    category: 'Information Assurance',
    icon: Lock,
    description: 'Build confidence with security principles, secure development, and threat awareness.',
    topics: ['Security basics', 'Threats', 'Secure coding'],
  },
  {
    key: 'database',
    title: 'Databases',
    category: 'Data Management',
    icon: Database,
    description: 'Practice data modeling, SQL, normalization, MongoDB, and database design decisions.',
    topics: ['SQL', 'MongoDB', 'Normalization'],
  },
];

const dashboardViews = {
  overview: {
    eyebrow: 'Workspace overview',
    title: 'Everything important, in one place',
    copy: 'See the learning journey at a glance without presenting sample activity as live platform data.',
    items: ['Discover peers by skill', 'Review your session workflow', 'Keep your academic profile current'],
  },
  sessions: {
    eyebrow: 'Session workspace',
    title: 'Follow each exchange clearly',
    copy: 'Requests move through transparent stages so both participants understand what happens next.',
    items: ['Pending request', 'Accepted session', 'Completed exchange'],
  },
  credits: {
    eyebrow: 'Credit ledger',
    title: 'Understand every credit movement',
    copy: 'Completed learning exchanges create a readable history of credits earned and spent.',
    items: ['Teach to earn', 'Learn with credits', 'Review transaction history'],
  },
};

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [selectedSkillKey, setSelectedSkillKey] = useState('web');
  const [teachSkill, setTeachSkill] = useState('Web Development');
  const [learnSkill, setLearnSkill] = useState('Database Design');
  const [exchangePreviewed, setExchangePreviewed] = useState(false);
  const [dashboardView, setDashboardView] = useState('overview');

  const selectedSkill = skillOptions.find((skill) => skill.key === selectedSkillKey) || skillOptions[0];
  const SelectedSkillIcon = selectedSkill.icon;
  const activeDashboardView = dashboardViews[dashboardView];

  useEffect(() => {
    if (!location.hash) return;

    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash]);

  const previewExchange = () => {
    setExchangePreviewed((current) => !current);
  };

  return (
    <div className="landing-page">
      <header className="landing-hero" id="hero">
        <div className="landing-orb landing-orb-one" aria-hidden="true" />
        <div className="landing-orb landing-orb-two" aria-hidden="true" />
        <div className="container landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-badge-row">
              <span className="landing-badge"><BookOpen size={14} /> SDG 4 — Quality Education</span>
              <span className="landing-badge landing-badge-success"><Coins size={14} /> Credit-based exchange</span>
            </div>

            <h1>
              Learn what you need.<br />
              <span>Teach what you know.</span>
            </h1>

            <p className="landing-hero-description">
              Acadova connects students who want to learn with peers who have the skills to teach—powered by a fair, cashless academic credit system.
            </p>

            <div className="landing-action-row">
              <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary btn-lg">
                {isAuthenticated ? 'Open your dashboard' : 'Start learning'} <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="btn btn-secondary btn-lg">How it works</a>
            </div>

            <p className="landing-trust-line"><CheckCircle2 size={18} /> No direct payments between students—just shared knowledge.</p>

            <div className="landing-value-strip" aria-label="Acadova product values">
              <div><strong>Peer-to-peer</strong><span>Student-led support</span></div>
              <div><strong>Credit-based</strong><span>Knowledge has value</span></div>
              <div><strong>Skill matching</strong><span>Find relevant help</span></div>
              <div><strong>Reputation</strong><span>Accountable exchanges</span></div>
            </div>
          </div>

          <div className="landing-network" aria-label="Illustration of academic skills connected through Acadova">
            <svg className="landing-network-lines" viewBox="0 0 520 520" aria-hidden="true">
              <defs>
                <linearGradient id="acadova-line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.85" />
                  <stop offset="55%" stopColor="#93C5FD" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <path d="M110 105 Q220 190 260 260" />
              <path d="M410 110 Q320 190 260 260" />
              <path d="M90 390 Q190 320 260 260" />
              <path d="M420 400 Q330 330 260 260" />
              <path d="M70 250 Q170 250 260 260" />
            </svg>

            <div className="landing-network-hub">
              <div className="landing-network-pulse" aria-hidden="true" />
              <div className="landing-network-hub-icon"><Layers size={26} /></div>
              <strong>Acadova</strong>
              <span>Skill exchange</span>
            </div>

            <div className="landing-skill-node node-one"><Code2 size={18} /><span>Web Development</span></div>
            <div className="landing-skill-node node-two"><Database size={18} /><span>Databases</span></div>
            <div className="landing-skill-node node-three"><Network size={18} /><span>Networking</span></div>
            <div className="landing-skill-node node-four"><Lock size={18} /><span>Cybersecurity</span></div>
            <div className="landing-skill-node node-five"><GraduationCap size={18} /><span>Mathematics</span></div>

            <div className="landing-exchange-pill">
              <Zap size={15} /> Teach <strong>→ Earn → Learn</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section landing-problem" id="problem" aria-labelledby="problem-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">The educational barrier</span>
            <h2 id="problem-title">Learning should not depend on your budget.</h2>
            <p>Students often need help in challenging subjects while already holding valuable knowledge they can share with someone else.</p>
          </div>

          <div className="landing-comparison-grid">
            <article className="landing-comparison-card landing-traditional-card">
              <div className="landing-card-heading">
                <h3>Traditional tutoring</h3>
                <span>High friction</span>
              </div>
              <div className="landing-mini-flow" aria-label="Traditional tutoring flow">
                <span>Money</span><ArrowRight size={18} /><span>Paid tutor</span><ArrowRight size={18} /><span>Access</span>
              </div>
              <ul className="landing-check-list landing-negative-list">
                <li><X size={17} /> Hourly costs can exclude students who need support.</li>
                <li><X size={17} /> The exchange is usually one-directional.</li>
                <li><X size={17} /> Student knowledge remains underused.</li>
              </ul>
            </article>

            <div className="landing-vs-mark" aria-hidden="true">VS</div>

            <article className="landing-comparison-card landing-acadova-card">
              <div className="landing-card-heading">
                <h3>The Acadova model</h3>
                <span>Peer reciprocity</span>
              </div>
              <div className="landing-mini-flow" aria-label="Acadova exchange flow">
                <span>Knowledge</span><ArrowRight size={18} /><span>Credits</span><ArrowRight size={18} /><span>Growth</span>
              </div>
              <ul className="landing-check-list">
                <li><Check size={17} /> Teaching creates credit for future learning.</li>
                <li><Check size={17} /> Students can be learners and tutors.</li>
                <li><Check size={17} /> Ratings support community accountability.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">A simple four-step process</span>
            <h2 id="how-title">How Acadova works</h2>
            <p>A clear path from sharing your strengths to getting help with your next academic challenge.</p>
          </div>

          <div className="landing-timeline">
            <div className="landing-timeline-line" aria-hidden="true" />
            {learningSteps.map((step) => (
              <article className="landing-step" key={step.number}>
                <div className="landing-step-number">{step.number}</div>
                <div className="landing-step-card">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="landing-chip-row">
                    {step.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-credit-section" id="credit-system" aria-labelledby="credit-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker landing-kicker-green">A fair knowledge economy</span>
            <h2 id="credit-title">Your knowledge has value.</h2>
            <p>Acadova replaces direct payments with learning credits that circulate through the student community.</p>
          </div>

          <div className="landing-credit-flow" aria-label="Teach, earn, learn, and grow">
            {[
              ['Teach', GraduationCap],
              ['Earn', Coins],
              ['Learn', BookOpen],
              ['Grow', Sparkles],
            ].map(([label, Icon], index) => (
              <React.Fragment key={label}>
                <div><Icon size={18} /><span>{label}</span></div>
                {index < 3 && <ArrowRight size={18} aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>

          <div className={`landing-simulator ${exchangePreviewed ? 'is-previewed' : ''}`}>
            <div className="landing-simulator-header">
              <div>
                <span className="landing-preview-label">Interactive explanation</span>
                <h3>Knowledge swap preview</h3>
                <p>Choose an example teaching skill and a learning goal to see the credit cycle.</p>
              </div>
              <div className="landing-example-balance">
                <span>Example credit balance</span>
                <strong>2 credits</strong>
              </div>
            </div>

            <div className="landing-simulator-grid">
              <label className="landing-sim-box">
                <span><GraduationCap size={17} /> I can teach</span>
                <select value={teachSkill} onChange={(event) => { setTeachSkill(event.target.value); setExchangePreviewed(false); }}>
                  <option>Web Development</option>
                  <option>Calculus</option>
                  <option>Database Fundamentals</option>
                  <option>Computer Networks</option>
                </select>
                <small>Teaching can earn learning credits.</small>
              </label>

              <button type="button" className="landing-swap-button" onClick={previewExchange} aria-label="Preview this example knowledge exchange">
                <Zap size={22} />
              </button>

              <label className="landing-sim-box">
                <span><BookOpen size={17} /> I want to learn</span>
                <select value={learnSkill} onChange={(event) => { setLearnSkill(event.target.value); setExchangePreviewed(false); }}>
                  <option>Database Design</option>
                  <option>Cybersecurity Basics</option>
                  <option>Applied Statistics</option>
                  <option>React Development</option>
                </select>
                <small>Credits can be used for a peer session.</small>
              </label>
            </div>

            <p className="landing-simulator-summary" aria-live="polite">
              {exchangePreviewed ? (
                <>Example complete: teach <strong>{teachSkill}</strong>, earn credits, then use them to learn <strong>{learnSkill}</strong>.</>
              ) : (
                <>Teaching <strong>{teachSkill}</strong> can fund a peer session in <strong>{learnSkill}</strong> without changing any real account balance.</>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-features" id="features" aria-labelledby="features-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">Built for academic exchange</span>
            <h2 id="features-title">Everything you need to share skills.</h2>
            <p>Focused tools support peer discovery, session coordination, credit exchange, and reputation.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="landing-feature-card" key={title}>
                <div className="landing-feature-icon"><Icon size={23} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-skills" id="skill-network" aria-labelledby="skills-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">Illustrative skill explorer</span>
            <h2 id="skills-title">Everyone knows something worth sharing.</h2>
            <p>Explore example academic categories that can form a connected peer-learning network.</p>
          </div>

          <div className="landing-skill-explorer">
            <div className="landing-skill-map" aria-label="Example skill categories">
              <div className="landing-skill-map-center"><Layers size={24} /><span>Acadova skills</span></div>
              {skillOptions.map(({ key, title, icon: Icon }, index) => (
                <button
                  type="button"
                  className={`landing-skill-button skill-position-${index + 1} ${selectedSkillKey === key ? 'is-selected' : ''}`}
                  key={key}
                  onClick={() => setSelectedSkillKey(key)}
                  aria-pressed={selectedSkillKey === key}
                >
                  <Icon size={18} /><span>{title}</span>
                </button>
              ))}
            </div>

            <article className="landing-skill-detail" aria-live="polite">
              <div className="landing-skill-detail-icon"><SelectedSkillIcon size={26} /></div>
              <span className="landing-preview-label">{selectedSkill.category}</span>
              <h3>{selectedSkill.title}</h3>
              <p>{selectedSkill.description}</p>
              <div className="landing-chip-row">
                {selectedSkill.topics.map((topic) => <span key={topic}>{topic}</span>)}
              </div>
              <Link to={isAuthenticated ? `/tutors?subject=${encodeURIComponent(selectedSkill.title)}` : '/register'} className="btn btn-primary">
                {isAuthenticated ? 'Find matching peers' : 'Join to explore skills'} <ArrowRight size={16} />
              </Link>
              <small>This explorer is a category preview, not a list of live tutors.</small>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-dashboard-section" id="dashboard-preview" aria-labelledby="dashboard-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">Dashboard preview</span>
            <h2 id="dashboard-title">A focused workspace for every exchange.</h2>
            <p>This illustrative preview shows how students can organize learning activity without representing live platform data.</p>
          </div>

          <div className="landing-dashboard-preview">
            <div className="landing-browser-bar" aria-hidden="true">
              <div><span /><span /><span /></div>
              <p><Lock size={12} /> acadova / dashboard preview</p>
              <em>Illustrative</em>
            </div>
            <div className="landing-dashboard-body">
              <aside className="landing-dashboard-nav" aria-label="Dashboard preview views">
                <div className="landing-dashboard-brand"><Layers size={19} /><span>Student workspace</span></div>
                <div role="tablist" aria-label="Dashboard preview">
                  {[
                    ['overview', Compass, 'Overview'],
                    ['sessions', Calendar, 'Sessions'],
                    ['credits', Coins, 'Credits'],
                  ].map(([key, Icon, label]) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={dashboardView === key}
                      className={dashboardView === key ? 'is-active' : ''}
                      onClick={() => setDashboardView(key)}
                      key={key}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              </aside>
              <div className="landing-dashboard-content" role="tabpanel">
                <span className="landing-preview-label">{activeDashboardView.eyebrow}</span>
                <h3>{activeDashboardView.title}</h3>
                <p>{activeDashboardView.copy}</p>
                <div className="landing-dashboard-cards">
                  {activeDashboardView.items.map((item, index) => (
                    <div key={item}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{item}</strong>
                      <CheckCircle2 size={18} />
                    </div>
                  ))}
                </div>
                <div className="landing-dashboard-note"><MessageSquare size={18} /> Preview content only—sign in to view your actual Acadova workspace.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-community" id="community" aria-labelledby="community-title">
        <div className="container">
          <div className="landing-section-heading">
            <span className="landing-kicker">A community built on trust</span>
            <h2 id="community-title">Learn from students. Grow with students.</h2>
            <p>Acadova is designed around clear expectations and reciprocal participation—not fabricated testimonials or activity counts.</p>
          </div>

          <div className="landing-community-grid">
            <article><Users size={24} /><h3>Mutual participation</h3><p>One profile can contribute as a learner and as a peer tutor.</p></article>
            <article><Star size={24} /><h3>Constructive reputation</h3><p>Ratings are connected to completed sessions between actual participants.</p></article>
            <article><ShieldCheck size={24} /><h3>Clear accountability</h3><p>Protected workflows keep session actions tied to the people involved.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-sdg" id="sdg-section" aria-labelledby="sdg-title">
        <div className="container">
          <div className="landing-sdg-card">
            <div className="landing-sdg-mark"><BookOpen size={38} /><span>SDG 4</span></div>
            <div>
              <span className="landing-kicker">Quality education</span>
              <h2 id="sdg-title">Supporting accessible learning for every student.</h2>
              <p>Acadova supports the spirit of United Nations Sustainable Development Goal 4 by reducing financial barriers and encouraging students to share practical academic knowledge.</p>
              <div className="landing-sdg-pillars">
                <div><strong>Accessible peer support</strong><span>Learning help without direct student-to-student payment.</span></div>
                <div><strong>Knowledge empowerment</strong><span>Teaching reinforces mastery while helping another learner progress.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="cta-title">
        <div className="container">
          <div className="landing-cta-box">
            <span className="landing-kicker">Start your next exchange</span>
            <h2 id="cta-title">Your next skill could come from your next peer.</h2>
            <p>Create your Acadova profile, share what you know, and discover the subjects other students can help you master.</p>
            <div className="landing-action-row landing-action-center">
              <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary btn-lg">
                {isAuthenticated ? 'Go to dashboard' : 'Join Acadova'} <ArrowRight size={18} />
              </Link>
              {!isAuthenticated && <Link to="/login" className="btn btn-secondary btn-lg">Log in</Link>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
