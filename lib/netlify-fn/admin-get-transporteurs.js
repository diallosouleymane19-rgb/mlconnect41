'use strict';
var utils = require('./utils');
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return utils.preflight();
  var token = (event.queryStringParameters && event.queryStringParameters.token) || '';
  if (!token) return utils.err(401, 'Token requis');
  try { var s = utils.verifySession(token); if (s.role !== 'admin') return utils.err(403, 'Acces refuse'); }
  catch(e) { return utils.err(401, e.message); }
  try {
    var rows = await utils.sheetsGet('T1-Transporteurs!A:L');
    if (!rows || rows.length < 2) return utils.ok({ transporteurs: [] });
    var transporteurs = rows.slice(1).filter(function(r){ return r[0]; }).map(function(r) {
      return { id:r[0]||'', nom:r[1]||'', type:r[2]||'',
        commune:r[3]||'', tel:r[4]||'', email:r[5]||'',
        actif:(r[6]||'OUI').toUpperCase() !== 'NON' };
    });
    return utils.ok({ transporteurs: transporteurs });
  } catch(e) { return utils.err(500, 'Erreur serveur'); }
};
