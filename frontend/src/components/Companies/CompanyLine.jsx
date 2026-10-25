/**
 * "This is a company: The Column →" (Evoni, 2026-10-24: "how should we
 * handle relationships between brands?"). A registry character marked as a
 * company (PUT /api/v1/companies/:slug/registry-character) says so on the
 * Relationships Inspector and on its character page, linking to the
 * company's profile.
 *
 *   CompanyLine({ company })          the line, from { slug, name } already in hand
 *   CharacterCompanyLine({ character })  the character page's: reads the company
 *                                     its extra_fields.company_id names
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import api from '../../services/api';
import './CompanyLine.css';

export function CompanyLine({ company }) {
  if (!company?.slug) return null;
  return (
    <p className="co-line" data-testid="company-line">
      <Building2 size={14} aria-hidden="true" />
      <span>This is a company:</span>
      <Link className="co-line-link" to={`/brands/${company.slug}`}>{company.name} <span aria-hidden="true">→</span></Link>
    </p>
  );
}

export function CharacterCompanyLine({ character }) {
  const id = character?.extra_fields?.company_id || null;
  const [company, setCompany] = useState(null);
  useEffect(() => {
    if (!id) { setCompany(null); return undefined; }
    let live = true;
    api.get(`/api/v1/companies/${encodeURIComponent(id)}`)
      .then((r) => { if (live) setCompany(r.data?.company || null); })
      .catch((err) => { console.error('[CompanyLine] the company could not be read:', err); if (live) setCompany(null); });
    return () => { live = false; };
  }, [id]);
  return <CompanyLine company={company} />;
}

export default CompanyLine;
