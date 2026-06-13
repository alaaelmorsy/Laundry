const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SSL_DIR = path.join(__dirname, '..', 'ssl');
const TOOLS_DIR = path.join(__dirname, '..', 'tools');

function getLocalIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function findMkcert() {
  // 1) bundled local copy
  const local = path.join(TOOLS_DIR, 'mkcert.exe');
  if (fs.existsSync(local)) return local;

  // 2) system PATH
  try {
    execSync('mkcert -version', { stdio: 'ignore' });
    return 'mkcert';
  } catch {
    return null;
  }
}

function installLocalCA(mkcertPath) {
  try {
    console.log('🔧 تشغيل mkcert -install لتثبيت الـ Root CA المحلي...');
    execFileSync(mkcertPath, ['-install'], { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.warn('');
    console.warn('⚠️  لم يتمكن mkcert من تثبيت الـ Root CA تلقائيًا.');
    console.warn('   السبب المحتمل: تحتاج تشغيل الـ Terminal كـ Administrator.');
    console.warn('   إذا كنت على Windows: اضغط يمين على CMD/PowerShell واختر "Run as administrator" ثم شغّل:');
    console.warn(`   "${mkcertPath}" -install`);
    console.warn('');
    console.warn('   بدون تثبيت الـ Root CA ستظل الشهادة تعمل لكن قد يظهر تحذير في المتصفح حتى تقبلها يدويًا.');
    console.warn('');
    return false;
  }
}

function main() {
  const mkcertPath = findMkcert();

  if (!mkcertPath) {
    console.error('❌ mkcert غير متوفر.');
    console.log('');
    console.log('📥 يمكنك تثبيته يدويًا:');
    console.log('   • Windows (Winget):     winget install mkcert');
    console.log('   • Windows (Scoop):      scoop install mkcert');
    console.log('   • macOS (Homebrew):     brew install mkcert');
    console.log('   • Linux:                apt install libnss3-tools  (ثم حمل mkcert من GitHub)');
    console.log('');
    console.log('أو ضع ملف mkcert.exe في مجلد tools/ داخل المشروع.');
    process.exit(1);
  }

  console.log(`✅ تم العثور على mkcert: ${mkcertPath}`);

  // Ensure local CA is installed
  installLocalCA(mkcertPath);

  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }

  const keyFile = path.join(SSL_DIR, 'localhost-key.pem');
  const certFile = path.join(SSL_DIR, 'localhost-cert.pem');

  const ips = getLocalIPs();
  const hosts = ['localhost', '127.0.0.1', '::1', ...ips];

  try {
    const args = [
      '-key-file', keyFile,
      '-cert-file', certFile,
      ...hosts
    ];
    execFileSync(mkcertPath, args, { stdio: 'inherit' });
    console.log('');
    console.log('✅ تم إنشاء شهادة SSL موثوقة محليًا بنجاح!');
    console.log(`   📁 المجلد: ${SSL_DIR}`);
    console.log(`   🔑 المفتاح: ${keyFile}`);
    console.log(`   📜 الشهادة: ${certFile}`);
    console.log(`   🌐 الـ IP المحلية: ${ips.join(', ') || 'لا يوجد'}`);
    console.log('');
    console.log('🚀 الآن شغّل التطبيق: npm start');
    console.log('   Chrome و Edge سيقبلان الشهادة تلقائيًا بدون تحذير.');
  } catch (err) {
    console.error('❌ فشل إنشاء الشهادة:', err.message);
    process.exit(1);
  }
}

main();
