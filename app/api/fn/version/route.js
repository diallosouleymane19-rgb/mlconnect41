// Route API Next.js — port Vercel de netlify/functions/version.js
// La logique metier est inchangee : voir lib/netlify-fn/version.js
import fn from '@/lib/netlify-fn/version';
import { makeRoute } from '@/lib/netlify-fn/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const route = makeRoute(fn.handler);
export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
