'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./database/db');

(async () => {
  try {
    await db.initialize();
    console.log('[migrate] DB initialization complete');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Failed:', err.message);
    process.exit(1);
  }
})();
