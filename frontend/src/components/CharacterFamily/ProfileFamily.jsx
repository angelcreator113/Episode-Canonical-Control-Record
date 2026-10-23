/**
 * A Pulse profile's family, one line under its name in the profile panel
 * (Evoni, 2026-10-23): "Family: Jade Monroe (sister) · Aunt Bee (aunt)".
 * GET /families/profile/:id reads the profile's 'family' Pulse links (each
 * with the role from the two characters' tie) and the named families it,
 * or its character, is in. Nothing shows when they have no family.
 */
import { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import './ProfileFamily.css';

export const getProfileFamilyApi = (profileId) => apiClient.get(`${API_URL}/families/profile/${profileId}`);

export default function ProfileFamily({ profileId }) {
  const [family, setFamily] = useState([]);
  useEffect(() => {
    let live = true;
    setFamily([]);
    if (profileId == null) return undefined;
    Promise.resolve(getProfileFamilyApi(profileId))
      .then((res) => { if (live) setFamily(res?.data?.family || []); })
      .catch((err) => console.error('[ProfileFamily] family load failed:', err));
    return () => { live = false; };
  }, [profileId]);
  if (!family.length) return null;
  return (
    <p className="pf-family" data-testid="profile-family">
      <span className="pf-label">Family:</span>{' '}
      {family.map((f, i) => (
        <span key={`${f.character_id || f.profile_id || f.name}-${i}`} className="pf-person">
          {i > 0 && <span className="pf-dot" aria-hidden="true"> · </span>}
          {f.character_id ? <a href={`/character/${f.character_id}`}>{f.name}</a> : f.name}
          {f.role ? ` (${f.role})` : f.family ? ` (${f.family})` : ''}
        </span>
      ))}
    </p>
  );
}
