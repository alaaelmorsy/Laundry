/**
 * Fix product images that were transferred without gzip compression.
 * Detects JPEG/PNG raw blobs and re-compresses them with gzip.
 */
const mysql = require('mysql2/promise');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

async function main() {
  const pool = await mysql.createPool({
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'laundry_db',
    waitForConnections: true,
  });

  const [rows] = await pool.query(
    'SELECT id, name_ar, image_blob, image_mime FROM products WHERE image_blob IS NOT NULL'
  );

  console.log(`Found ${rows.length} products with images`);

  let fixed = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const buf = row.image_blob;
    const first2 = buf[0].toString(16).padStart(2,'0') + buf[1].toString(16).padStart(2,'0');

    // Already gzip? (magic: 1f 8b)
    if (first2 === '1f8b') {
      skipped++;
      continue;
    }

    try {
      const gz = zlib.gzipSync(buf, { level: 9 });
      await pool.query('UPDATE products SET image_blob = ? WHERE id = ?', [gz, row.id]);
      console.log(`✓ Fixed: ${row.name_ar} (id=${row.id}) ${buf.length} -> ${gz.length} bytes`);
      fixed++;
    } catch (err) {
      console.error(`✗ Failed: ${row.name_ar} (id=${row.id})`, err.message);
      failed++;
    }
  }

  await pool.end();
  console.log(`\nDone: ${fixed} fixed, ${skipped} already gzip, ${failed} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
