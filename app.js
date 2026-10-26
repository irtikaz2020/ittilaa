(function () {
  'use strict';
  var I = window.Ihtifaz, el = I.el, DOORS = window.DOORS;
  var app = document.getElementById('app'), toast = document.getElementById('toast');
  var items = [], site = { contact: {}, launch: '' };
  function say(t, bad) { toast.textContent = t; toast.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(function () { toast.className = 'toast'; }, 3000); }
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {} }

  function sorted(list) {
    return list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || (b.added || 0) - (a.added || 0); });
  }
  function byDoor(id) { return items.filter(function (x) { return x.door === id; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'); }
  function matches(x, q) {
    if (!q) return true;
    var hay = norm([x.title, x.by, x.note, x.url, (I.door(x.door) || {}).name].join(' '));
    return norm(q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  function linkBtn(label, url, primary) {
    var u = I.safeUrl(url); if (!u) return null;
    return el('a', { class: 'btn' + (primary ? ' primary' : ''), href: u, target: '_blank', rel: 'noopener noreferrer' }, label);
  }
  function card(x, solo) {
    var d = I.door(x.door) || { e: '◈', name: '' };
    var pend = x.review === 'pending';
    var dt = x.date ? I.fmtDate(x.date) : null;
    var files = (x.files || []).map(function (f) {
      var u = I.safeUrl(f.url); if (!u) return null;
      return el('li', null, '📎 ', el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: f.name || I.host(u) }));
    }).filter(Boolean);
    var share = el('button', { class: 'btn', type: 'button', onclick: function () {
      var link = location.href.split('#')[0] + '#/item/' + x.id;
      if (navigator.share) navigator.share({ title: x.title, url: link }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { say('نُسخ الرابط.'); }, function () { say(link); });
      else say(link);
    } }, 'مشاركة');
    return el('article', { class: 'item' + (pend ? ' pending' : '') },
      el('div', { class: 'meta' },
        el('span', { class: 'badge' + (pend ? ' p' : ''), text: pend ? 'تحت المراجعة' : 'تمت المراجعة' }),
        el('a', { href: '#/door/' + x.door, text: d.e + ' ' + d.name, style: 'color:inherit' })),
      el('h3', null, solo ? x.title : el('a', { href: '#/item/' + x.id, text: x.title, style: 'color:inherit;text-decoration:none' })),
      el('div', { class: 'meta' },
        x.by ? el('span', { text: 'المصدر/صاحب العمل: ' + x.by }) : null,
        I.host(x.url) ? el('span', { dir: 'ltr', text: I.host(x.url) }) : null,
        dt ? el('span', { text: 'احتُفظ به في ' + dt.g + (dt.h ? ' (' + dt.h + ')' : '') }) : null),
      x.note ? el('p', { class: 'note', text: x.note }) : null,
      files.length ? el('ul', { class: 'files' }, files) : null,
      el('div', { class: 'acts' },
        linkBtn('فتح المصدر الرسمي', x.url, true),
        linkBtn('رابط بديل', x.alt, false),
        share));
  }
  function list(arr, empty) {
    if (!arr.length) return el('p', { class: 'hint', text: empty || 'لا شيء هنا بعد.' });
    return el('div', null, sorted(arr).map(function (x) { return card(x); }));
  }
  function tabs(cur) {
    return el('nav', { class: 'tabs', 'aria-label': 'التنقل' },
      [['#/', 'الأبواب', 'home'], ['#/cal', 'التقويم', 'cal'], ['#/about', 'عن احتفاظ', 'about']].map(function (t) {
        return el('a', { class: 'chip', href: t[0], 'aria-current': cur === t[2] ? 'true' : null, text: t[1] });
      }));
  }
  function searchBox(q, onGo) {
    var inp = el('input', { type: 'text', placeholder: 'ابحث في كل ما احتُفظ به', 'aria-label': 'بحث', value: q || '' });
    inp.addEventListener('change', function () { onGo(inp.value.trim()); });
    return inp;
  }

  /* ---------- الصفحات ---------- */
  function home(q) {
    var box = el('div', null, tabs('home'), searchBox(q, function (v) { go(v ? '#/search/' + encodeURIComponent(v) : '#/'); }));
    box.appendChild(el('div', { class: 'grid' }, DOORS.map(function (d) {
      return el('a', { class: 'door', href: '#/door/' + d.id }, el('span', { class: 'e', text: d.e }), el('span', { class: 'n', text: d.name }), el('span', { class: 'c', text: String(byDoor(d.id).length) }));
    })));
    box.appendChild(el('h2', { text: 'آخر ما احتُفظ به', style: 'margin:18px 0 4px' }));
    box.appendChild(list(sorted(items).slice(0, 8), 'لم تُضف عناصر بعد. أضف أول عنصر من أداة الإضافة.'));
    return box;
  }
  function searchPage(q) {
    var res = items.filter(function (x) { return matches(x, q); });
    return el('div', null, tabs('home'), searchBox(q, function (v) { go(v ? '#/search/' + encodeURIComponent(v) : '#/'); }),
      el('h2', { text: 'نتائج البحث (' + res.length + ')', style: 'margin:14px 0 4px' }), list(res, 'لا نتائج.'));
  }
  var filt = 'all';
  function doorPage(id) {
    var d = I.door(id); if (!d) return notFound();
    var all = byDoor(id);
    var shown = all.filter(function (x) { return filt === 'all' || (filt === 'ok' ? x.review !== 'pending' : x.review === 'pending'); });
    var bar = el('div', { class: 'row' }, [['all', 'الكل'], ['ok', 'تمت المراجعة'], ['pending', 'تحت المراجعة']].map(function (f) {
      return el('button', { class: 'chip', type: 'button', 'aria-current': filt === f[0] ? 'true' : null, text: f[1], onclick: function () { filt = f[0]; render(); } });
    }));
    return el('div', null, tabs(''), el('h2', null, d.e + ' ' + d.name), el('p', { class: 'hint', text: all.length + ' عنصر' }), bar, list(shown));
  }
  function itemPage(id) {
    var x = items.filter(function (y) { return y.id === id; })[0]; if (!x) return notFound();
    return el('div', null, tabs(''), card(x, true), el('a', { class: 'btn', href: '#/door/' + x.door, text: 'كل عناصر هذا الباب' }));
  }
  var calY = new Date().getFullYear(), calM = new Date().getMonth(), calSel = '';
  function calPage(sel) {
    if (sel) { var p = sel.split('-'); calY = +p[0]; calM = +p[1] - 1; calSel = sel; }
    var first = new Date(calY, calM, 1), days = new Date(calY, calM + 1, 0).getDate();
    var lead = (first.getDay() + 1) % 7; // الأسبوع يبدأ السبت
    var counts = {}; items.forEach(function (x) { if (x.date) counts[x.date] = (counts[x.date] || 0) + 1; });
    var mname = first.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    var hname = ''; try { hname = first.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' }); } catch (e) {}
    var grid = el('div', { class: 'cal' });
    ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'].forEach(function (n) { grid.appendChild(el('div', { class: 'h', text: n })); });
    for (var i = 0; i < lead; i++) grid.appendChild(el('button', { class: 'x', type: 'button', tabindex: '-1', 'aria-hidden': 'true' }));
    for (var d = 1; d <= days; d++) (function (d) {
      var iso = calY + '-' + I.pad(calM + 1) + '-' + I.pad(d), c = counts[iso] || 0;
      grid.appendChild(el('button', { type: 'button', class: (iso === calSel ? 'on ' : '') + (iso === I.today() ? 'today' : ''), 'aria-label': d + (c ? '، ' + c + ' عناصر' : ''),
        onclick: function () { calSel = iso; render(); } }, String(d), c ? el('small', { text: String(c) }) : null));
    })(d);
    function shift(n) { calM += n; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } calSel = ''; render(); }
    var out = el('div', null, tabs('cal'),
      el('div', { class: 'bar' }, el('button', { class: 'btn', type: 'button', onclick: function () { shift(1); }, text: 'الشهر التالي ›' }),
        el('div', { style: 'text-align:center' }, el('h2', { text: mname }), hname ? el('div', { class: 'hint', text: hname + ' (تقريبي)' }) : null),
        el('button', { class: 'btn', type: 'button', onclick: function () { shift(-1); }, text: '‹ الشهر السابق' })),
      grid);
    if (calSel) {
      var day = items.filter(function (x) { return x.date === calSel; });
      out.appendChild(el('h3', { text: I.fmtDate(calSel).g + ' (' + day.length + ')', style: 'margin:12px 0 4px' }));
      out.appendChild(list(day, 'لا عناصر في هذا اليوم.'));
    }
    return out;
  }
  function aboutPage() {
    var c = site.contact || {};
    return el('div', null, tabs('about'), el('div', { class: 'panel' },
      el('h2', { text: 'عن احتفاظ' }),
      el('p', { text: 'احتفاظ مجموعة مختارة بيد صاحبها: فيديوهات وصوتيات وصور وملفات وتطبيقات وروابط ومقالات، موزعة على ستة عشر باباً بحسب نوع المحتوى.' }),
      el('h3', { text: 'قواعدنا', style: 'margin-top:10px' }),
      el('ol', null,
        el('li', { text: 'لا ننسخ المحتوى ولا نحبسك عندنا: كل عنصر يقودك إلى مصدره الرسمي، ومعه رابط بديل إن لم يكن هناك مصدر رسمي.' }),
        el('li', { text: 'نذكر صاحب العمل دائماً.' }),
        el('li', { text: '«تمت المراجعة»: راجعناه ونثق برابطه ومحتواه. «تحت المراجعة»: عُرض للفائدة وما زال قيد التدقيق، ويظهر بشكل مختلف.' }),
        el('li', { text: 'لا نعرض ما نشك في سلامته أو صحته.' }),
        el('li', { text: 'كل عنصر يُسجَّل بتاريخ الاحتفاظ به (ميلادي وهجري تقريبي) لتجده في التقويم.' })),
      el('p', { class: 'hint', text: 'الموقع لا يجمع أي بيانات عنك ولا يحتاج حساباً. التاريخ الهجري محسوب بتقويم أم القرى عبر متصفحك وقد يختلف يوماً عن رؤية الهلال.' }),
      el('p', null, c.email ? el('a', { href: 'mailto:' + c.email, text: c.email }) : null, c.email && c.telegram ? ' · ' : '', c.telegram ? el('a', { href: c.telegram, target: '_blank', rel: 'noopener noreferrer', text: 'تيليجرام' }) : null)));
  }
  function notFound() { return el('div', null, tabs(''), el('p', { text: 'لم أجد هذه الصفحة.' }), el('a', { class: 'btn', href: '#/', text: 'الرئيسية' })); }

  function go(h) { location.hash = h; }
  function render() {
    var h = location.hash.replace(/^#\/?/, ''), p = h.split('/'), v;
    var arg = p[1] ? decodeURIComponent(p.slice(1).join('/')) : '';
    if (p[0] === 'door') v = doorPage(arg);
    else if (p[0] === 'item') v = itemPage(arg);
    else if (p[0] === 'cal') v = calPage(arg);
    else if (p[0] === 'about') v = aboutPage();
    else if (p[0] === 'search') v = searchPage(arg);
    else v = home('');
    app.textContent = ''; app.appendChild(v);
    app.appendChild(el('footer', null, 'احتفاظ — من ارتكاز. ', el('a', { href: 'add.html', text: 'أداة الإضافة' })));
  }
  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });

  function load(u, d) { return fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : d; }).catch(function () { return d; }); }
  Promise.all([load('items.json', { items: [] }), load('site.json', site)]).then(function (r) {
    items = (r[0] && r[0].items) || []; site = r[1] || site; render();
  });
})();
