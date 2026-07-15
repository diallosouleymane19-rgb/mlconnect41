// MobiLoireConnect41 — version.js  v50
// Endpoint public de contrôle de version (aucune donnée sensible)
'use strict';
exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      version: 'v50',
      deployed: '2026-07-14',
      securite: { R1_debug_neutralise: true, R3_rate_limiting: true, R4_pin_hash_scrypt: true },
      sw_cache: 'mlc41-transporteur-v18'
    })
  };
};
