const fs = require('fs');
const file = 'D:/PLUS/Laundry/database/db.js';
const c = fs.readFileSync(file, 'utf8');

// The garbled strings are Arabic UTF-8 bytes each mis-interpreted as Latin-1.
// Fix: take the garbled string, convert each char to its byte value (Latin-1),
// then decode those bytes as UTF-8 to get the correct Arabic.
function decode(garbled) {
  return Buffer.from(garbled, 'latin1').toString('utf8');
}

// List of garbled strings found in the file (as they appear in the source)
const garbled = [
  'Ø§Ø´ØªØ±Ø§Ùƒ Ø¬Ø¯ÙŠØ¯',
  'ØªØ¬Ø¯ÙŠØ¯ Ø§Ø´ØªØ±Ø§Ùƒ',
  'ØªØ¬Ø¯ÙŠØ¯ â€" ØªØ±Ø­ÙŠÙ„ Ø±ØµÙŠØ¯',
  'ØªØ¬Ø¯ÙŠØ¯ â€" Ø³Ø¯Ø§Ø¯ Ù…Ø¯ÙŠÙˆÙ†ÙŠØ©',
  'ØªØ¹Ø¯ÙŠÙ„ ÙŠØ¯ÙˆÙŠ Ù„Ù„Ø±ØµÙŠØ¯',
  'Ø¥Ø±Ø¬Ø§Ø¹ Ø¥ÙŠØµØ§Ù„ Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ Ø±Ù‚Ù…',
  'Ù…Ø±ØªØ¬Ø¹ Ø¥ÙŠØµØ§Ù„ Ø±Ù‚Ù…',
  'Ø¥ÙŠØµØ§Ù„ Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ C-',
  'Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ Ø¬Ø²Ø¦ÙŠ C-',
  'â€" ÙØ§ØªÙˆØ±Ø©',
  'Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø±ØªØ¨Ø· Ø¨Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø±Ù‚Ù…',
  'Ø¥Ø´Ø¹Ø§Ø± Ø¯Ø§Ø¦Ù†',
  ' â€" Ø³Ø¨Ø¨: ',
];

let result = c;
let count = 0;
for (const g of garbled) {
  const fixed = decode(g);
  const before = result;
  result = result.split(g).join(fixed);
  if (result !== before) {
    count++;
    console.log(`Fixed: "${g}" -> "${fixed}"`);
  }
}

fs.writeFileSync(file, result, 'utf8');
console.log(`\nTotal: ${count} replacements done.`);
