import { Award, BookOpen, HeartHandshake, Users, Compass, LockKeyhole } from 'lucide-react';
const icons = {'first-step':BookOpen,'first-mentor':HeartHandshake,'helping-hand':Users,'consistent-mentor':Award,'academic-explorer':Compass};
export default function GrowthAchievement({ badge }) {
  const Icon = badge.earned ? icons[badge.id] || Award : LockKeyhole;
  return <article className={badge.earned?'is-earned':''} data-achievement={badge.id}>
    <span className="ac-achievement-icon"><Icon size={24} aria-hidden="true"/></span>
    <h3>{badge.title}</h3><p>{badge.condition}</p><small>{badge.earned?'Earned':badge.revoked?'Revoked after evidence reversal':'Locked'}</small>
  </article>;
}
