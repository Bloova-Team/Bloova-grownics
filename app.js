(function () {
  var WA = 'https://wa.me/2348161711413';
  var EMAIL = 'hellobloova@gmail.com';
  var $ = function (id) { return document.getElementById(id); };
  var views = { intake: $('intake'), loading: $('loading'), report: $('report') };
  var form = $('form'), err = $('error'), go = $('go');
  $('year').textContent = new Date().getFullYear();

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    window.scrollTo(0, 0);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Keep the site's no hyphen rule for text written by the AI
  function tidy(s) {
    return String(s == null ? '' : s)
      .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 to $2')
      .replace(/\s+[-–—]+\s+/g, ', ')
      .replace(/[–—]/g, ', ')
      .replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2')
      .replace(/-/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  function num(n, a, b) { n = Number(n); if (!isFinite(n)) n = 0; return Math.max(a, Math.min(b, Math.round(n))); }

  // Platform hint
  var NAMES = { 'instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'x.com': 'X', 'twitter.com': 'X', 'facebook.com': 'Facebook', 'linkedin.com': 'LinkedIn', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'threads.net': 'Threads' };
  function platformOf(v) {
    try {
      var u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
      var h = u.hostname.replace(/^www\./, '').toLowerCase();
      for (var k in NAMES) if (h === k || h.endsWith('.' + k)) return NAMES[k];
    } catch (e) {}
    return '';
  }
  $('url').addEventListener('input', function () {
    var p = platformOf(this.value.trim());
    $('platform').textContent = p ? 'Detected: ' + p : 'Works with Instagram, TikTok, X, Facebook, LinkedIn, YouTube and Threads.';
  });

  function fail(msg) { err.textContent = msg; err.hidden = false; }

  // Loading animation
  var STAGES = ['Checking your profile and positioning', 'Looking at how often and what you post', 'Weighing engagement against your size', 'Finding what is holding the account back', 'Writing your 30 day plan'];
  var tick;
  function startLoading() {
    show('loading');
    var i = 0, bar = $('progress'), stage = $('stage');
    stage.textContent = STAGES[0]; bar.style.width = '10%';
    tick = setInterval(function () {
      i = Math.min(i + 1, STAGES.length - 1);
      stage.textContent = STAGES[i];
      bar.style.width = Math.min(92, 10 + (i + 1) * 17) + '%';
    }, 6000);
  }
  function stopLoading() { clearInterval(tick); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var d = new FormData(form);
    var url = (d.get('url') || '').trim();
    if (!platformOf(url)) return fail('Paste a link to a public account on Instagram, TikTok, X, Facebook, LinkedIn, YouTube or Threads.');
    if (d.get('followers') === '' || !d.get('frequency') || !d.get('goal') || !(d.get('niche') || '').trim()) return fail('Please fill in followers, how often you post, your goal and what the account is about.');

    var payload = {
      url: url,
      form: {
        followers: d.get('followers'), frequency: d.get('frequency'), typical: d.get('typical'),
        goal: d.get('goal'), niche: d.get('niche'), audience: d.get('audience'), bio: d.get('bio'),
        captions: d.get('captions'), struggle: d.get('struggle'), formats: d.getAll('formats')
      }
    };
    go.disabled = true;
    startLoading();
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 62000);
    fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.report) throw res;
        stopLoading();
        draw(res.body.report, res.body.meta || {}, payload);
      })
      .catch(function (res) {
        stopLoading();
        show('intake');
        var s = res && res.body && res.body.error;
        if (s === 'rate_limited') fail('You have run several audits in a short time. Please try again in about ten minutes.');
        else if (s === 'not_configured') fail('The audit is not switched on yet. Please contact Bloova.');
        else if (s === 'bad_link') fail('That link does not look like a public social media account. Please check it.');
        else fail('The audit could not finish just now. Please try again, or message Bloova on WhatsApp.');
      })
      .finally(function () { clearTimeout(t); go.disabled = false; });
  });

  function section(title) {
    var s = el('section', 'sec');
    s.appendChild(el('h2', '', title));
    var b = el('div', 'rows');
    s.appendChild(b);
    return { s: s, b: b };
  }
  function list(items) {
    var ul = el('ul', 'plain');
    (items || []).forEach(function (x) { ul.appendChild(el('li', '', tidy(x))); });
    return ul;
  }

  function draw(r, meta, payload) {
    var root = views.report;
    root.textContent = '';
    var score = num(r.score, 0, 100);

    // Head
    var head = el('div', 'r-head');
    var dial = el('div', 'dial');
    dial.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" pathLength="1"/></svg>';
    dial.appendChild(el('b', '', String(score)));
    dial.appendChild(el('small', '', 'out of 100'));
    dial.setAttribute('role', 'img');
    dial.setAttribute('aria-label', 'Audit score ' + score + ' out of 100');
    head.appendChild(dial);
    var txt = el('div');
    txt.appendChild(el('p', 'who', (platformOf(payload.url) || 'Account') + ' audit for ' + (meta.link || payload.url).replace(/^https?:\/\/(www\.)?/, '')));
    txt.appendChild(el('h1', '', tidy(r.verdict || 'Your audit is ready')));
    txt.appendChild(el('p', 'sum', tidy(r.summary)));
    if (r.dataNote) txt.appendChild(el('p', 'note', tidy(r.dataNote)));
    head.appendChild(txt);
    root.appendChild(head);
    setTimeout(function () { dial.querySelector('.fg').style.strokeDashoffset = String(1 - score / 100); }, 80);

    // Areas
    if (Array.isArray(r.areas) && r.areas.length) {
      var a = section('Score by area');
      r.areas.slice(0, 6).forEach(function (x) {
        var row = el('div', 'area');
        var v = num(x.score, 0, 100);
        row.appendChild(el('b', '', tidy(x.name)));
        row.appendChild(el('span', '', String(v)));
        var m = el('div', 'meter'); var i = el('i'); i.style.width = v + '%'; m.appendChild(i); row.appendChild(m);
        row.appendChild(el('p', '', tidy(x.note)));
        a.b.appendChild(row);
      });
      root.appendChild(a.s);
    }

    // Strengths
    if (Array.isArray(r.strengths) && r.strengths.length) {
      var st = section('What is working');
      st.b.appendChild(list(r.strengths));
      root.appendChild(st.s);
    }

    // Problems
    var pr = section('What is holding it back');
    (r.problems || []).forEach(function (p) {
      var sev = ['high', 'medium', 'low'].indexOf(p.severity) > -1 ? p.severity : 'medium';
      var d = el('div', 'prob');
      d.appendChild(el('span', 'sev ' + sev, sev.charAt(0).toUpperCase() + sev.slice(1) + ' priority'));
      d.appendChild(el('h3', '', tidy(p.title)));
      d.appendChild(el('p', '', tidy(p.why)));
      var f = el('p', 'fix'); f.appendChild(el('span', '', 'Fix: ')); f.appendChild(document.createTextNode(tidy(p.fix)));
      d.appendChild(f);
      pr.b.appendChild(d);
    });
    root.appendChild(pr.s);

    // Quick wins
    if (Array.isArray(r.quickWins) && r.quickWins.length) {
      var q = section('Do these in the next 48 hours');
      q.b.appendChild(list(r.quickWins));
      root.appendChild(q.s);
    }

    // Plan
    if (Array.isArray(r.plan) && r.plan.length) {
      var pl = section('Your 30 day plan');
      r.plan.slice(0, 4).forEach(function (w) {
        var d = el('div', 'plan');
        d.appendChild(el('span', 'wk', tidy(w.week)));
        d.appendChild(el('h3', '', tidy(w.focus)));
        d.appendChild(list(w.actions));
        pl.b.appendChild(d);
      });
      root.appendChild(pl.s);
    }

    // Targets
    if (Array.isArray(r.targets) && r.targets.length) {
      var tg = section('Targets for 30 days');
      var ul = el('ul', 'plain');
      r.targets.slice(0, 5).forEach(function (x) { ul.appendChild(el('li', '', tidy(x.metric) + ': ' + tidy(x.goal))); });
      tg.b.appendChild(ul);
      tg.b.appendChild(el('p', 'note', 'These are estimates, not promises. Results depend on consistency and on the work you put in.'));
      root.appendChild(tg.s);
    }

    // Ideas
    if (Array.isArray(r.contentIdeas) && r.contentIdeas.length) {
      var ci = section('Content ideas to start with');
      ci.b.appendChild(list(r.contentIdeas));
      root.appendChild(ci.s);
    }

    // CTA
    var band = el('section', 'band');
    band.appendChild(el('h2', '', 'Want the Bloova team to fix this with you?'));
    band.appendChild(el('p', '', 'This audit shows you where to look. Our strategists can turn it into a full growth plan and do the work with you.'));
    var row = el('div', 'row');
    var msg = 'Hello Bloova, I just ran an audit on my ' + (platformOf(payload.url) || 'social') + ' account (score ' + score + ' out of 100) and I would like help acting on it.';
    var w = el('a', 'btn solid', 'Talk to us on WhatsApp'); w.href = WA + '?text=' + encodeURIComponent(msg); w.target = '_blank'; w.rel = 'noopener';
    var m = el('a', 'btn line', 'Email the team'); m.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Help with my audit') + '&body=' + encodeURIComponent(msg);
    row.appendChild(w); row.appendChild(m); band.appendChild(row);
    root.appendChild(band);

    // Tools
    var tools = el('div', 'tools');
    var pb = el('button', 'btn line', 'Save as PDF or print'); pb.type = 'button'; pb.addEventListener('click', function () { window.print(); });
    var nb = el('button', 'btn line', 'Audit another account'); nb.type = 'button'; nb.addEventListener('click', function () { show('intake'); });
    tools.appendChild(pb); tools.appendChild(nb);
    root.appendChild(tools);

    show('report');
  }
})();
