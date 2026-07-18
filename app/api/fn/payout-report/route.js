// Route API Next.js — port Vercel de netlify/functions/payout-report.js
// Logique metier inchangee (lib/netlify-fn/payout-report.js).
// Difference : sur Netlify la fonction planifiee etait invoquee en POST avec
// body {"next_run": ...}. Vercel Cron invoque en GET. Cette route detecte
// l'appel Cron Vercel et le traduit en invocation planifiee equivalente.
// - Si CRON_SECRET est defini (recommande) : seul "Authorization: Bearer <CRON_SECRET>"
//   (envoye automatiquement par Vercel Cron) est accepte comme appel planifie.
// - Sinon : l'en-tete x-vercel-cron sert de detection.
// Les GET/POST manuels restent proteges par le token admin (inchange).
import fn from '@/lib/netlify-fn/payout-report';
import { toEvent, toResponse } from '@/lib/netlify-fn/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isVercelCron(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return (req.headers.get('authorization') || '') === 'Bearer ' + secret;
  }
  return !!req.headers.get('x-vercel-cron') ||
    (req.headers.get('user-agent') || '').toLowerCase().includes('vercel-cron');
}

export async function GET(req) {
  const event = await toEvent(req);
  if (isVercelCron(req)) {
    // Traduction appel Cron Vercel -> invocation planifiee "style Netlify"
    event.httpMethod = 'POST';
    event.body = JSON.stringify({ next_run: 'vercel-cron' });
  }
  return toResponse(await fn.handler(event));
}

export async function POST(req) {
  return toResponse(await fn.handler(await toEvent(req)));
}

export async function OPTIONS(req) {
  return toResponse(await fn.handler(await toEvent(req)));
}
