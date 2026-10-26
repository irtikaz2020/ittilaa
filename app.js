(function () {
  'use strict';
  /* ---------- أدوات ---------- */
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
  var KEY = 'itlaa:v1:data';
  var app = document.getElementById('app'), toast = document.getElementById('toast'), tt;
  function say(t, bad) { clearTimeout(tt); toast.textContent = t; toast.className = 'toast show' + (bad ? ' bad' : ''); tt = setTimeout(function () { toast.className = 'toast'; }, bad ? 7000 : 3500); }
  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  var UCRE = /^UC[\w-]{22}$/;
  function safeUrl(u) { try { var x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } }

  /* ---------- البيانات (كلها في متصفحك) ---------- */
  var D = load();
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.cats) return d; } catch (e) {}
    return { v: 1, cats: [], chans: [], vids: [], lists: [] };
  }
  var warned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); }
    catch (e) { if (!warned) { warned = true; say('تعذّر الحفظ في المتصفح. نزّل نسخة احتياطية الآن.', true); } }
  }
  function now() { return Date.now(); }
  function cat(id) { return D.cats.filter(function (c) { return c.id === id; })[0]; }
  function chan(id) { return D.chans.filter(function (c) { return c.id === id; })[0]; }
  function vid(id) { return D.vids.filter(function (v) { return v.id === id; })[0]; }
  function kids(pid) { return D.cats.filter(function (c) { return (c.parent || '') === (pid || ''); }); }
  function descend(id) { var out = [id]; kids(id).forEach(function (k) { out = out.concat(descend(k.id)); }); return out; }
  function catPath(id) { var out = [], c = cat(id), g = 0; while (c && g++ < 10) { out.unshift(c.name); c = c.parent ? cat(c.parent) : null; } return out.join(' › '); }
  function catOptions(sel, withNone) {
    var s = el('select');
    if (withNone) s.appendChild(el('option', { value: '', text: 'بدون تصنيف' }));
    (function walk(pid, depth) {
      kids(pid).forEach(function (c) { s.appendChild(el('option', { value: c.id, text: new Array(depth + 1).join('— ') + c.name })); walk(c.id, depth + 1); });
    })('', 0);
    s.value = sel || ''; return s;
  }
  function countIn(id) {
    var ids = id === '' ? [''] : descend(id);
    return {
      ch: D.chans.filter(function (c) { return ids.indexOf(c.cat || '') >= 0; }).length,
      vi: D.vids.filter(function (v) { return ids.indexOf(v.cat || '') >= 0; }).length
    };
  }

  /* ---------- قراءة الروابط ---------- */
  function parseVideo(text) {
    var u; try { u = new URL(String(text).trim()); } catch (e) { return null; }
    var h = u.hostname.replace(/^(www|m|music)\./, ''), id = '', list = u.searchParams.get('list') || '';
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
      id = u.searchParams.get('v') || '';
      var m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/); if (m) id = m[1];
    } else return null;
    if (/^[\w-]{11}$/.test(id)) return { kind: 'v', yt: id, list: /^[\w-]{10,}$/.test(list) ? list : '' };
    if (/^[\w-]{10,}$/.test(list)) return { kind: 'pl', yt: list };
    return null;
  }
  function csvFields(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  }
  function parseChan(line) {
    line = line.trim(); if (!line) return null;
    var name = '', f = line.indexOf(',') > -1 ? csvFields(line) : [line];
    if (f.length > 1) { var last = (f[f.length - 1] || '').trim(); if (!/^(https?:|UC[\w-]{22}$)/.test(last)) name = last; }
    var m = line.match(/UC[\w-]{22}/);
    if (m) return { k: m[0], name: name };
    var h = line.match(/@[^\s/?,"]+/);
    if (h) return { k: h[0], name: name };
    return null;
  }
  function chanUrl(c) { return UCRE.test(c.k) ? 'https://www.youtube.com/channel/' + c.k : 'https://www.youtube.com/' + c.k; }
  function addChannels(text, catId) {
    var have = {}; D.chans.forEach(function (c) { have[c.k.toLowerCase()] = 1; });
    var added = 0, dup = 0, bad = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim() || /^\s*"?channel/i.test(line)) return;
      var p = parseChan(line);
      if (!p) { bad.push(line.trim().slice(0, 50)); return; }
      if (have[p.k.toLowerCase()]) { dup++; return; }
      have[p.k.toLowerCase()] = 1; added++;
      D.chans.push({ id: uid('c'), k: p.k, name: p.name || (p.k[0] === '@' ? p.k : ''), cat: catId || '', u: now() });
    });
    if (added) save();
    return 'أُضيفت ' + added + ' قناة' + (dup ? '، ' + dup + ' مكررة' : '') + (bad.length ? '، ' + bad.length + ' سطر غير مفهوم (' + bad.slice(0, 4).join(' | ') + (bad.length > 4 ? ' …' : '') + ')' : '') + '.';
  }

  /* ---------- واجهة مشتركة ---------- */
  function tabs(cur) {
    return el('nav', { class: 'tabs', 'aria-label': 'التنقل' }, [['#/', 'الرئيسية', 'home'], ['#/add', 'إضافة', 'add'], ['#/lists', 'القوائم', 'lists'], ['#/cats', 'التصنيفات', 'cats'], ['#/me', 'نسخة وإعدادات', 'me']].map(function (t) {
      return el('a', { class: 'chip', href: t[0], 'aria-current': cur === t[2] ? 'true' : null, text: t[1] });
    }));
  }
  function thumb(v) {
    if (v.kind === 'v') return el('img', { src: 'https://i.ytimg.com/vi/' + v.yt + '/mqdefault.jpg', alt: '', loading: 'lazy' });
    return el('div', { class: 'noimg', text: '☰' });
  }
  function marks(v, rerender) {
    function b(k, label, aria) {
      return el('button', { type: 'button', class: v[k] ? 'on' : '', 'aria-pressed': v[k] ? 'true' : 'false', 'aria-label': aria, text: label, onclick: function () { v[k] = !v[k]; v.u = now(); save(); rerender(); } });
    }
    return el('div', { class: 'mk' }, b('star', '⭐', 'نجمة'), b('done', '✓', 'تمت مشاهدته'), b('save', '🔖', 'محفوظ'));
  }
  function vidCard(v, rerender) {
    var c = v.ch ? chan(v.ch) : null;
    return el('div', { class: 'vid' + (v.done ? ' done' : '') }, thumb(v),
      el('div', { style: 'flex:1;min-width:0' },
        el('a', { class: 't', href: '#/watch/' + v.id, text: v.title || (v.kind === 'pl' ? 'قائمة تشغيل' : 'فيديو') }),
        el('div', { class: 'meta' }, [c ? c.name || c.k : '', v.cat ? catPath(v.cat) : '', v.t > 5 && !v.done ? 'توقفت عند ' + fmt(v.t) : ''].filter(Boolean).join(' · ')),
        marks(v, rerender)));
  }
  function fmt(s) { s = Math.floor(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x; }
  function vidList(arr, rerender, empty) {
    if (!arr.length) return el('p', { class: 'hint', text: empty || 'لا شيء هنا بعد.' });
    return el('div', null, arr.map(function (v) { return vidCard(v, rerender); }));
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'); }
  function head(h) { return el('h2', { text: h, style: 'margin:16px 0 4px' }); }

  /* ---------- الصفحات ---------- */
  function home() {
    var q = el('input', { type: 'text', placeholder: 'ابحث في قنواتك وفيديوهاتك', 'aria-label': 'بحث' });
    q.addEventListener('change', function () { var v = q.value.trim(); if (v) go('#/search/' + encodeURIComponent(v)); });
    var box = el('div', null, tabs('home'), q);
    var cards = kids('').map(function (c) {
      var n = countIn(c.id);
      return el('a', { class: 'cat', href: '#/cat/' + c.id }, el('span', { text: c.name }), el('b', { text: n.ch + ' قناة · ' + n.vi + ' فيديو' }));
    });
    var un = countIn('');
    if (un.ch + un.vi) cards.push(el('a', { class: 'cat', href: '#/cat/none' }, el('span', { text: 'بدون تصنيف' }), el('b', { text: un.ch + ' قناة · ' + un.vi + ' فيديو' })));
    if (!D.chans.length && !D.vids.length && !D.cats.length) {
      box.appendChild(el('div', { class: 'panel' }, el('h3', { text: 'ابدأ من هنا' }),
        el('ol', { class: 'steps' },
          el('li', { text: 'أنشئ تصنيفاتك من صفحة «التصنيفات».' }),
          el('li', { text: 'استورد اشتراكاتك من ملف Takeout أو ألصق روابط قنواتك في «إضافة».' }),
          el('li', { text: 'أضف فيديو برابطه وشاهده هنا بمشغّل يوتيوب الرسمي.' }))));
    }
    box.appendChild(el('div', { class: 'grid' }, cards));
    var star = D.vids.filter(function (v) { return v.star; }).length, sv = D.vids.filter(function (v) { return v.save && !v.done; });
    if (sv.length) { box.appendChild(head('🔖 محفوظ للمشاهدة')); box.appendChild(vidList(sv.slice(0, 6), render)); }
    var recent = D.vids.slice().sort(function (a, b) { return (b.added || 0) - (a.added || 0); }).slice(0, 6);
    if (recent.length) { box.appendChild(head('آخر ما أضفته')); box.appendChild(vidList(recent, render)); }
    box.appendChild(el('div', { class: 'soon' }, 'الجديد التلقائي من قنواتك غير متاح حالياً: يحتاج خادماً ولم يُفعَّل بعد. حالياً تضيف الفيديوهات بنفسك.'));
    return box;
  }
  var vf = 'all';
  function catPage(id) {
    var none = id === 'none', c = none ? { id: '', name: 'بدون تصنيف' } : cat(id);
    if (!c) return notFound();
    var ids = none ? [''] : descend(c.id);
    var chs = D.chans.filter(function (x) { return ids.indexOf(x.cat || '') >= 0; });
    var vs = D.vids.filter(function (x) { return ids.indexOf(x.cat || '') >= 0; });
    vs = vs.filter(function (v) { return vf === 'all' || (vf === 'new' ? !v.done : !!v[vf]); }).sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
    var box = el('div', null, tabs(''), el('h2', { text: none ? c.name : catPath(c.id) }));
    if (!none && kids(c.id).length) box.appendChild(el('div', { class: 'row', style: 'margin:8px 0' }, kids(c.id).map(function (k) { return el('a', { class: 'chip', href: '#/cat/' + k.id, text: k.name }); })));
    box.appendChild(head('القنوات (' + chs.length + ')'));
    if (!chs.length) box.appendChild(el('p', { class: 'hint', text: 'لا قنوات هنا.' }));
    chs.forEach(function (ch) { box.appendChild(chanRow(ch)); });
    box.appendChild(head('الفيديوهات'));
    box.appendChild(el('div', { class: 'row' }, [['all', 'الكل'], ['new', 'لم أشاهده'], ['star', '⭐'], ['done', '✓'], ['save', '🔖']].map(function (f) {
      return el('button', { class: 'chip', type: 'button', 'aria-current': vf === f[0] ? 'true' : null, text: f[1], onclick: function () { vf = f[0]; render(); } });
    })));
    box.appendChild(vidList(vs, render));
    return box;
  }
  function chanRow(ch) {
    var sel = catOptions(ch.cat, true);
    sel.addEventListener('change', function () { ch.cat = sel.value; ch.u = now(); save(); render(); say('تم النقل.'); });
    var n = D.vids.filter(function (v) { return v.ch === ch.id; }).length;
    return el('div', { class: 'panel', style: 'margin:6px 0;padding:10px' },
      el('div', { class: 'row', style: 'justify-content:space-between' },
        el('a', { href: '#/chan/' + ch.id, text: ch.name || ch.k, style: 'font-weight:600' }),
        el('span', { class: 'meta', text: n + ' فيديو' })),
      el('div', { class: 'row' }, sel,
        el('a', { class: 'btn', href: chanUrl(ch), target: '_blank', rel: 'noopener noreferrer', text: 'القناة على يوتيوب' })));
  }
  function chanPage(id) {
    var ch = chan(id); if (!ch) return notFound();
    var nm = el('input', { type: 'text', value: ch.name || '', 'aria-label': 'اسم القناة' });
    var sel = catOptions(ch.cat, true);
    var vs = D.vids.filter(function (v) { return v.ch === ch.id; });
    return el('div', null, tabs(''), el('h2', { text: ch.name || ch.k }),
      el('div', { class: 'panel' },
        el('label', { text: 'الاسم الذي يظهر' }), nm,
        el('label', { text: 'التصنيف' }), sel,
        el('div', { class: 'row', style: 'margin-top:10px' },
          el('button', { class: 'btn primary', type: 'button', text: 'حفظ', onclick: function () { ch.name = nm.value.trim(); ch.cat = sel.value; ch.u = now(); save(); say('تم الحفظ.'); render(); } }),
          el('a', { class: 'btn', href: chanUrl(ch), target: '_blank', rel: 'noopener noreferrer', text: 'القناة على يوتيوب' }),
          el('button', { class: 'btn danger', type: 'button', text: 'حذف القناة', onclick: function () {
            if (!confirm('حذف القناة؟ تبقى فيديوهاتها بلا قناة.')) return;
            D.vids.forEach(function (v) { if (v.ch === ch.id) v.ch = ''; });
            D.chans = D.chans.filter(function (x) { return x !== ch; }); save(); go('#/');
          } }))),
      head('فيديوهاتها'), vidList(vs, render, 'لم تضف فيديوهات لهذه القناة.'));
  }

  var pf = { url: '', title: '' };
  function addPage() {
    var err = el('p', { class: 'err' });
    // قنوات
    var catSel = catOptions('', true);
    var ta = el('textarea', { dir: 'ltr', placeholder: '@اسم_القناة\nhttps://www.youtube.com/@اسم\nhttps://www.youtube.com/channel/UC…' });
    var csv = el('input', { type: 'file', accept: '.csv,text/csv,text/plain', class: 'sr', id: 'csv' });
    csv.addEventListener('change', function () {
      var f = csv.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { var m = addChannels(String(rd.result || ''), catSel.value); csv.value = ''; render(); say(m); };
      rd.readAsText(f);
    });
    // فيديو
    var url = el('input', { type: 'text', dir: 'ltr', placeholder: 'https://www.youtube.com/watch?v=…', value: pf.url });
    var title = el('input', { type: 'text', value: pf.title, placeholder: 'العنوان (يُحاول الموقع جلبه تلقائياً)' });
    var chSel = el('select', null, el('option', { value: '', text: 'بدون قناة' }), D.chans.map(function (c) { return el('option', { value: c.id, text: c.name || c.k }); }));
    var vCat = catOptions('', true);
    var tstat = el('p', { class: 'hint', style: 'min-height:1.8em' });
    url.addEventListener('change', function () {
      var p = parseVideo(url.value); if (!p || title.value.trim()) return;
      var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 6000);
      tstat.textContent = 'أحاول جلب العنوان…';
      fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + (p.kind === 'v' ? p.yt : '')), { signal: ac.signal })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (j) {
          clearTimeout(t); if (!title.value.trim()) title.value = j.title || '';
          tstat.textContent = 'تم جلب العنوان.';
          if (j.author_name) { var m = D.chans.filter(function (c) { return norm(c.name) === norm(j.author_name); })[0]; if (m && !chSel.value && Array.prototype.some.call(chSel.options, function (o) { return o.value === m.id; })) chSel.value = m.id; }
        })
        .catch(function () { clearTimeout(t); tstat.textContent = 'تعذّر جلب العنوان تلقائياً، اكتبه بنفسك.'; });
    });
    var box = el('div', null, tabs('add'),
      el('section', { class: 'panel' }, el('h2', { text: 'إضافة فيديو أو قائمة تشغيل' }),
        el('label', { text: 'الرابط' }), url, el('label', { text: 'العنوان' }), title, tstat,
        el('label', { text: 'القناة' }), chSel, el('label', { text: 'التصنيف' }), vCat, err,
        el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn primary', type: 'button', text: 'إضافة الفيديو', onclick: function () {
          var p = parseVideo(url.value);
          if (!p) { err.textContent = 'الرابط لا يبدو رابط فيديو أو قائمة من يوتيوب.'; return; }
          var key = p.kind === 'v' ? p.yt : p.yt;
          if (D.vids.some(function (v) { return v.yt === key && v.kind === p.kind; })) { err.textContent = 'هذا الفيديو مضاف من قبل.'; return; }
          var v = { id: uid('v'), kind: p.kind, yt: p.yt, list: p.list || '', title: title.value.trim(), ch: chSel.value, cat: vCat.value, added: now(), u: now() };
          D.vids.push(v); save(); pf = { url: '', title: '' }; say('أُضيف.'); go('#/watch/' + v.id);
        } })),
        el('p', { class: 'hint', text: 'الفيديو يُشغَّل بمشغّل يوتيوب الرسمي نفسه، بإعلاناته كما هي.' })),
      el('section', { class: 'panel' }, el('h2', { text: 'إضافة قنوات' }),
        el('label', { text: 'ضعها في تصنيف' }), catSel,
        el('p', { class: 'hint', text: 'لو عندك قنوات كثيرة اتركها «بدون تصنيف» ثم وزّعها لاحقاً من صفحة التصنيف.' }),
        el('h3', { text: 'الطريقة 1: ملف اشتراكاتك', style: 'margin-top:10px' }),
        el('div', { class: 'row' }, el('label', { class: 'btn primary', for: 'csv', text: 'اختيار ملف subscriptions.csv', style: 'margin:0' }), csv),
        el('p', { class: 'hint', text: 'من Google Takeout: اختر YouTube ثم الاشتراكات. الملف يُقرأ في متصفحك فقط ولا يُرسل لأي جهة.' }),
        el('h3', { text: 'الطريقة 2: لصق', style: 'margin-top:10px' }),
        ta, el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn primary', type: 'button', text: 'إضافة القنوات', onclick: function () {
          if (!ta.value.trim()) return; var m = addChannels(ta.value, catSel.value); ta.value = ''; render(); say(m);
        } }))));
    return box;
  }

  function catsPage() {
    var nm = el('input', { type: 'text', placeholder: 'اسم التصنيف الجديد' }), par = catOptions('', true);
    par.firstChild.textContent = 'تصنيف رئيسي (بدون أب)';
    var box = el('div', null, tabs('cats'), el('section', { class: 'panel' }, el('h2', { text: 'تصنيف جديد' }),
      nm, el('label', { text: 'يقع تحت' }), par,
      el('div', { class: 'row', style: 'margin-top:10px' }, el('button', { class: 'btn primary', type: 'button', text: 'إضافة', onclick: function () {
        var n = nm.value.trim(); if (!n) return;
        D.cats.push({ id: uid('k'), name: n, parent: par.value, u: now() }); save(); render(); say('أُضيف.');
      } }))));
    var pan = el('section', { class: 'panel' }, el('h2', { text: 'تصنيفاتك' }));
    if (!D.cats.length) pan.appendChild(el('p', { class: 'hint', text: 'لا تصنيفات بعد.' }));
    (function walk(pid, depth) {
      kids(pid).forEach(function (c) {
        pan.appendChild(el('div', { class: 'row', style: 'margin:6px 0;padding-inline-start:' + depth * 18 + 'px' },
          el('a', { href: '#/cat/' + c.id, text: c.name, style: 'font-weight:600;flex:1' }),
          el('button', { class: 'btn', type: 'button', text: 'إعادة تسمية', onclick: function () { var n = prompt('الاسم الجديد', c.name); if (n && n.trim()) { c.name = n.trim(); c.u = now(); save(); render(); } } }),
          el('button', { class: 'btn danger', type: 'button', text: 'حذف', onclick: function () {
            if (!confirm('حذف «' + c.name + '»؟ ما تحتها يرجع بدون تصنيف.')) return;
            var gone = descend(c.id);
            D.chans.forEach(function (x) { if (gone.indexOf(x.cat) >= 0) x.cat = ''; });
            D.vids.forEach(function (x) { if (gone.indexOf(x.cat) >= 0) x.cat = ''; });
            D.cats = D.cats.filter(function (x) { return gone.indexOf(x.id) < 0; }); save(); render();
          } })));
        walk(c.id, depth + 1);
      });
    })('', 0);
    box.appendChild(pan); return box;
  }

  function listsPage(id) {
    if (id) {
      var L = D.lists.filter(function (x) { return x.id === id; })[0]; if (!L) return notFound();
      var vs = L.vids.map(vid).filter(Boolean);
      return el('div', null, tabs('lists'), el('h2', { text: L.name }), vidList(vs, render, 'القائمة فارغة. أضف إليها من صفحة أي فيديو.'),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('button', { class: 'btn', type: 'button', text: 'إعادة تسمية', onclick: function () { var n = prompt('الاسم', L.name); if (n && n.trim()) { L.name = n.trim(); save(); render(); } } }),
          el('button', { class: 'btn danger', type: 'button', text: 'حذف القائمة', onclick: function () { if (!confirm('حذف القائمة؟ الفيديوهات تبقى.')) return; D.lists = D.lists.filter(function (x) { return x !== L; }); save(); go('#/lists'); } })));
    }
    var nm = el('input', { type: 'text', placeholder: 'اسم القائمة' });
    return el('div', null, tabs('lists'), el('section', { class: 'panel' }, el('h2', { text: 'قائمة جديدة' }), nm,
      el('div', { class: 'row', style: 'margin-top:10px' }, el('button', { class: 'btn primary', type: 'button', text: 'إنشاء', onclick: function () {
        var n = nm.value.trim(); if (!n) return; D.lists.push({ id: uid('l'), name: n, vids: [], u: now() }); save(); render();
      } }))),
      el('div', { class: 'grid' }, D.lists.map(function (l) { return el('a', { class: 'cat', href: '#/lists/' + l.id }, el('span', { text: l.name }), el('b', { text: l.vids.length + ' عنصر' })); })),
      D.lists.length ? null : el('p', { class: 'hint', text: 'لا قوائم بعد.' }));
  }

  /* ---------- المشاهدة ---------- */
  var ytReady = null, player = null, pTimer = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytReady) return ytReady;
    ytReady = new Promise(function (res, rej) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(); };
      var s = el('script', { src: 'https://www.youtube.com/iframe_api' }); s.onerror = function () { ytReady = null; rej(); };
      document.head.appendChild(s); setTimeout(function () { if (!(window.YT && window.YT.Player)) { ytReady = null; rej(); } }, 10000);
    });
    return ytReady;
  }
  function stopPlayer() { clearInterval(pTimer); pTimer = null; try { if (player && player.destroy) player.destroy(); } catch (e) {} player = null; }
  function watchPage(id) {
    var v = vid(id); if (!v) return notFound();
    var box = el('div', null, tabs(''), el('h2', { text: v.title || 'مشاهدة' }));
    var holder = el('div', { class: 'player' }, el('div', { id: 'ytp' }));
    var stat = el('p', { class: 'hint' });
    box.appendChild(holder); box.appendChild(stat);
    var fallback = function () {
      holder.textContent = '';
      var link = v.kind === 'v' ? 'https://www.youtube.com/watch?v=' + v.yt : 'https://www.youtube.com/playlist?list=' + v.yt;
      holder.appendChild(el('div', { style: 'color:#fff;padding:20px;text-align:center' }, 'تعذّر تحميل المشغّل هنا. ', el('a', { href: link, target: '_blank', rel: 'noopener noreferrer', style: 'color:#7fe', text: 'افتح على يوتيوب' })));
    };
    loadYT().then(function () {
      if (location.hash !== '#/watch/' + id) return;
      var vars = { playsinline: 1, rel: 0 };
      if (v.kind === 'pl') { vars.listType = 'playlist'; vars.list = v.yt; }
      else { if (v.list) vars.list = v.list; if (v.t > 10 && !v.done) vars.start = Math.floor(v.t) - 3; }
      player = new YT.Player('ytp', {
        videoId: v.kind === 'v' ? v.yt : undefined, playerVars: vars, width: '100%', height: '100%',
        events: {
          onReady: function () { if (v.kind === 'v' && v.t > 10 && !v.done) stat.textContent = 'يكمل من ' + fmt(v.t - 3) + ' حيث توقفت.'; },
          onStateChange: function (e) {
            if (e.data === 1 && v.kind === 'v' && !pTimer) pTimer = setInterval(function () { try { var t = player.getCurrentTime(); if (t > 0) { v.t = t; save(); } } catch (x) {} }, 5000);
            if (e.data === 2 && v.kind === 'v') { try { v.t = player.getCurrentTime(); save(); } catch (x) {} }
            if (e.data === 0 && v.kind === 'v') { v.done = true; v.t = 0; v.u = now(); save(); stat.textContent = 'انتهى وعُلّم ✓'; }
          },
          onError: function () { stat.textContent = 'لا يمكن تشغيله هنا (صاحب الفيديو قد يمنع التضمين). افتحه على يوتيوب.'; }
        }
      });
    }).catch(fallback);
    box.appendChild(marks(v, function () { render(); }));
    var catSel = catOptions(v.cat, true), chSel = el('select', null, el('option', { value: '', text: 'بدون قناة' }), D.chans.map(function (c) { return el('option', { value: c.id, text: c.name || c.k }); }));
    chSel.value = v.ch || '';
    var tIn = el('input', { type: 'text', value: v.title || '', 'aria-label': 'العنوان' });
    var lSel = el('select', null, el('option', { value: '', text: 'أضف إلى قائمة…' }), D.lists.map(function (l) { return el('option', { value: l.id, text: l.name + (l.vids.indexOf(v.id) >= 0 ? ' ✓' : '') }); }));
    lSel.addEventListener('change', function () {
      var L = D.lists.filter(function (x) { return x.id === lSel.value; })[0]; if (!L) return;
      var i = L.vids.indexOf(v.id); if (i >= 0) { L.vids.splice(i, 1); say('أُزيل من القائمة.'); } else { L.vids.push(v.id); say('أُضيف إلى القائمة.'); }
      L.u = now(); save(); render();
    });
    box.appendChild(el('div', { class: 'panel' },
      el('label', { text: 'العنوان' }), tIn, el('label', { text: 'القناة' }), chSel, el('label', { text: 'التصنيف' }), catSel, el('label', { text: 'القوائم' }), lSel,
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', { class: 'btn primary', type: 'button', text: 'حفظ', onclick: function () { v.title = tIn.value.trim(); v.ch = chSel.value; v.cat = catSel.value; v.u = now(); save(); say('تم الحفظ.'); } }),
        el('a', { class: 'btn', target: '_blank', rel: 'noopener noreferrer', href: v.kind === 'v' ? 'https://www.youtube.com/watch?v=' + v.yt : 'https://www.youtube.com/playlist?list=' + v.yt, text: 'فتح على يوتيوب' }),
        el('button', { class: 'btn danger', type: 'button', text: 'حذف', onclick: function () {
          if (!confirm('حذف من اطّلاع؟ لا يُحذف من يوتيوب.')) return;
          D.lists.forEach(function (l) { l.vids = l.vids.filter(function (x) { return x !== v.id; }); });
          D.vids = D.vids.filter(function (x) { return x !== v; }); save(); go('#/');
        } }))));
    return box;
  }

  function searchPage(q) {
    var w = norm(q).split(/\s+/);
    function hit(s) { var h = norm(s); return w.every(function (x) { return h.indexOf(x) >= 0; }); }
    var chs = D.chans.filter(function (c) { return hit(c.name + ' ' + c.k); });
    var vs = D.vids.filter(function (v) { return hit(v.title + ' ' + ((v.ch && chan(v.ch)) ? chan(v.ch).name : '')); });
    var box = el('div', null, tabs(''), el('h2', { text: 'نتائج «' + q + '»' }), head('القنوات (' + chs.length + ')'));
    chs.forEach(function (c) { box.appendChild(chanRow(c)); });
    box.appendChild(head('الفيديوهات (' + vs.length + ')')); box.appendChild(vidList(vs, render, 'لا نتائج.'));
    return box;
  }

  /* ---------- نسخة احتياطية وإعدادات ---------- */
  function mergeBy(arr, inc) {
    var n = 0; (inc || []).forEach(function (x) {
      if (!x || !x.id) return; var i = -1; arr.forEach(function (y, k) { if (y.id === x.id) i = k; });
      if (i < 0) { arr.push(x); n++; } else if ((x.u || 0) > (arr[i].u || 0)) { arr[i] = x; n++; }
    }); return n;
  }
  function mePage() {
    var imp = el('input', { type: 'file', accept: '.json,application/json', class: 'sr', id: 'imp' });
    imp.addEventListener('change', function () {
      var f = imp.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(rd.result); if (!j || !Array.isArray(j.cats)) throw 0;
          var n = mergeBy(D.cats, j.cats) + mergeBy(D.chans, j.chans) + mergeBy(D.vids, j.vids) + mergeBy(D.lists, j.lists);
          save(); render(); say('تم دمج ' + n + ' عنصراً (الأحدث يغلب).');
        } catch (e) { say('الملف غير صالح.', true); }
        imp.value = '';
      };
      rd.readAsText(f);
    });
    return el('div', null, tabs('me'),
      el('section', { class: 'panel' }, el('h2', { text: 'نسخة احتياطية' }),
        el('p', { text: 'كل بياناتك محفوظة في هذا المتصفح فقط. لو مسحت بيانات المتصفح أو غيّرت الجهاز تضيع إلا لو أخذت نسخة.' }),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', type: 'button', text: 'تنزيل نسخة', onclick: function () {
            var a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(D)], { type: 'application/json' })), download: 'itlaa-backup.json' });
            document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
          } }),
          el('label', { class: 'btn', for: 'imp', text: 'استرجاع/دمج نسخة', style: 'margin:0' }), imp),
        el('p', { class: 'hint', text: 'الحذف لا ينتقل بين النسخ عند الدمج: ما حذفته هنا قد يعود إن دمجت نسخة قديمة فيها.' })),
      el('section', { class: 'panel' }, el('h2', { text: 'صفحات' }),
        el('div', { class: 'row' }, el('a', { class: 'btn', href: '#/objection', text: 'اعتراض: الإعلانات المسيئة' }), el('a', { class: 'btn', href: '#/about', text: 'عن اطّلاع والخصوصية' }))),
      el('section', { class: 'soon' }, el('b', { text: 'قريباً (غير متاح الآن): ' }), 'الحساب والمزامنة بين الأجهزة، والجديد التلقائي من قنواتك. كلاهما يحتاج خادماً. بياناتك مصممة من الآن لتنتقل إليه لاحقاً بلا فقد.'));
  }
  function objectionPage() {
    return el('div', null, tabs(''), el('section', { class: 'panel' }, el('h2', { text: 'اعتراض' }),
      el('p', { text: 'لو ظهر لك إعلان مسيء أثناء المشاهدة، فهذه الأدوات الرسمية من جوجل لتعترض عليه. اطّلاع لا يعدّل المشغّل ولا يحجب الإعلانات، هو فقط يدلّك على الطريق.' }),
      el('h3', { text: 'الخطوات', style: 'margin-top:8px' }),
      el('ol', { class: 'steps' },
        el('li', { text: 'أثناء الإعلان، اضغط على أيقونة معلومات الإعلان (ⓘ أو «لماذا هذا الإعلان؟» حسب جهازك).' }),
        el('li', { text: 'اختر الإبلاغ عن الإعلان أو حظر المعلن إن ظهر الخيار.' }),
        el('li', { text: 'للتحكم الدائم: افتح «مركز الإعلانات» في حسابك على جوجل، وابحث عن المعلن، واختر حظره.' })),
      el('p', null, el('a', { href: 'https://myadcenter.google.com/', target: '_blank', rel: 'noopener noreferrer', text: 'فتح مركز الإعلانات (My Ad Center)' })),
      el('p', { class: 'hint', text: 'تنبيهات صريحة: أسماء الأزرار وأماكنها تتغير بين الأجهزة والإصدارات ولم أتحقق منها على جهازك. حظر معلن يمنعه عنك أنت فقط، ولا يوقف الإعلانات عموماً، وأثره داخل المشغّل المدمج في المواقع يعتمد على حساب جوجل المسجَّل في متصفحك.' })));
  }
  function aboutPage() {
    return el('div', null, tabs(''), el('section', { class: 'panel' }, el('h2', { text: 'عن اطّلاع' }),
      el('p', { text: 'اطّلاع يرتّب لك قنوات يوتيوب وفيديوهاتها بتصنيفاتك أنت، ويشغّلها بمشغّل يوتيوب الرسمي نفسه. هو لا يستبدل يوتيوب ولا يعرض ما يدفعه لك الترند.' }),
      el('h3', { text: 'الخصوصية', style: 'margin-top:8px' }),
      el('ol', { class: 'steps' },
        el('li', { text: 'لا حساب ولا خادم عندنا: تصنيفاتك وعلاماتك وتقدّمك تُحفظ في متصفحك فقط.' }),
        el('li', { text: 'ملف اشتراكاتك يُقرأ في المتصفح ولا يُرسل إلينا.' }),
        el('li', { text: 'عند المشاهدة يُحمَّل مشغّل يوتيوب والصور المصغّرة من خوادم جوجل، وتسري عليك سياسة خصوصية جوجل ويوتيوب.' }),
        el('li', { text: 'الخطوط تُحمَّل من Google Fonts.' }),
        el('li', { text: 'اطّلاع غير مرتبط بيوتيوب أو جوجل، ولا يغيّر شيئاً في حسابك عندهم. تصنيفاتك تظهر هنا فقط.' })),
      el('p', { class: 'hint', text: 'هذه الصيغة كتبها مساعد ذكاء اصطناعي وليست استشارة قانونية.' }),
      el('p', null, el('a', { href: 'mailto:irtikaz.academy.cre@gmail.com', text: 'irtikaz.academy.cre@gmail.com' }), ' · ', el('a', { href: 'https://t.me/irtikaz?direct', target: '_blank', rel: 'noopener noreferrer', text: 'تيليجرام' }))));
  }
  function notFound() { return el('div', null, tabs(''), el('p', { text: 'لم أجد هذه الصفحة.' }), el('a', { class: 'btn', href: '#/', text: 'الرئيسية' })); }

  /* ---------- التوجيه ---------- */
  function go(h) { location.hash = h; }
  function render() {
    stopPlayer();
    var p = location.hash.replace(/^#\/?/, '').split('/'), a = p[1] ? decodeURIComponent(p.slice(1).join('/')) : '', v;
    if (p[0] === 'cat') v = catPage(a);
    else if (p[0] === 'chan') v = chanPage(a);
    else if (p[0] === 'add') v = addPage();
    else if (p[0] === 'cats') v = catsPage();
    else if (p[0] === 'lists') v = listsPage(a);
    else if (p[0] === 'watch') v = watchPage(a);
    else if (p[0] === 'search') v = searchPage(a);
    else if (p[0] === 'me') v = mePage();
    else if (p[0] === 'objection') v = objectionPage();
    else if (p[0] === 'about') v = aboutPage();
    else v = home();
    app.textContent = ''; app.appendChild(v);
    app.appendChild(el('footer', null, 'اطّلاع — من ارتكاز'));
  }
  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });
  window.addEventListener('pagehide', function () { try { if (player && player.getCurrentTime) { var m = location.hash.match(/^#\/watch\/(.+)$/), v = m && vid(m[1]); if (v && v.kind === 'v') { var t = player.getCurrentTime(); if (t > 0) { v.t = t; save(); } } } } catch (e) {} });
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {} }

  // وصول من «مشاركة» في أندرويد
  (function () {
    var q = new URLSearchParams(location.search), link = q.get('url') || '';
    if (!parseVideo(link)) { var m = (q.get('text') || '').match(/https?:\/\/\S+/); link = m ? m[0] : ''; }
    if (link) { pf = { url: link, title: q.get('title') || '' }; history.replaceState(null, '', location.pathname + '#/add'); }
  })();
  render();
})();
