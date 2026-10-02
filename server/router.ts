import { logout, requestLink, verifyLink } from './auth';
import { createMailer } from './emails';
import type { Ctx, Env } from './env';
import { HttpError, assertSameOrigin, errorResponse, json } from './http';
import { deleteMe, getMe, updateMe } from './profile';

type Handler = (ctx: Ctx) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  '/api/health': { GET: async () => json({ ok: true }) },
  '/api/auth/request': { POST: requestLink },
  '/api/auth/verify': { POST: verifyLink },
  '/api/auth/logout': { POST: logout },
  '/api/me': { GET: getMe, PATCH: updateMe, DELETE: deleteMe },
};

export async function handleApi(request: Request, env: Env, overrides: Partial<Pick<Ctx, 'mail' | 'now'>> = {}): Promise<Response> {
  const url = new URL(request.url);
  try {
    const route = ROUTES[url.pathname.replace(/\/$/, '')];
    if (!route) throw new HttpError(404, 'not_found');
    const handler = route[request.method];
    if (!handler) throw new HttpError(405, 'method_not_allowed');
    assertSameOrigin(request, url);
    return await handler({
      env,
      request,
      url,
      now: overrides.now ?? Date.now(),
      mail: overrides.mail ?? createMailer(env),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
