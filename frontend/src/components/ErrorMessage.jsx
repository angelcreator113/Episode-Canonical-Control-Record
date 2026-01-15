/**
 * ErrorMessage Component
 * Displays error messages to users
 */

import React from 'react';
import '../styles/ErrorMessage.css';

const ErrorMessage = ({ message, onDismiss }) => {
  if (!message) return null;

  // Handle both string and object error messages
  const errorText = typeof message === 'string' ? message : message?.message || String(message);

  return (
    <div className="error-message">
      <div className="error-content">
        <span className="error-icon">❌</span>
        <p>{errorText}</p>
        {onDismiss && (
          <button className="error-dismiss" onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
