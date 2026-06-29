/**
 * Provide SSL certificate for HTTPS.
 *
 * Priority:
 * 1. mkcert-generated trusted certificate (localhost-key.pem / localhost-cert.pem)
 * 2. Existing self-signed certificate (key.pem / cert.pem)
 * 3. Auto-generate a new self-signed certificate via node-forge
 *
 * mkcert is recommended for local development because Chrome/Edge trust it
 * without showing "Not Secure" warnings.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const forge = require('node-forge');
const { DATA_ROOT } = require('./paths');

const CERT_DIR = path.join(DATA_ROOT, 'ssl');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');

function getLocalIPs() {
  const ips = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  } catch (e) {}
  return ips;
}

function ensureCerts() {
  // 1) Prefer mkcert-generated trusted certificates if available
  const MKCERT_KEY = path.join(CERT_DIR, 'localhost-key.pem');
  const MKCERT_CERT = path.join(CERT_DIR, 'localhost-cert.pem');
  if (fs.existsSync(MKCERT_KEY) && fs.existsSync(MKCERT_CERT)) {
    try {
      const key = fs.readFileSync(MKCERT_KEY, 'utf8');
      const cert = fs.readFileSync(MKCERT_CERT, 'utf8');
      forge.pki.certificateFromPem(cert); // quick parse check
      console.log('[SSL] Using trusted mkcert certificate.');
      return { key, cert };
    } catch (e) {
      console.log('[SSL] mkcert certificate invalid, falling back...');
    }
  }

  // 2) Reuse existing self-signed certs if still valid
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    try {
      const key = fs.readFileSync(KEY_FILE, 'utf8');
      const cert = fs.readFileSync(CERT_FILE, 'utf8');
      forge.pki.certificateFromPem(cert);
      return { key, cert };
    } catch (e) {
      console.log('[SSL] Existing certificate invalid, regenerating...');
    }
  }

  // 3) Generate new self-signed certificate
  // Create ssl directory
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  console.log('[SSL] توليد شهادة SSL جديدة... قد يستغرق 15-30 ثانية');
  // Generate RSA key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);

  // Valid for 1 year
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  // Subject / Issuer
  const attrs = [
    { name: 'commonName', value: 'Laundry POS Local' },
    { name: 'organizationName', value: 'Laundry POS' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed

  // Build Subject Alternative Names
  const localIPs = getLocalIPs();
  const altNames = [
    { type: 2, value: 'localhost' }, // DNS
    { type: 7, ip: '127.0.0.1' },   // IP
  ];
  localIPs.forEach(ip => {
    altNames.push({ type: 7, ip });
  });

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
  ]);

  // Sign with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Convert to PEM
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
  const pemCert = forge.pki.certificateToPem(cert);

  fs.writeFileSync(KEY_FILE, pemKey);
  fs.writeFileSync(CERT_FILE, pemCert);

  console.log('[SSL] Self-signed certificate generated at:', CERT_DIR);
  console.log('[SSL] Certificate covers: localhost, 127.0.0.1' + (localIPs.length ? ', ' + localIPs.join(', ') : ''));

  return { key: pemKey, cert: pemCert };
}

module.exports = { ensureCerts };
