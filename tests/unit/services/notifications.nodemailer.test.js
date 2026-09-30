/**
 * The nodemailer call site keeps working across 8 → 10 (Task #2335).
 *
 * src/services/notifications.js is the only nodemailer user: it requires
 * the package from CommonJS, creates a Gmail transport and sends
 * from/to/subject/text/html. No network here. The Gmail transport's
 * resolved settings are read without connecting, and the real sendEmail
 * builds its message through nodemailer's own JSON transport (the Gmail
 * transport swapped out), so the message nodemailer composes is checked,
 * not a mock of it.
 */
// notifications.js reads these once, at load.
process.env.LALAVERSE_EMAIL = 'studio@example.test';
process.env.NOTIFY_EMAIL = 'evoni@example.test';

const nodemailer = require('nodemailer');
const notifications = require('../../../src/services/notifications');

describe('nodemailer at the notifications call site (Task #2335)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('require() from CommonJS exposes createTransport', () => {
    expect(typeof nodemailer.createTransport).toBe('function');
  });

  it('the Gmail service resolves to smtp.gmail.com:465 over TLS, without connecting', () => {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'a@example.test', pass: 'not-a-secret' } });
    expect(typeof transporter.sendMail).toBe('function');
    const opts = transporter.transporter.options;
    expect({ host: opts.host, port: opts.port, secure: opts.secure }).toEqual({ host: 'smtp.gmail.com', port: 465, secure: true });
    transporter.close();
  });

  it('sendEmail composes from, to, subject, text and html', async () => {
    const realCreate = nodemailer.createTransport.bind(nodemailer);
    let info = null;
    jest.spyOn(nodemailer, 'createTransport').mockImplementation(() => {
      const transporter = realCreate({ jsonTransport: true });
      const send = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (message) => { info = await send(message); return info; };
      return transporter;
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await notifications.sendEmail({ subject: 'Coverage ready', text: 'Plain body', html: '<p>HTML body</p>' });
    expect(result.ok).toBe(true);
    const message = JSON.parse(info.message);
    expect(message).toMatchObject({
      subject: 'Coverage ready',
      text: 'Plain body',
      html: '<p>HTML body</p>',
      from: { address: 'studio@example.test', name: 'LalaVerse Studio' },
      to: [{ address: 'evoni@example.test' }],
    });
  });
});
