function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function classTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function buildClassInvitation({ recipient, audience, session, batch }) {
  const learner = audience === 'student';
  const recipientName = recipient.full_name || (learner ? 'Learner' : 'Mentor');
  const start = classTime(session.start_at);
  const subject = learner
    ? `Live class invitation: ${session.title}`
    : `You are scheduled to host: ${session.title}`;
  const action = learner
    ? 'Your batch has a live class scheduled.'
    : 'You have been assigned as the mentor for this live class.';
  const joinText = learner ? 'Join live class' : 'Open Zoom class';
  const joinUrl = session.meeting_url || '';
  const text = `${subject}\n\nHello ${recipientName},\n\n${action}\n\nClass: ${session.title}\nBatch: ${batch.name}\nWhen: ${start} (Asia/Kolkata)${session.description ? `\nDetails: ${session.description}` : ''}${joinUrl ? `\n\n${joinText}: ${joinUrl}` : ''}\n\nPlease sign in to CodeEmy LMS for your class updates.\n\nCodeEmy Technologies`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8fc;color:#19223d;font-family:Arial,sans-serif"><main style="max-width:620px;margin:24px auto;background:#ffffff;border:1px solid #e6e9f2;border-radius:18px;overflow:hidden"><header style="padding:28px 32px;background:linear-gradient(135deg,#2563eb,#6d28d9);color:#fff"><p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;font-weight:700">CODEEMY LMS</p><h1 style="margin:0;font-size:24px">${escapeHtml(subject)}</h1></header><section style="padding:30px 32px"><p>Hello ${escapeHtml(recipientName)},</p><p>${escapeHtml(action)}</p><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px"><tr><td style="padding:12px;font-weight:700">Class</td><td style="padding:12px">${escapeHtml(session.title)}</td></tr><tr><td style="padding:12px;font-weight:700">Batch</td><td style="padding:12px">${escapeHtml(batch.name)}</td></tr><tr><td style="padding:12px;font-weight:700">When</td><td style="padding:12px">${escapeHtml(start)} (IST)</td></tr></table>${session.description ? `<p><strong>Details:</strong> ${escapeHtml(session.description)}</p>` : ''}${joinUrl ? `<p style="margin-top:26px"><a href="${escapeHtml(joinUrl)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700">${joinText}</a></p>` : ''}<p style="color:#60708d;font-size:13px">Please sign in to CodeEmy LMS for your class updates.</p></section></main></body></html>`;
  return { subject, text, html };
}

export async function sendClassInvitationEmails({ students = [], mentor, session, batch, config = process.env, fetcher = fetch }) {
  const recipients = [
    ...students.map((student) => ({ ...student, audience: 'student' })),
    ...(mentor ? [{ ...mentor, audience: 'mentor' }] : []),
  ].filter((recipient) => isEmail(recipient.email));
  const uniqueRecipients = [...new Map(recipients.map((recipient) => [recipient.email.trim().toLowerCase(), recipient])).values()];
  const apiKey = String(config.RESEND_API_KEY || '').trim();
  const from = String(config.EMAIL_FROM || '').trim();
  if (!apiKey || !from) {
    return { emailConfigured: false, recipients: uniqueRecipients.length, sent: 0, failed: 0, skipped: uniqueRecipients.length };
  }
  let sent = 0;
  let failed = 0;
  await Promise.all(uniqueRecipients.map(async (recipient) => {
    const invitation = buildClassInvitation({ recipient, audience: recipient.audience, session, batch });
    try {
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [recipient.email], ...invitation }),
      });
      if (!response.ok) throw new Error('Email provider request failed.');
      sent += 1;
    } catch {
      failed += 1;
    }
  }));
  return { emailConfigured: true, recipients: uniqueRecipients.length, sent, failed, skipped: 0 };
}
