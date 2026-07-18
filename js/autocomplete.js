/* Autocomplete adresses 41 + calcul distance auto — MobiLoireConnect41 */
(function () {
  var coords = { depart: null, arrivee: null };

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function makeDropdown(input) {
    var list = document.createElement('ul');
    list.className = 'ac-list';
    list.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#1d3a5f;border:1px solid rgba(255,255,255,.25);border-radius:12px;margin:6px 0 0;padding:4px;list-style:none;z-index:999;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none;';
    var parent = input.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(list);
    return list;
  }

  function attach(inputId, type) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var list = makeDropdown(input);

    var search = debounce(function () {
      var q = input.value.trim();
      coords[type] = null;
      if (q.length < 2) { list.style.display = 'none'; return; }
      fetch('/api/adresses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var results = data.results || [];
          list.innerHTML = '';
          if (!results.length) { list.style.display = 'none'; return; }
          results.forEach(function (a) {
            var li = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = a.numero + ' ' + a.rue + ' — ' + a.code_postal + ' ' + a.commune;
            btn.style.cssText = 'width:100%;text-align:left;padding:10px 12px;background:transparent;border:none;color:#fff;font-size:14px;cursor:pointer;border-radius:8px;';
            btn.onmouseover = function () { btn.style.background = 'rgba(255,255,255,.1)'; };
            btn.onmouseout = function () { btn.style.background = 'transparent'; };
            btn.onclick = function () {
              input.value = a.numero + ' ' + a.rue + ', ' + a.code_postal + ' ' + a.commune;
              coords[type] = { lat: a.latitude, lng: a.longitude };
              list.style.display = 'none';
              maybeDistance();
            };
            li.appendChild(btn);
            list.appendChild(li);
          });
          list.style.display = 'block';
        })
        .catch(function () { list.style.display = 'none'; });
    }, 300);

    input.addEventListener('input', search);
    document.addEventListener('click', function (e) {
      if (!list.contains(e.target) && e.target !== input) list.style.display = 'none';
    });
  }

  function maybeDistance() {
    if (!coords.depart || !coords.arrivee) return;
    fetch('/api/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat1: coords.depart.lat, lng1: coords.depart.lng,
        lat2: coords.arrivee.lat, lng2: coords.arrivee.lng
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.distance == null) return;
        var km = document.getElementById('uKm');
        if (km) {
          km.value = Math.max(1, Math.round(data.distance));
          if (typeof estimateOnChange === 'function') estimateOnChange();
        }
      })
      .catch(function (e) { console.error('Distance error', e); });
  }

  function init() {
    attach('uDepart', 'depart');
    attach('uArrivee', 'arrivee');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();