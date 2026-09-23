import React, { useState } from 'react';
import { X } from 'lucide-react';

export const TagInput = ({
  tags = [],
  onChange = () => {},
  placeholder = 'Type a skill and press Enter...',
  maxTags = 15,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().replace(/^,|,$/g, '');
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="tag-input-container">
      {tags.map((tag, idx) => (
        <span key={idx} className="tag-chip">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(idx)}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < maxTags && (
        <input
          type="text"
          className="tag-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : 'Add more...'}
        />
      )}
    </div>
  );
};

export default TagInput;

