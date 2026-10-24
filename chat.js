// Bloova assistant: chat window. Talks to /api/chat, which holds the API key on the server.
(function () {
  var WHATSAPP_URL = 'https://wa.me/2348161711413';
  var EMAIL = 'hellobloova@gmail.com';
  var history = [];
  var busy = false;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // Safe link rendering: escape first, then turn URLs and emails into links
  function render(node, text) {
    node.textContent = '';
    var re = /(https?:\/\/[^\s)]+|[A-Za-z0-9._%+]+@[A-Za-z0-9.]+\.[A-Za-z]{2,})/g;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var isMail = m[0].indexOf('@') > -1 && m[0].indexOf('http') !== 0;
      var a = el('a', { href: isMail ? 'mailto:' + m[0] : m[0], text: m[0] });
      if (!isMail) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      node.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  var launch = el('button', { 'class': 'chat-launch', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'bloova-chat' }, [
    el('i'), el('span', { text: 'Ask Bloova' })
  ]);

  var log = el('div', { 'class': 'chat-log', 'aria-live': 'polite' });
  var chips = el('div', { 'class': 'chips' });
  var input = el('input', { type: 'text', placeholder: 'Type your question', 'aria-label': 'Your message', maxlength: '600', autocomplete: 'off' });
  var send = el('button', { type: 'submit', text: 'Send' });
  var form = el('form', { 'class': 'chat-form' }, [input, send]);
  var close = el('button', { 'class': 'chat-close', type: 'button', 'aria-label': 'Close chat', text: '×' });
  var panel = el('div', { 'class': 'chat', id: 'bloova-chat', role: 'dialog', 'aria-label': 'Bloova assistant' }, [
    el('div', { 'class': 'chat-head' }, [
      el('div', {}, [el('b', { text: 'Bloova assistant' }), el('small', { text: 'Ask about our services and how we work' })]),
      close
    ]),
    log, chips, form
  ]);

  document.body.appendChild(panel);
  document.body.appendChild(launch);

  function add(text, who) {
    var m = el('div', { 'class': 'msg ' + who });
    render(m, text);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function open() {
    panel.classList.add('open');
    launch.setAttribute('aria-expanded', 'true');
    if (!log.children.length) {
      add('Hello, I am the Bloova assistant. I can tell you about our services, how we work, and how to start a project.', 'bot');
      ['What services do you offer?', 'Who do you work with?', 'How do I start a project?'].forEach(function (q) {
        chips.appendChild(el('button', { type: 'button', text: q }));
      });
    }
    setTimeout(function () { input.focus(); }, 250);
  }
  function shut() {
    panel.classList.remove('open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus();
  }

  launch.addEventListener('click', function () { panel.classList.contains('open') ? shut() : open(); });
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) shut(); });

  chips.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) ask(b.textContent);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (q) ask(q);
  });

  function fallback() {
    return 'I could not reach the assistant just now. You can talk to the team directly on WhatsApp ' + WHATSAPP_URL + ' or email ' + EMAIL + '.';
  }

  function ask(q) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    chips.textContent = '';
    input.value = '';
    add(q, 'me');
    history.push({ role: 'user', content: q });

    var typing = el('div', { 'class': 'msg bot' }, [el('span', { 'class': 'typing', 'aria-label': 'Typing' }, [el('span'), el('span'), el('span')])]);
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12) }),
      signal: ctrl.signal
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        var reply = res.ok && res.body && res.body.reply ? res.body.reply : fallback();
        typing.remove();
        add(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        typing.remove();
        var reply = fallback();
        add(reply, 'bot');
        history.pop(); // drop the unanswered question so history stays valid
      })
      .finally(function () {
        clearTimeout(timer);
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }
})();
