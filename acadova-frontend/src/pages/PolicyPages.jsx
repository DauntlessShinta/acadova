import React from 'react';
import { Link } from 'react-router-dom';

function PolicyPage({ title, children }) {
  return <div className="container-narrow policy-page">
    <Link to="/" className="btn btn-secondary btn-sm">Acadova home</Link>
    <h1>{title}</h1>
    <p className="form-hint">Acadova academic project policy · October 2026</p>
    {children}
    <p className="policy-related"><Link to="/terms">Terms of Use</Link> · <Link to="/privacy">Privacy Policy</Link> · <Link to="/community-guidelines">Community Guidelines</Link></p>
  </div>;
}

export function TermsContent({ sectionHeading: Heading = 'h2' }) {
  return <>
    <section><Heading>Using Acadova</Heading><p>Acadova is a peer-to-peer academic learning platform. Provide reasonable, accurate account information and use the service responsibly for learning and teaching.</p></section>
    <section><Heading>Respect and honesty</Heading><p>Treat others respectfully. Do not post abusive or inappropriate material, impersonate others, or misuse Sessions, messages, reviews, assessments, Credits, or moderation tools. Participate honestly in tutoring and Session confirmation.</p></section>
    <section><Heading>Credits and content</Heading><p>Acadova Credits are internal learning credits with no cash or real-money value. Learning content and accounts may be reviewed, moderated, or suspended under platform rules.</p></section>
    <section><Heading>External meetings and changes</Heading><p>Google Meet, Teams, Zoom, and similar meeting tools are third-party services. You are responsible for your conduct there and should follow their rules. Acadova may change during academic project development.</p></section>
  </>;
}

export function PrivacyContent({ sectionHeading: Heading = 'h2' }) {
  return <>
    <section><Heading>Information Acadova handles</Heading><p>Acadova stores account email and display name, skills to learn and teach, Session records and messages, reviews, learning activity, credit balance and transaction history, notifications, and moderation, audit, and security events. When configured, Google sign-in links a verified Google identity to an account.</p></section>
    <section><Heading>Why it is used</Heading><p>This information supports authentication, peer matching, tutoring Sessions, self-paced learning, Credits, moderation, security, and notifications.</p></section>
    <section><Heading>Security and outside services</Heading><p>Passwords are stored as hashes, not plaintext. Verification and reset tokens are invalidated after valid use. Depending on configuration, Acadova may use Google for identity or meetings, Brevo for email delivery, and OneSignal for push delivery. External meeting providers have their own practices.</p></section>
    <section><Heading>Project status</Heading><p>Acadova is an academic project. This page describes current handling; it does not claim a certification or a data-deletion service that the project does not provide.</p></section>
  </>;
}

export function TermsPage() { return <PolicyPage title="Terms of Use"><TermsContent /></PolicyPage>; }

export function PrivacyPage() { return <PolicyPage title="Privacy Policy"><PrivacyContent /></PolicyPage>; }

export function GuidelinesPage() {
  return <PolicyPage title="Community Guidelines">
    <section><h2>Help peers learn</h2><p>Collaborate respectfully, participate honestly in tutoring and learning, share appropriate resources, send responsible messages, and leave constructive reviews.</p></section>
    <section><h2>Keep Acadova fair</h2><p>Do not harass, spam, impersonate, share abusive or inappropriate content, submit false Session confirmations, manipulate Credits, cheat on assessments, or misuse reviews and reports.</p></section>
    <section><h2>Moderation</h2><p>Staff may review content and disputes. Serious or repeated violations may result in content moderation or account suspension.</p></section>
  </PolicyPage>;
}
