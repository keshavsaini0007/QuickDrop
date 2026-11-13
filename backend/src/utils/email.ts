import { env, isProduction } from '../config/environment';
import { logger } from '../config/logger';

interface PasswordResetEmailInput {
  to: string;
  name: string;
  token: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildPasswordResetUrl(token: string): string {
  return `${env.APP_DEEP_LINK_SCHEME}://reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<boolean> {
  const resetUrl = buildPasswordResetUrl(input.token);

  if (env.EMAIL_PROVIDER === 'console') {
    if (isProduction) {
      logger.error(
        'EMAIL_PROVIDER=console is not allowed in production. Configure Resend or another provider.',
      );
      return false;
    }

    logger.info(
      { email: input.to, resetUrl },
      'Password reset link (development console provider)',
    );
    return true;
  }

  if (!env.RESEND_API_KEY) {
    logger.error('RESEND_API_KEY is missing; password reset email was not sent.');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: 'Reset your QuickDrop password',
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111827">
            <h1 style="font-size:20px">Reset your QuickDrop password</h1>
            <p>Hi ${escapeHtml(input.name)},</p>
            <p>Use the link below to choose a new password. The link expires soon and can only be used once.</p>
            <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">Reset password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, 'Resend email request failed');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send password reset email');
    return false;
  }
}
