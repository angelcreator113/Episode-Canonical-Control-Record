/**
 * StartCopiesPreview — what Start Episode copies from the event (Evoni,
 * 2026-10-25): "Starting this copies: 2 goals, 3 guests, the deal, the
 * look, the venue" (lib/eventFlow startCopies, read from what the start
 * carries). Shown in the Start confirm dialog and in the Episode Locations
 * step, before anything is created.
 */
import { Copy } from 'lucide-react';
import { startCopies } from '../../lib/eventActions';
import './EventFlow.css';

export default function StartCopiesPreview({ event, seeds, invitationAsset, venueDate, seasonContext }) {
  const { items } = startCopies(event, { seeds, invitationAsset, venueDate, seasonContext });
  if (!items.length) return null;
  return (
    <div className="eff-copies" data-testid="start-copies">
      <Copy size={14} aria-hidden="true" />
      <p>
        <span>Starting this copies: </span>
        {items.map((it, i) => (
          <span key={it.key} data-testid={`start-copies-${it.key}`}>{it.text}{i < items.length - 1 ? ', ' : '.'}</span>
        ))}
      </p>
    </div>
  );
}
