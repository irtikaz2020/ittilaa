(function () {
  'use strict';
  var I = window.Ihtifaz, el = I.el, store = I.store, DOORS = window.DOORS;
  var app = document.getElementById('app'), toast = document.getElementById('toast');
  var items = store.get('items', null), edit = null, dirty = store.get('dirty', false);
  function say(t, bad) { toast.textContent = t; toast.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(function () { toast.className = 'toast'; }, bad ? 6000 : 3000); }
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {} }
  function save() { store.set('items', items); dirty = true; store.set('dirty', true); }
  function uid() { return 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function download(name, text) {
    var a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
  }

  // قراءة ما جاء من المشاركة أو الرابط: ?link= أو title/text/url
  function incoming() {
    var q = new URLSearchParams(location.search), link = q.get('link') || q.get('url') || '';
    if (!I.safeUrl(link)) { var m = (q.get('text') || '').match(/https?:\/\/\S+/); link = m ? m[0] : ''; }
    var title = q.get('title') || '';
    if (link || title) return { url: I.safeUrl(link), title: title };
    return null;
  }

  function form() {
    var x = edit || { id: uid(), door: DOORS[0].id, title: '', url: '', alt: '', by: '', note: '', date: I.today(), review: 'ok', files: [], added: Date.now() };
    var f = {};
    function inp(k, label, type, ph, hint) {
      f[k] = el('input', { type: type || 'text', value: x[k] || '', placeholder: ph || '', dir: (k === 'url' || k === 'alt') ? 'ltr' : null });
      return el('div', null, el('label', { text: label }), f[k], hint ? el('p', { class: 'hint', text: hint }) : null);
    }
    f.door = el('select', null, DOORS.map(function (d) { return el('option', { value: d.id, text: d.e + ' ' + d.name }); }));
    f.door.value = x.door;
    f.note = el('textarea', { placeholder: 'لماذا احتفظت به؟ جملة أو اثنتان بكلامك' }); f.note.value = x.note || '';
    f.files = el('textarea', { dir: 'ltr', placeholder: 'اسم الملف | https://…\nاسم آخر | https://…' });
    f.files.value = (x.files || []).map(function (y) { return (y.name || '') + ' | ' + y.url; }).join('\n');
    f.review = el('select', null, el('option', { value: 'ok', text: 'تمت المراجعة' }), el('option', { value: 'pending', text: 'تحت المراجعة' }));
    f.review.value = x.review === 'pending' ? 'pending' : 'ok';
    var msg = el('p', { class: 'err', style: 'color:var(--warn)' });
    var box = el('section', { class: 'panel' },
      el('h2', { text: edit ? 'تعديل عنصر' : 'إضافة عنصر' }),
      el('label', { text: 'الباب' }), f.door,
      inp('url', 'الرابط الرسمي', 'url', 'https://…', 'رابط المصدر الأصلي. يُقبل http وhttps فقط.'),
      inp('title', 'العنوان'),
      inp('by', 'صاحب العمل/المصدر', 'text', 'اسم القناة أو الموقع أو الكاتب'),
      inp('alt', 'رابط بديل (اختياري)', 'url', 'https://…', 'استخدمه إن لم يوجد رابط رسمي أو للتوفير'),
      el('label', { text: 'ملاحظتك' }), f.note,
      el('label', { text: 'ملفات مرفقة (اختياري، سطر لكل ملف: الاسم | الرابط)' }), f.files,
      inp('date', 'تاريخ الاحتفاظ', 'date'),
      el('label', { text: 'الحالة' }), f.review, msg,
      el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn primary', type: 'button', text: edit ? 'حفظ التعديل' : 'إضافة', onclick: function () {
          var url = I.safeUrl(f.url.value), alt = f.alt.value.trim() ? I.safeUrl(f.alt.value) : '';
          if (!f.title.value.trim()) { msg.textContent = 'اكتب العنوان.'; return; }
          if (!url && !alt) { msg.textContent = 'ضع رابطاً رسمياً أو بديلاً صحيحاً (يبدأ بـ http).'; return; }
          if (f.alt.value.trim() && !alt) { msg.textContent = 'الرابط البديل غير صحيح.'; return; }
          var files = [], bad = 0;
          f.files.value.split(/\r?\n/).forEach(function (ln) {
            if (!ln.trim()) return;
            var i = ln.lastIndexOf('|'), nm = i > -1 ? ln.slice(0, i).trim() : '', u = I.safeUrl(i > -1 ? ln.slice(i + 1) : ln);
            if (u) files.push({ name: nm, url: u }); else bad++;
          });
          if (bad) { msg.textContent = bad + ' سطر في الملفات غير صحيح. الصيغة: الاسم | الرابط'; return; }
          x.door = f.door.value; x.title = f.title.value.trim(); x.url = url; x.alt = alt; x.by = f.by.value.trim();
          x.note = f.note.value.trim(); x.date = f.date.value || I.today(); x.review = f.review.value; x.files = files;
          var i2 = items.map(function (y) { return y.id; }).indexOf(x.id);
          if (i2 > -1) items[i2] = x; else items.push(x);
          save(); edit = null; build(); say('تم الحفظ في المسودة. لا تنس تنزيل items.json ورفعه.');
        } }),
        edit ? el('button', { class: 'btn', type: 'button', text: 'إلغاء', onclick: function () { edit = null; build(); } }) : null));
    return box;
  }

  function listPanel() {
    var box = el('section', { class: 'panel' }, el('h2', { text: 'عناصر المسودة (' + items.length + ')' }));
    if (!items.length) box.appendChild(el('p', { class: 'hint', text: 'لا عناصر بعد.' }));
    items.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).forEach(function (x) {
      var d = I.door(x.door) || { e: '', name: '' };
      box.appendChild(el('div', { class: 'item' + (x.review === 'pending' ? ' pending' : '') },
        el('b', { text: x.title }), el('div', { class: 'meta' }, d.e + ' ' + d.name + ' · ' + (x.date || '') + (x.review === 'pending' ? ' · تحت المراجعة' : '')),
        el('div', { class: 'acts' },
          el('button', { class: 'btn', type: 'button', text: 'تعديل', onclick: function () { edit = x; build(); window.scrollTo(0, 0); } }),
          el('button', { class: 'btn danger', type: 'button', text: 'حذف', onclick: function () {
            if (!confirm('حذف هذا العنصر؟')) return;
            items = items.filter(function (y) { return y !== x; }); save(); build();
          } }))));
    });
    return box;
  }

  function filePanel() {
    var imp = el('input', { type: 'file', accept: '.json,application/json', class: 'sr', id: 'imp' });
    imp.addEventListener('change', function () {
      var fl = imp.files[0]; if (!fl) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(rd.result), arr = j.items || j, n = 0;
          if (!Array.isArray(arr)) throw 0;
          arr.forEach(function (y) {
            if (!y || !y.id || !y.title) return;
            var k = items.map(function (z) { return z.id; }).indexOf(y.id);
            if (k > -1) items[k] = y; else items.push(y); n++;
          });
          save(); build(); say('تم دمج ' + n + ' عنصر.');
        } catch (e) { say('الملف غير صالح.', true); }
        imp.value = '';
      };
      rd.readAsText(fl);
    });
    return el('section', { class: 'panel' }, el('h2', { text: 'حفظ ونشر' }),
      el('ol', null,
        el('li', { text: 'اضغط «تنزيل items.json».' }),
        el('li', { text: 'ارفعه في مستودع ihtifaz على GitHub بالاسم نفسه واستبدل القديم. تأكد أن الاسم items.json بلا (1).' }),
        el('li', { text: 'بعد دقيقة يظهر في الموقع.' })),
      dirty ? el('p', { class: 'hint', style: 'color:var(--warn)', text: 'عندك تعديلات لم تُنزَّل بعد.' }) : null,
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', type: 'button', text: 'تنزيل items.json', onclick: function () {
          download('items.json', JSON.stringify({ version: 1, items: items }, null, 1)); dirty = false; store.set('dirty', false); build();
        } }),
        el('label', { class: 'btn', for: 'imp', text: 'دمج ملف items.json', style: 'margin:0' }), imp,
        el('button', { class: 'btn danger', type: 'button', text: 'استبدال المسودة بالمنشور', onclick: function () {
          if (!confirm('ستُمحى مسودتك وتُستبدل بالنسخة المنشورة. متأكد؟')) return;
          fetch('items.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { items = j.items || []; save(); dirty = false; store.set('dirty', false); build(); say('تم.'); }).catch(function () { say('تعذر جلب المنشور.', true); });
        } })));
  }

  function build() { app.textContent = ''; app.appendChild(form()); app.appendChild(listPanel()); app.appendChild(filePanel()); }

  function start() {
    var inc = incoming();
    if (inc && !edit) {
      edit = { id: uid(), door: DOORS[0].id, title: inc.title, url: inc.url, alt: '', by: '', note: '', date: I.today(), review: 'ok', files: [], added: Date.now() };
      history.replaceState(null, '', 'add.html');
    }
    build();
  }
  if (items) start();
  else fetch('items.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return { items: [] }; }).then(function (j) { items = j.items || []; store.set('items', items); start(); });
})();
