(function () {
  'use strict';
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(n, x); });
    else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  var P = 'ihtifaz:v1:';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  function safeUrl(u) {
    try { var x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function door(id) { return window.DOORS.filter(function (d) { return d.id === id; })[0]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateObj(iso) { var p = String(iso).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1, 12); }
  function fmtDate(iso) {
    try {
      var d = dateObj(iso);
      var g = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
      var h = d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      return { g: g, h: h };
    } catch (e) { return { g: iso, h: '' }; }
  }
  window.Ihtifaz = { el: el, store: store, safeUrl: safeUrl, host: host, door: door, today: today, dateObj: dateObj, fmtDate: fmtDate, pad: pad };
})();
