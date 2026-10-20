// Vercel serverless function: POST /api/audit
// Uses the ANTHROPIC_API_KEY environment variable. The key never reaches the browser.

const HOSTS = ['instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'facebook.com', 'linkedin.com', 'youtube.com', 'youtu.be', 'threads.net'];

const SYSTEM = `You are the audit engine for Grownics by Bloova, made by Bloova, a creative growth studio and media brand in Lagos, Nigeria. You review a social media account and produce an honest diagnosis and a practical growth plan.

You are given the account link and details the account owner typed in. You cannot see the account itself. Base every judgement only on the details given, say so where details are thin, and never invent numbers, posts, competitors or results that were not provided. Where you estimate, say it is an estimate.

Be specific and direct. Name real problems and say why each one hurts growth. Give fixes the owner can act on this week. Match advice to the platform, the niche, the audience and the goal given.

Writing rules: plain, warm, professional English. Never use hyphens or dashes of any kind in any text you write, including ranges and compound words; use "to", commas or full stops instead (write "short form video", "5 to 7 posts"). Do not use emojis.

Return ONLY valid JSON, no markdown, no code fences, in exactly this shape:
{
 "score": number 0 to 100,
 "verdict": "one sentence headline of the diagnosis",
 "summary": "2 to 3 sentences in plain language",
 "dataNote": "one sentence on how reliable this audit is given the details provided",
 "areas": [ {"name": "Profile and positioning", "score": 0 to 100, "note": "one sentence"}, {"name": "Content quality", ...}, {"name": "Consistency", ...}, {"name": "Engagement", ...}, {"name": "Growth readiness", ...} ],
 "strengths": ["2 to 4 items"],
 "problems": [ {"title": "short", "severity": "high" or "medium" or "low", "why": "why it holds the account back", "fix": "what to do"} ] (4 to 7 items, most serious first),
 "quickWins": ["3 to 5 things to do in the next 48 hours"],
 "plan": [ {"week": "Week 1", "focus": "short", "actions": ["3 to 5 actions"]}, Week 2, Week 3, Week 4 ],
 "targets": [ {"metric": "name", "goal": "realistic 30 day target stated as an estimate"} ] (3 to 4 items),
 "contentIdeas": ["5 specific content ideas for this niche and platform"]
}`;

const hits = new Map(); // best effort limit: 5 audits per 10 minutes per IP
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

function clean(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function parseJson(text) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_request' });

  // Validate the link
  let url;
  try {
    url = new URL(clean(body.url, 300).match(/^https?:\/\//i) ? clean(body.url, 300) : 'https://' + clean(body.url, 300));
  } catch (e) { return res.status(400).json({ error: 'bad_link' }); }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!HOSTS.some((h) => host === h || host.endsWith('.' + h))) return res.status(400).json({ error: 'bad_link' });

  const f = body.form || {};
  const formats = Array.isArray(f.formats) ? f.formats.map((x) => clean(x, 40)).filter(Boolean).slice(0, 8) : [];
  const details = [
    'Account link: ' + url.origin + url.pathname,
    'Platform: ' + host,
    'Followers: ' + clean(String(f.followers || ''), 20),
    'Posting frequency: ' + clean(f.frequency, 60),
    'Content formats used: ' + (formats.join(', ') || 'not given'),
    'Typical views or likes per post: ' + (clean(String(f.typical || ''), 30) || 'not given'),
    'Bio as written: ' + (clean(f.bio, 400) || 'not given'),
    'Niche or industry: ' + clean(f.niche, 120),
    'Target audience: ' + (clean(f.audience, 200) || 'not given'),
    'Main goal: ' + clean(f.goal, 80),
    'Biggest struggle: ' + (clean(f.struggle, 400) || 'not given'),
    'Recent captions: ' + (clean(f.captions, 900) || 'not given')
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 3500,
        system: SYSTEM,
        messages: [{ role: 'user', content: 'Audit this account.\n\n' + details }]
      }),
      signal: controller.signal
    });
    if (!r.ok) {
      console.error('Anthropic API error', r.status, (await r.text()).slice(0, 300));
      return res.status(502).json({ error: 'upstream_error' });
    }
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const report = parseJson(text);
    if (!report || typeof report.score !== 'number' || !Array.isArray(report.problems)) {
      console.error('Unparseable audit output');
      return res.status(502).json({ error: 'bad_output' });
    }
    return res.status(200).json({ report, meta: { platform: host, link: url.origin + url.pathname } });
  } catch (err) {
    console.error('Audit error', err && err.message);
    return res.status(502).json({ error: 'upstream_error' });
  } finally {
    clearTimeout(timer);
  }
};
