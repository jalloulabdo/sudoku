// Cloudflare Pages Function: every /api/* request is handled by server/router.ts.
import type { Env } from '../../server/env';
import { handleApi } from '../../server/router';

export const onRequest: PagesFunction<Env> = (context) => handleApi(context.request, context.env);
