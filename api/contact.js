const nodemailer = require('nodemailer');

const allowedRequestTypes = new Set(['project', 'audit', 'meeting']);
const allowedServices = new Set(['strategy', 'content', 'production', 'social', 'campaign', 'other']);
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

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanLine(value, maxLength) {
  return cleanText(value, maxLength).replace(/[\r\n]+/g, ' ');
}

function getBody(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return request.body;
}

async function deliverSubmission(submission) {
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
      subject: `New Trendy ${submission.requestType} enquiry from ${submission.name}`,
      text: [
        `Request: ${submission.requestType}`,
        `Name: ${submission.name}`,
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

  return delivered;
}

module.exports = async function contact(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'POST');

  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed.' });
  }

  try {
    const body = getBody(request);
    if (cleanText(body.website, 200)) {
      return response.status(200).json({ message: 'Thanks — your brief is with us.' });
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
    const phoneIsValid = Boolean(phoneConfig)
      && /^[0-9().\-\s]{7,30}$/.test(submission.phone)
      && phoneDigits.length >= phoneConfig.min
      && phoneDigits.length <= phoneConfig.max;

    if (!allowedRequestTypes.has(submission.requestType)
      || submission.name.length < 2
      || !emailIsValid
      || !phoneIsValid
      || !allowedServices.has(submission.service)
      || submission.message.length < 20) {
      return response.status(400).json({ message: 'Please complete every required field with valid contact details.' });
    }

    const delivered = await deliverSubmission(submission);
    if (!delivered) {
      return response.status(503).json({ message: 'Online enquiries are not configured yet. Please email hello@trendy.qa.' });
    }

    return response.status(200).json({ message: 'Thanks — your brief is with us. We’ll be in touch soon.' });
  } catch (error) {
    const invalidJson = error instanceof SyntaxError;
    return response.status(invalidJson ? 400 : 500).json({
      message: invalidJson ? 'Please submit a valid form.' : 'We could not send this right now. Email hello@trendy.qa instead.'
    });
  }
};
