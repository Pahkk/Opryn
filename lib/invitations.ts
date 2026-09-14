import "server-only";

export async function deliverWorkspaceInvite(input: {
  email: string;
  inviteUrl: string;
  accessCode: string;
  organizationName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.OPRYN_INVITE_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { delivered: false as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Join ${input.organizationName} on Opryn`,
      html: inviteEmailHtml(input),
      text: `You've been invited to join ${input.organizationName} on Opryn.\n\nJoin your team: ${input.inviteUrl}\n\nAccess code: ${input.accessCode}\n\nThis invitation expires in 7 days.`,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Unable to deliver workspace invitation", {
      status: response.status,
    });
    return { delivered: false as const };
  }
  return { delivered: true as const };
}

function inviteEmailHtml(input: {
  inviteUrl: string;
  accessCode: string;
  organizationName: string;
}) {
  const organizationName = escapeHtml(input.organizationName);
  const inviteUrl = escapeHtml(input.inviteUrl);
  const accessCode = escapeHtml(input.accessCode);
  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Arial,sans-serif;color:#111b2e"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="font-size:28px;font-weight:700;color:#08172f">Opryn</div><div style="margin-top:24px;background:#fff;border:1px solid #dfe5ed;padding:32px"><p style="margin:0;color:#163f98;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Team invitation</p><h1 style="margin:12px 0 0;font-size:28px;line-height:1.2">Join ${organizationName}</h1><p style="margin:16px 0 0;color:#5d687a;font-size:16px;line-height:1.6">Your team invited you to use its approved processes and company answers in Opryn.</p><a href="${inviteUrl}" style="display:inline-block;margin-top:24px;padding:14px 22px;background:#163f98;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Join your team</a><div style="margin-top:28px;padding-top:24px;border-top:1px solid #e3e8ef"><p style="margin:0;color:#748094;font-size:13px">Or enter this access code during onboarding:</p><p style="margin:10px 0 0;font-family:monospace;font-size:20px;font-weight:700;letter-spacing:.08em;color:#0e2f78">${accessCode}</p></div></div><p style="margin:18px 0 0;color:#8490a0;font-size:12px;line-height:1.6">This invitation expires in 7 days. Only the invited email address can accept it.</p></div></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );
}
