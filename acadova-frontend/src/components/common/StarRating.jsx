import React, { useState } from 'react';
import { Star } from 'lucide-react';

export const StarRating = ({
  rating = 5,
  maxStars = 5,
  size = 18,
  readOnly = true,
  onChange = () => {},
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const displayRating = hoverRating || rating;

  return (
    <div className="star-rating" role="radiogroup" aria-label={`Rating: ${rating} out of ${maxStars}`}>
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= displayRating;

        if (readOnly) {
          return (
            <Star
              key={index}
              size={size}
              style={{
                fill: isFilled ? 'var(--brass-500)' : 'transparent',
                color: isFilled ? 'var(--brass-500)' : 'var(--border-strong)',
              }}
            />
          );
        }

        return (
          <button
            key={index}
            type="button"
            className="star-btn"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${starValue} star`}
          >
            <Star
              size={size}
              style={{
                fill: isFilled ? 'var(--brass-500)' : 'transparent',
                color: isFilled ? 'var(--brass-500)' : 'var(--border-strong)',
                transition: 'transform 0.1s ease',
                transform: hoverRating === starValue ? 'scale(1.2)' : 'none',
              }}
            />
          </button>
        );
      })}
      {readOnly && (
        <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: 4, color: 'var(--ink-700)' }}>
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;

