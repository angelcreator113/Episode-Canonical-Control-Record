/**
 * useAuth Hook
 * Custom hook for authentication
 * 
 * DEPRECATED: This file is kept for backward compatibility only.
 * Use the AuthContext directly: import { useAuth } from '../contexts/AuthContext';
 */

import { useAuth } from '../contexts/AuthContext';

// Re-export the context-based hook
export { useAuth };
export default useAuth;
