import React from 'react';
import ReviewModeration from '../../components/staff/ReviewModeration';

export const AdminModerationPage = () => <div className="staff-page"><header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Moderation</span><h1>Review moderation</h1><p>Hide or restore peer reviews using the shared staff review workflow.</p></div></header><ReviewModeration /></div>;

export default AdminModerationPage;
