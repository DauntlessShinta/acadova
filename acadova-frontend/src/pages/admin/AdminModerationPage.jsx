import React from 'react';
import { Link } from 'react-router-dom';
import ReviewModeration from '../../components/staff/ReviewModeration';

export const AdminModerationPage = () => <div className="staff-page"><header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Moderation</span><h1>Review moderation</h1><p>Hide or restore peer reviews using the shared staff review workflow.</p></div></header><Link to="/moderator/disputes" className="btn btn-secondary btn-sm">Review session disputes</Link><ReviewModeration /></div>;

export default AdminModerationPage;
