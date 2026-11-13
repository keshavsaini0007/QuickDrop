import { Router, type Request, type Response } from 'express';
import { env, isProduction } from '../config/environment';
import { publicLimiter } from '../middleware/rateLimiter';
import { isApiError } from '../utils/apiError';
import {
  downloadSharedFile,
  getPublicShareInfo,
  unlockShare,
  type PublicShareInfo,
} from '../modules/shares/share.service';
import { verifyShareAccessToken } from '../modules/auth/token.service';

const COOKIE_NAME = 'qd_share_access';

export const sharePageRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function pageShell(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(title)} · QuickDrop</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f6fb; color: #152033; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { width: min(100%, 460px); background: #fff; border: 1px solid #e1e7f0; border-radius: 20px; padding: 28px; box-shadow: 0 18px 50px rgba(19, 40, 77, 0.12); }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .mark { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: linear-gradient(135deg, #0b7a75, #3fb8a8); color: #fff; font-size: 18px; }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.03em; overflow-wrap: anywhere; }
    p { margin: 0 0 18px; color: #5c6b82; line-height: 1.55; }
    .file { border: 1px solid #e5eaf2; background: #f8fafc; border-radius: 14px; padding: 16px; margin: 18px 0; }
    .file strong { display: block; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 8px; color: #63728a; font-size: 14px; }
    label { display: block; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
    input { width: 100%; min-height: 48px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; font: inherit; background: #fff; color: inherit; }
    button, .button { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 50px; margin-top: 14px; border: 0; border-radius: 12px; background: #0b7a75; color: #fff; font: inherit; font-weight: 750; text-decoration: none; cursor: pointer; }
    .error { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 14px; }
    .note { font-size: 13px; color: #7a879a; margin: 18px 0 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #0c1220; color: #edf3ff; }
      main { background: #121a2b; border-color: #26324a; box-shadow: 0 18px 50px rgba(0,0,0,0.35); }
      p, .meta { color: #a8b6cc; }
      .file { background: #0d1524; border-color: #27344d; }
      input { background: #0d1524; border-color: #33415c; }
      .note { color: #8492a8; }
    }
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="mark">Q</span> QuickDrop</div>
    ${content}
  </main>
</body>
</html>`;
}

function errorPage(status: number, message: string): string {
  return pageShell(
    'Link unavailable',
    `<h1>Link unavailable</h1><p>${escapeHtml(message)}</p><p class="note">Ask the sender for a new QuickDrop link.</p>`,
  );
}

function renderShare(
  info: PublicShareInfo,
  options: { token: string; unlocked: boolean; error?: string },
): string {
  const { share, file } = info;
  const needsPassword = share.hasPassword && !options.unlocked;
  const expiry = share.expiresAt
    ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}`
    : 'No expiry';
  const limit = share.maxDownloads
    ? `${share.downloadCount} of ${share.maxDownloads} downloads used`
    : `${share.downloadCount} downloads`;

  const content = `
    <h1>${escapeHtml(file.name)}</h1>
    <p>${escapeHtml(info.ownerName)} shared a file with you.</p>
    <div class="file">
      <strong>${escapeHtml(file.name)}</strong>
      <div class="meta"><span>${escapeHtml(formatBytes(file.sizeBytes))}</span><span>${escapeHtml(file.mimeType)}</span></div>
      <div class="meta"><span>${escapeHtml(expiry)}</span><span>${escapeHtml(limit)}</span></div>
    </div>
    ${options.error ? `<div class="error">${escapeHtml(options.error)}</div>` : ''}
    ${
      needsPassword
        ? `<form method="post" action="/s/${encodeURIComponent(options.token)}/unlock">
            <label for="password">This link is password protected</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="72" />
            <button type="submit">Unlock download</button>
          </form>`
        : `<a class="button" href="/s/${encodeURIComponent(options.token)}/download">Download file</a>`
    }
    <p class="note">QuickDrop links are private. Do not forward this page unless you trust the recipient.</p>
  `;
  return pageShell(file.name, content);
}

function tokenParam(req: Request): string {
  const value = req.params.token;
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function handleError(res: Response, error: unknown): void {
  const status = isApiError(error) ? error.statusCode : 500;
  const message = isApiError(error) ? error.message : 'Something went wrong while loading this link.';
  res.status(status).type('html').send(errorPage(status, message));
}

sharePageRouter.get('/:token', publicLimiter, async (req, res) => {
  const token = tokenParam(req);
  try {
    const info = await getPublicShareInfo(token);
    let unlocked = !info.share.hasPassword;
    const cookie = req.cookies?.[COOKIE_NAME];
    if (cookie && typeof cookie === 'string') {
      try {
        const payload = verifyShareAccessToken(cookie);
        unlocked = payload.shareId === info.share.id;
      } catch {
        unlocked = false;
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    res.type('html').send(renderShare(info, { token, unlocked }));
  } catch (error) {
    handleError(res, error);
  }
});

sharePageRouter.post('/:token/unlock', publicLimiter, async (req, res) => {
  const token = tokenParam(req);
  const password = typeof req.body?.password === 'string' ? req.body.password : undefined;
  try {
    const result = await unlockShare(token, password ? { password } : {});
    const maxAge = Math.max(60 * 1000, result.expiresAt.getTime() - Date.now());
    res.cookie(COOKIE_NAME, result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    res.redirect(303, `/s/${encodeURIComponent(token)}`);
  } catch (error) {
    try {
      const info = await getPublicShareInfo(token);
      const status = isApiError(error) ? error.statusCode : 500;
      const message = isApiError(error) ? error.message : 'Could not unlock this link.';
      res
        .status(status)
        .setHeader('Cache-Control', 'no-store')
        .type('html')
        .send(renderShare(info, { token, unlocked: false, error: message }));
    } catch (loadError) {
      handleError(res, loadError);
    }
  }
});

sharePageRouter.get('/:token/download', publicLimiter, async (req, res) => {
  const token = tokenParam(req);
  try {
    const info = await getPublicShareInfo(token);
    let accessToken = req.cookies?.[COOKIE_NAME];
    if (typeof accessToken !== 'string' || !accessToken) {
      if (info.share.hasPassword) {
        res.redirect(303, `/s/${encodeURIComponent(token)}`);
        return;
      }
      const unlocked = await unlockShare(token, {});
      accessToken = unlocked.accessToken;
    }

    const result = await downloadSharedFile(token, accessToken);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, result.url);
  } catch (error) {
    if (
      isApiError(error) &&
      (error.code === 'SHARE_ACCESS_EXPIRED' || error.code === 'SHARE_ACCESS_INVALID')
    ) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      res.redirect(303, `/s/${encodeURIComponent(token)}`);
      return;
    }
    handleError(res, error);
  }
});

// Keep the configured public base URL visible to the health/info surfaces without
// exposing any secret material.
export const publicShareBaseUrl = `${env.PUBLIC_WEB_BASE_URL.replace(/\/+$/, '')}/s`;

export default sharePageRouter;
