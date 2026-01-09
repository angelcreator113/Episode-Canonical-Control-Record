/**
 * Form Validators
 * Validation utilities for forms
 */

export const validators = {
  email: (value) => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Invalid email format';
    return null;
  },

  password: (value) => {
    if (!value) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  },

  required: (value, fieldName = 'This field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  },

  minLength: (value, minLength, fieldName = 'This field') => {
    if (value && value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters`;
    }
    return null;
  },

  episodeNumber: (value) => {
    if (!value) return 'Episode number is required';
    if (isNaN(value) || value < 1) return 'Episode number must be a positive number';
    return null;
  },

  airDate: (value) => {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'Invalid date format';
    }
    return null;
  },
};

export default validators;
