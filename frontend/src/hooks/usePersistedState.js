import { useState, useEffect } from 'react';

/**
 * useState that persists to localStorage.
 * @param {string} key - localStorage key
 * @param {*} defaultValue - fallback when nothing stored
 * @param {object} [opts]
 * @param {function} [opts.serialize]   - custom serializer  (default: JSON.stringify)
 * @param {function} [opts.deserialize] - custom deserializer (default: JSON.parse)
 */
export default function usePersistedState(key, defaultValue, opts = {}) {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = opts;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? deserialize(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value));
    } catch { /* quota exceeded — ignore */ }
  }, [key, value, serialize]);

  return [value, setValue];
}
