import React from 'react';
import { BookOpen, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarRating from '../common/StarRating';

export const PeerCard = ({ peer, onRequest, compact = false }) => (
  <article className={`peer-card ${compact ? 'peer-card-compact' : ''}`}>
    <div className="peer-card-heading">
      <div className="peer-avatar" aria-hidden="true">{peer.name?.charAt(0) || 'P'}</div>
      <div>
        <h3>{peer.name}</h3>
        <div className="peer-rating" aria-label={`Rating ${Number(peer.rating ?? 0).toFixed(1)} out of 5`}>
          <StarRating rating={peer.rating ?? 0} size={14} />
          <span>{Number(peer.rating ?? 0).toFixed(1)}</span>
        </div>
      </div>
    </div>

    <div className="peer-skills">
      <span>Can teach</span>
      <div>
        {(peer.skillsToTeach || []).map((skill, index) => (
          <span key={`${skill}-${index}`} className="badge badge-info">{skill}</span>
        ))}
      </div>
    </div>

    <div className="peer-card-actions">
      <Link to={`/tutors/${peer._id}`} className="btn btn-secondary btn-sm">
        <UserRound size={14} /> View Profile
      </Link>
      {onRequest ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onRequest(peer)}>
          <BookOpen size={14} /> Request Session
        </button>
      ) : (
        <Link to={`/tutors/${peer._id}#request-session`} className="btn btn-primary btn-sm">
          <BookOpen size={14} /> Request Session
        </Link>
      )}
    </div>
  </article>
);

export default PeerCard;
