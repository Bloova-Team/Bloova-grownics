// Mobile navigation
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();

// Footer year
document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

// Contact form: opens WhatsApp or the email app with the message already written
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var WHATSAPP = '2348161711413';
  var EMAIL = 'hellobloova@gmail.com';

  function compose() {
    var d = new FormData(form);
    var lines = [
      'Hello Bloova, I would like to start a conversation.',
      '',
      'Name: ' + (d.get('name') || ''),
      'Brand or company: ' + (d.get('company') || 'Not provided'),
      'Email: ' + (d.get('email') || ''),
      'What I need: ' + (d.get('service') || ''),
      '',
      (d.get('message') || '')
    ];
    return lines.join('\n');
  }

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-send]');
    if (!btn) return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    var body = compose();
    if (btn.dataset.send === 'whatsapp') {
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
    } else {
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('New project enquiry') + '&body=' + encodeURIComponent(body);
    }
  });
})();


// ---------------------------------------------------------------
// Splash screen (plays once per visit, skippable)
(function () {
  var html = document.documentElement;
  var sp = document.getElementById('splash');
  if (!sp) return;
  if (!html.classList.contains('splash-on')) { sp.remove(); return; }
  try { sessionStorage.setItem('bloovaSplash', '1'); } catch (e) {}
  var DUR = 5100, t0 = performance.now(), done = false;
  var count = document.getElementById('sp-count');
  html.style.overflow = 'hidden';

  function tick(t) {
    var p = Math.min(1, (t - t0) / (DUR - 400));
    count.textContent = String(Math.round(100 * (1 - Math.pow(1 - p, 2.2))));
    if (!done && p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function finish() {
    if (done) return;
    done = true;
    count.textContent = '100';
    sp.classList.add('out');
    setTimeout(function () { html.classList.remove('hold'); }, 350);
    setTimeout(function () { html.classList.remove('splash-on'); html.style.overflow = ''; sp.remove(); }, 1300);
  }
  setTimeout(finish, DUR);
  document.getElementById('sp-skip').addEventListener('click', finish);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') finish(); });
})();

// ---------------------------------------------------------------
// Scroll progress bar
(function () {
  var bar = document.getElementById('progress');
  if (!bar) return;
  var queued = false;
  function update() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
    queued = false;
  }
  window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// ---------------------------------------------------------------
// Reveal on scroll and count up figures
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    items.forEach(function (n) { n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  var nums = document.querySelectorAll('[data-count]');
  function run(el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suffix || '';
    var t0 = performance.now(), D = 1700;
    function step(t) {
      var p = Math.min(1, (t - t0) / D), v = end * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toFixed(dec) + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (!nums.length || reduce || !('IntersectionObserver' in window)) return;
  var io2 = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io2.unobserve(e.target); } });
  }, { threshold: 0.6 });
  nums.forEach(function (n) { io2.observe(n); });
})();

// ---------------------------------------------------------------
// Ecosystem orbit
(function () {
  var nodes = document.querySelectorAll('.node');
  var name = document.getElementById('eco-name'), text = document.getElementById('eco-text'), tag = document.getElementById('eco-tag');
  if (!nodes.length || !name) return;
  function pick(n) {
    nodes.forEach(function (x) { x.setAttribute('aria-pressed', x === n ? 'true' : 'false'); });
    name.textContent = n.dataset.name;
    text.textContent = n.dataset.text;
    tag.textContent = n.dataset.tag || '';
  }
  nodes.forEach(function (n) {
    n.addEventListener('click', function () { pick(n); });
    n.addEventListener('mouseenter', function () { pick(n); });
    n.addEventListener('focus', function () { pick(n); });
  });
})();

// ---------------------------------------------------------------
// Hero spotlight follows the pointer
(function () {
  var hero = document.getElementById('hero');
  if (!hero || !window.matchMedia || !matchMedia('(hover: hover)').matches) return;
  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  });
})();
