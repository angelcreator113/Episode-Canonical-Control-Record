import React, { useState } from 'react';
import './TagInput.css';

/**
 * TagInput Component
 * 
 * A reusable, production-ready tag input component with:
 * - Add tags by pressing Enter or comma
 * - Remove tags with X button or Backspace
 * - Prevent duplicates
 * - Clear input after adding tag
 * - Add on blur (when focus leaves input)
 * 
 * Usage:
 * const [tags, setTags] = useState([]);
 * <TagInput tags={tags} onChange={setTags} placeholder="Add tags..." />
 */
function TagInput({ 
  tags = [], 
  onChange, 
  placeholder = "Add tags...",
  disabled = false,
  maxTags = null
}) {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Add tag on Enter or comma
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
      return;
    }
    
    // Remove last tag on Backspace if input is empty
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      const newTags = [...tags];
      newTags.pop();
      onChange(newTags);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    
    // Validate: not empty, no duplicates, respect maxTags
    if (!trimmedValue) {
      setInputValue('');
      return;
    }

    if (tags.includes(trimmedValue)) {
      setInputValue('');
      return;
    }

    if (maxTags && tags.length >= maxTags) {
      setInputValue('');
      return;
    }

    onChange([...tags, trimmedValue]);
    setInputValue('');
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleBlur = () => {
    // Add tag when input loses focus (if there's text)
    if (inputValue.trim()) {
      addTag();
    }
  };

  const isFull = maxTags && tags.length >= maxTags;

  return (
    <div className="tag-input-container">
      <div className={`tag-input-wrapper ${disabled ? 'disabled' : ''}`}>
        {/* Display existing tags */}
        {tags.map((tag, index) => (
          <span key={index} className="tag">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="tag-remove"
              aria-label={`Remove tag: ${tag}`}
              disabled={disabled}
              title="Remove tag"
            >
              ×
            </button>
          </span>
        ))}
        
        {/* Input for new tags */}
        {!isFull && (
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="tag-input"
            disabled={disabled}
          />
        )}
      </div>
      
      {/* Helper text */}
      <small className="tag-input-hint">
        {isFull ? (
          <span className="tag-input-limit">Maximum {maxTags} tags reached</span>
        ) : (
          <>
            Press <kbd>Enter</kbd> or <kbd>,</kbd> to add tags
            {maxTags && (
              <span className="tag-input-count"> • {tags.length}/{maxTags}</span>
            )}
          </>
        )}
      </small>
    </div>
  );
}

export default TagInput;
