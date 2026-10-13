import React from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import ReviewModeration from '../../components/staff/ReviewModeration';

export const AdminModerationPage = () => <div className="staff-page moderation-page">
  <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Moderation</span><h1>Review moderation</h1><p>Hide or restore peer reviews using the shared staff review workflow.</p></div></header>
  <ReviewModeration actions={<Link to="/admin/disputes" className="btn btn-secondary btn-sm"><Flag size={16} aria-hidden="true" />Session disputes</Link>} />
</div>;

export default AdminModerationPage;
