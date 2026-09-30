/**
 * TermsReopenPanel (Reopen terms ruling, §8(cc); Task #2378): the Reopen
 * button shows only when the server's test passes, otherwise why not;
 * reopening asks for confirmation; a reopened event offers Save and relock;
 * after the save, regeneration is offered with the money reminder.
 */
import { useState } from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import TermsReopenPanel from './TermsReopenPanel';

const base = '/api/v1/world/show-1/events/ev-1/terms';
const EPISODE = { id: 'ep-1', episode_number: 3, title: 'Gala Night' };

function eligibility(body) {
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, reopened: null, ...body } });
}

// The page owns the offer (it survives the reload after a relock).
function Harness({ onChanged = () => {}, onRegenerateInvitation = () => {}, ...props }) {
  const [offer, setOffer] = useState(null);
  return (
    <TermsReopenPanel
      showId="show-1" eventId="ev-1" locked reopen={null} episode={EPISODE}
      offer={offer} onOffer={setOffer} onChanged={onChanged}
      onRegenerateInvitation={onRegenerateInvitation} onToast={() => {}}
      {...props}
    />
  );
}

describe('TermsReopenPanel (Task #2378)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('shows Reopen terms when eligible', async () => {
    eligibility({ eligible: true, reasons: [] });
    render(<Harness />);
    expect(await screen.findByTestId('terms-reopen-button')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(`${base}/reopen-eligibility`);
    expect(screen.queryByTestId('terms-reopen-why')).toBeNull();
  });

  test('hides the button and says why when not eligible', async () => {
    eligibility({ eligible: false, reasons: [{ code: 'EPISODE_NOT_DRAFT', message: 'The episode is published, not a draft.' }] });
    render(<Harness />);
    const why = await screen.findByTestId('terms-reopen-why');
    expect(why.textContent).toContain('The episode is published, not a draft.');
    expect(screen.queryByTestId('terms-reopen-button')).toBeNull();
  });

  test('says it is checking while the eligibility request is pending', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    render(<Harness />);
    expect(screen.getByTestId('terms-reopen-checking').textContent).toContain('Checking whether these terms can be reopened');
    expect(screen.queryByTestId('terms-reopen-button')).toBeNull();
  });

  test('renders nothing on an unlocked event', () => {
    const { container } = render(<Harness locked={false} />);
    expect(container.innerHTML).toBe('');
    expect(api.get).not.toHaveBeenCalled();
  });

  test('reopening asks for confirmation; cancel sends nothing, confirm sends confirm: true', async () => {
    eligibility({ eligible: true, reasons: [] });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const onChanged = vi.fn();
    render(<Harness onChanged={onChanged} />);

    fireEvent.click(await screen.findByTestId('terms-reopen-button'));
    expect(screen.getByTestId('terms-reopen-confirm').textContent).toContain('Episode 3 stays linked');
    fireEvent.click(screen.getByTestId('terms-reopen-cancel'));
    expect(screen.queryByTestId('terms-reopen-confirm')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('terms-reopen-button'));
    fireEvent.click(screen.getByTestId('terms-reopen-confirm-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${base}/reopen`, { confirm: true }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  test('a reopened event offers Save and relock; the offer after it carries the money reminder', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${base}/relock`) {
        return {
          data: {
            success: true,
            relocked: { episode_id: 'ep-1' },
            regenerate: {
              invitation: { offered: true, mentionsMoney: true, reminder: 'Terms changed; the invitation mentions money. Regenerate?' },
              script: { offered: true, mentionsMoney: true, reminder: 'Terms changed; the script mentions money. Regenerate?' },
            },
          },
        };
      }
      return { data: { success: true } };
    });
    const onRegenerateInvitation = vi.fn();
    render(<Harness reopen={{ at: '2026-09-30T12:00:00Z', by: { name: 'Evoni' } }} onRegenerateInvitation={onRegenerateInvitation} />);

    expect(screen.getByTestId('terms-reopened').textContent).toContain('Terms reopened');
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('terms-relock'));

    const offer = await screen.findByTestId('terms-regenerate-offer');
    expect(offer.textContent).toContain('Optional');
    expect(screen.getByTestId('reminder-invitation').textContent).toContain('Terms changed; the invitation mentions money. Regenerate?');
    expect(screen.getByTestId('reminder-script').textContent).toContain('Terms changed; the script mentions money. Regenerate?');
    // Offered, not forced: nothing regenerates until clicked.
    expect(onRegenerateInvitation).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('regenerate-invitation'));
    expect(onRegenerateInvitation).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('regenerate-invitation')).toBeNull();

    fireEvent.click(screen.getByTestId('regenerate-script'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/generate-script', { episode_id: 'ep-1' }));
  });

  test('no reminder when the terms do not mention money; the offer can be dismissed', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        relocked: { episode_id: 'ep-1' },
        regenerate: {
          invitation: { offered: true, mentionsMoney: false, reminder: null },
          script: { offered: false, mentionsMoney: false, reminder: null },
        },
      },
    });
    render(<Harness reopen={{ at: null, by: null }} />);
    fireEvent.click(screen.getByTestId('terms-relock'));
    await screen.findByTestId('terms-regenerate-offer');
    expect(screen.queryByTestId('reminder-invitation')).toBeNull();
    expect(screen.queryByTestId('regenerate-script')).toBeNull();
    fireEvent.click(screen.getByTestId('terms-offer-dismiss'));
    expect(screen.queryByTestId('terms-regenerate-offer')).toBeNull();
  });
});
