const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT = __dirname;
const MIRROR = path.join(ROOT, 'mirror');
const SITE_ASSETS = path.join(ROOT, 'assets');
const CONTACT_DATA_FILE = process.env.CONTACT_DATA_FILE || path.join(ROOT, 'data', 'contact-submissions.jsonl');
const manifest = JSON.parse(fs.readFileSync(path.join(MIRROR, 'manifest.json'), 'utf8'));
const port = Number(process.env.PORT || process.argv[2] || 4187);
const contactAttempts = new Map();
const allowedServices = new Set(['strategy', 'content', 'production', 'social', 'campaign', 'other']);
const allowedRequestTypes = new Set(['project', 'audit', 'meeting']);
const phoneCountries = {
  QA: { code: '+974', min: 8, max: 8 },
  AE: { code: '+971', min: 9, max: 9 },
  SA: { code: '+966', min: 9, max: 9 },
  KW: { code: '+965', min: 8, max: 8 },
  BH: { code: '+973', min: 8, max: 8 },
  OM: { code: '+968', min: 8, max: 8 },
  GB: { code: '+44', min: 10, max: 10 },
  US: { code: '+1', min: 10, max: 10 },
  CA: { code: '+1', min: 10, max: 10 },
  IN: { code: '+91', min: 10, max: 10 },
  PK: { code: '+92', min: 10, max: 10 },
  EG: { code: '+20', min: 10, max: 10 }
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        tooLarge = true;
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanLine(value, maxLength) {
  return cleanText(value, maxLength).replace(/[\r\n]+/g, ' ');
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (contactAttempts.get(ip) || []).filter((time) => time > windowStart);
  recent.push(now);
  contactAttempts.set(ip, recent);
  return recent.length > 5;
}

async function deliverContact(submission) {
  let delivered = false;

  if (process.env.LEADS_WEBHOOK_URL) {
    const response = await fetch(process.env.LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.LEADS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.LEADS_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Lead backend returned ${response.status}`);
    delivered = true;
  }

  if (process.env.SMTP_HOST && process.env.CONTACT_TO) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    await transporter.sendMail({
      from: process.env.CONTACT_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_TO,
      replyTo: submission.email,
      subject: `New Trendy enquiry from ${submission.name}`,
      text: [
        `Name: ${submission.name}`,
        `Request: ${submission.requestType}`,
        `Email: ${submission.email}`,
        `Phone: ${submission.phoneCountry} ${phoneCountries[submission.phoneCountry]?.code || ''} ${submission.phone}`,
        `Company: ${submission.company || 'Not provided'}`,
        `Service: ${submission.service}`,
        '',
        submission.message
      ].join('\n')
    });
    delivered = true;
  }

  if (!delivered) {
    fs.mkdirSync(path.dirname(CONTACT_DATA_FILE), { recursive: true });
    fs.appendFileSync(CONTACT_DATA_FILE, `${JSON.stringify(submission)}\n`, { mode: 0o600 });
  }
}

async function handleContact(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    sendJson(res, 429, { message: 'Too many attempts. Please wait a few minutes and try again.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (cleanText(body.website, 200)) {
      sendJson(res, 200, { message: 'Thanks — your brief is with us.' });
      return;
    }

    const submission = {
      requestType: cleanLine(body.requestType, 20),
      name: cleanLine(body.name, 100),
      email: cleanLine(body.email, 160).toLowerCase(),
      phoneCountry: cleanLine(body.phoneCountry, 2).toUpperCase(),
      phone: cleanLine(body.phone, 30),
      company: cleanLine(body.company, 120),
      service: cleanLine(body.service, 30),
      message: cleanText(body.message, 3000),
      submittedAt: new Date().toISOString()
    };
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email);
    const phoneConfig = phoneCountries[submission.phoneCountry];
    const phoneDigits = submission.phone.replace(/\D/g, '');
    const phoneIsValid = Boolean(phoneConfig) && /^[0-9().\-\s]{7,30}$/.test(submission.phone) && phoneDigits.length >= phoneConfig.min && phoneDigits.length <= phoneConfig.max;
    if (!allowedRequestTypes.has(submission.requestType) || submission.name.length < 2 || !emailIsValid || !phoneIsValid || !allowedServices.has(submission.service) || submission.message.length < 20) {
      sendJson(res, 400, { message: 'Please provide your name, a valid email and phone number, service, and project brief.' });
      return;
    }

    await deliverContact(submission);
    sendJson(res, 200, { message: 'Thanks — your brief is with us. We’ll be in touch soon.' });
  } catch (error) {
    if (error.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { message: 'That brief is too large to submit.' });
      return;
    }
    const status = error.message === 'INVALID_JSON' ? 400 : 500;
    sendJson(res, status, { message: status === 400 ? 'Please submit a valid form.' : 'We could not send this right now. Email hello@trendy.qa instead.' });
  }
}

function pageFor(url) {
  const exact = manifest.pages[url.pathname + url.search];
  if (exact) return exact;
  const plain = manifest.pages[url.pathname];
  if (plain) return plain;
  if (url.pathname.endsWith('/')) return manifest.pages[url.pathname.slice(0, -1)];
  return manifest.pages[url.pathname + '/'];
}

function sendFile(req, res, filename, type) {
  const stat = fs.statSync(filename);
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type || 'application/octet-stream');
  const isLivePageAsset = type && (type.startsWith('text/html') || type.startsWith('text/css') || type.startsWith('text/javascript'));
  res.setHeader('Cache-Control', isLivePageAsset ? 'no-cache' : 'public, max-age=3600');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start <= end) {
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(filename, { start, end }).pipe(res);
        return;
      }
    }
  }
  res.setHeader('Content-Length', stat.size);
  res.writeHead(200);
  fs.createReadStream(filename).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/contact') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { message: 'Method not allowed.' });
      return;
    }
    await handleContact(req, res);
    return;
  }
  if (url.pathname === '/' || url.pathname === '/en' || url.pathname === '/en/') {
    sendFile(req, res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
    return;
  }
  if (url.pathname === '/styles.css') {
    sendFile(req, res, path.join(ROOT, 'styles.css'), 'text/css; charset=utf-8');
    return;
  }
  if (url.pathname === '/app.js') {
    sendFile(req, res, path.join(ROOT, 'app.js'), 'text/javascript; charset=utf-8');
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    const filename = path.basename(url.pathname);
    const fullPath = path.join(SITE_ASSETS, filename);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(filename).toLowerCase();
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      sendFile(req, res, fullPath, types[ext]);
      return;
    }
  }
  if (url.pathname.startsWith('/media/')) {
    const filename = path.basename(url.pathname);
    const fullPath = path.join(MIRROR, 'assets', filename);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(filename).toLowerCase();
      const types = { '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
      sendFile(req, res, fullPath, types[ext]);
      return;
    }
  }
  const asset = manifest.assets[url.pathname + url.search] || manifest.assets[url.pathname];
  if (asset) {
    sendFile(req, res, path.join(MIRROR, 'assets', asset.file), asset.type);
    return;
  }
  const page = pageFor(url);
  if (page) {
    sendFile(req, res, path.join(MIRROR, 'pages', page.file), 'text/html; charset=utf-8');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Not captured: ${url.pathname}${url.search}`);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Trendy redesign: http://127.0.0.1:${port}/en`);
  console.log(`Original capture remains available for its other routes and ${Object.keys(manifest.assets).length} local assets.`);
});
