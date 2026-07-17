// MobiLoireConnect41 — version.js  v52
'use strict';
exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      version: 'v52',
      deployed: '2026-07-15',
      securite: {
        R1_debug_neutralise: true, R3_rate_limiting: 'blobs+fallback', R4_pin_hash_scrypt: true,
        A1_xss_echappement: true, A2_track_course_pii: true, A3_payout_auth: true,
        A4_montant_plafond: true, A5_webhook_failclosed: true, A6_confirm_ownership: true
      },
      sw_cache: 'mlc41-transporteur-v19'
    })
  };
};
