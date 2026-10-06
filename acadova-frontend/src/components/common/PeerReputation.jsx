import StarRating from './StarRating';
import { peerReputation } from '../../utils/peerReputation';
export default function PeerReputation({ peer, size = 14 }) {
  const reputation = peerReputation(peer);
  return <div className="peer-rating">{reputation.rated && <StarRating rating={peer.rating} size={size} showValue={false} />}<span>{reputation.label}</span></div>;
}
