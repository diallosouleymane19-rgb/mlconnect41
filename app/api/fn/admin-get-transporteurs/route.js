// Route API Next.js — port Vercel de netlify/functions/admin-get-transporteurs.js
// La logique metier est inchangee : voir lib/netlify-fn/admin-get-transporteurs.js
import fn from '@/lib/netlify-fn/admin-get-transporteurs';
import { makeRoute } from '@/lib/netlify-fn/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const route = makeRoute(fn.handler);
export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
