/*!
 * Minimal QR Code SVG Generator — Byte mode, Auto version, Level M
 * Adapted from public-domain QR code specifications
 */
(function (root) {
  'use strict';

  /* ── GF(256) tables ── */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
    }
    for (var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

  function rsGen(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var q = [1, EXP[i]];
      var r = new Array(p.length + 1).fill(0);
      for (var j = 0; j < p.length; j++)
        for (var k = 0; k < q.length; k++)
          r[j + k] ^= gfMul(p[j], q[k]);
      p = r;
    }
    return p;
  }

  function rsEncode(data, n) {
    var gen = rsGen(n);
    var rem = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var c = data[i] ^ rem.shift(); rem.push(0);
      for (var j = 0; j < n; j++) rem[j] ^= gfMul(gen[j], c);
    }
    return rem;
  }

  /* ── Version capacity table (byte mode, level M) ── */
  /* [dataCodewords, ecCodewordsPerBlock, blocks1, blocks2] */
  var CAP = [
    null,
    [16,10,1,0,0],   /* v1 */
    [28,16,1,0,0],   /* v2 */
    [44,26,1,0,0],   /* v3 */
    [64,18,2,0,0],   /* v4 */
    [86,24,2,0,0],   /* v5 */
    [108,16,4,0,0],  /* v6 */
    [124,18,4,0,0],  /* v7 */
    [154,22,2,2,0],  /* v8  — 2 blocks of 19, 2 of 20 data codewords */
    [182,22,3,2,0],  /* v9 */
    [216,26,4,1,0],  /* v10 */
    [254,30,1,4,0],  /* v11 */
    [290,22,6,2,0],  /* v12 */
    [334,22,8,1,0],  /* v13 */
    [365,24,4,5,0],  /* v14 */
    [415,24,5,5,0],  /* v15 */
    [453,28,7,3,0],  /* v16 */
    [507,28,10,1,0], /* v17 */
    [563,26,9,4,0],  /* v18 */
    [627,26,3,11,0], /* v19 */
    [669,26,3,13,0], /* v20 */
  ];

  /* Accurate data capacity per version/level M (max data bytes encodable) */
  var DCAP = [0,
    16,28,44,64,86,108,124,154,182,216,
    254,290,334,365,415,453,507,563,627,669
  ];

  /* EC codewords per block, and block counts for level M */
  var EC_INFO = [null,
    {ec:10,b1:1,d1:16, b2:0,d2:0},
    {ec:16,b1:1,d1:28, b2:0,d2:0},
    {ec:26,b1:1,d1:44, b2:0,d2:0},
    {ec:18,b1:2,d1:32, b2:0,d2:0},
    {ec:24,b1:2,d1:43, b2:0,d2:0},
    {ec:16,b1:4,d1:27, b2:0,d2:0},
    {ec:18,b1:4,d1:31, b2:0,d2:0},
    {ec:22,b1:2,d1:38, b2:2,d2:39},
    {ec:22,b1:3,d1:36, b2:2,d2:37},
    {ec:26,b1:4,d1:43, b2:1,d2:44},
    {ec:30,b1:1,d1:50, b2:4,d2:51},
    {ec:22,b1:6,d1:36, b2:2,d2:37},
    {ec:22,b1:8,d1:37, b2:1,d2:38},
    {ec:24,b1:4,d1:40, b2:5,d2:41},
    {ec:24,b1:5,d1:41, b2:5,d2:42},
    {ec:28,b1:7,d1:45, b2:3,d2:46},
    {ec:28,b1:10,d1:46,b2:1,d2:47},
    {ec:26,b1:9,d1:43, b2:4,d2:44},
    {ec:26,b1:3,d1:44, b2:11,d2:45},
    {ec:26,b1:3,d1:41, b2:13,d2:42},
  ];

  /* Alignment pattern centers */
  var ALIGN = [null,
    [],[6,18],[6,22],[6,26],[6,30],[6,34],
    [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],
    [6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],
    [6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,86],
  ];

  /* Format info strings for level M (mask 0..7) — ISO 18004 standard values */
  var FMT_M = [
    [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0],
    [1,0,1,0,0,0,1,0,0,1,0,0,1,0,1],
    [1,0,1,1,1,1,0,0,1,1,1,1,1,0,0],
    [1,0,1,1,0,1,1,0,1,0,0,1,0,1,1],
    [1,0,0,0,1,0,1,1,1,1,1,1,0,0,1],
    [1,0,0,0,0,0,0,1,1,0,0,1,1,1,0],
    [1,0,0,1,1,1,1,1,0,0,1,0,1,1,1],
    [1,0,0,1,0,1,0,1,0,1,0,0,0,0,0],
  ];

  /* Version info bits for v7-v20 */
  var VER_INFO = [null,null,null,null,null,null,null,
    0x07C94,0x085BC,0x09A99,0x0A4D3,0x0BBF6,0x0C762,0x0D847,0x0E60D,
    0x0F928,0x10B78,0x1145D,0x12A17,0x13532,0x149A6,
  ];

  /* ── Matrix helpers ── */
  function makeMatrix(size) {
    var m = [];
    for (var i = 0; i < size; i++) {
      m.push(new Array(size).fill(-1));
    }
    return m;
  }

  function setFinderPattern(m, r, c) {
    for (var i = 0; i < 7; i++)
      for (var j = 0; j < 7; j++) {
        var v = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) ? 3 : 2;
        m[r + i][c + j] = v;
      }
  }

  function setAlignPattern(m, r, c) {
    for (var i = -2; i <= 2; i++)
      for (var j = -2; j <= 2; j++) {
        var v = (i === -2 || i === 2 || j === -2 || j === 2 || (i === 0 && j === 0)) ? 3 : 2;
        m[r + i][c + j] = v;
      }
  }

  function setTimingPatterns(m, size) {
    for (var i = 8; i < size - 8; i++) {
      var v = i % 2 === 0 ? 3 : 2;
      if (m[6][i] === -1) m[6][i] = v;
      if (m[i][6] === -1) m[i][6] = v;
    }
  }

  function reserveFormatArea(m, size) {
    /* horizontal & vertical format info strips */
    for (var i = 0; i < 9; i++) {
      if (m[8][i] === -1) m[8][i] = 2;
      if (m[i][8] === -1) m[i][8] = 2;
    }
    for (var i = size - 8; i < size; i++) {
      if (m[8][i] === -1) m[8][i] = 2;
      if (m[i][8] === -1) m[i][8] = 2;
    }
    /* dark module */
    m[size - 8][8] = 3;
  }

  function placeFormatInfo(m, size, mask) {
    var bits = FMT_M[mask];
    /* top-left: 15 bits (horizontal then vertical, skipping timing rows/cols) */
    var cols = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
    var rows = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
    for (var i = 0; i < 15; i++) m[rows[i]][cols[i]] = bits[i];
    /* top-right backup: bits 7-14 at columns (size-8)..(size-1) */
    for (var i = 0; i < 8; i++) m[8][size - 8 + i] = bits[7 + i];
    /* bottom-left backup: bits 0-6 at rows (size-7)..(size-1) */
    for (var i = 0; i < 7; i++) m[size - 7 + i][8] = bits[i];
    m[size - 8][8] = 1; /* dark module */
  }

  function placeVersionInfo(m, size, ver) {
    if (ver < 7) return;
    var bits = VER_INFO[ver];
    for (var i = 0; i < 18; i++) {
      var b = (bits >> i) & 1;
      var r = Math.floor(i / 3);
      var c = (i % 3) + size - 11;
      m[r][c] = b ? 3 : 2;
      m[c][r] = b ? 3 : 2;
    }
  }

  function applyMask(m, size, mask) {
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size; c++) {
        if (m[r][c] > 1) continue; /* reserved */
        var cond = false;
        switch (mask) {
          case 0: cond = (r + c) % 2 === 0; break;
          case 1: cond = r % 2 === 0; break;
          case 2: cond = c % 3 === 0; break;
          case 3: cond = (r + c) % 3 === 0; break;
          case 4: cond = (Math.floor(r/2) + Math.floor(c/3)) % 2 === 0; break;
          case 5: cond = (r*c)%2 + (r*c)%3 === 0; break;
          case 6: cond = ((r*c)%2 + (r*c)%3) % 2 === 0; break;
          case 7: cond = ((r+c)%2 + (r*c)%3) % 2 === 0; break;
        }
        if (cond) m[r][c] ^= 1;
      }
  }

  function penalty(m, size) {
    var pen = 0;
    function bit(v) { return v & 1; }
    /* Rule 1 */
    for (var r = 0; r < size; r++) {
      var run = 1;
      for (var c = 1; c < size; c++) {
        if (bit(m[r][c]) === bit(m[r][c-1])) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; }
        else run = 1;
      }
    }
    for (var c = 0; c < size; c++) {
      var run = 1;
      for (var r = 1; r < size; r++) {
        if (bit(m[r][c]) === bit(m[r-1][c])) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; }
        else run = 1;
      }
    }
    /* Rule 2 */
    for (var r = 0; r < size - 1; r++)
      for (var c = 0; c < size - 1; c++)
        if (bit(m[r][c]) === bit(m[r][c+1]) && bit(m[r][c]) === bit(m[r+1][c]) && bit(m[r][c]) === bit(m[r+1][c+1]))
          pen += 3;
    /* Rule 3 */
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size - 10; c++) {
        var h1=true,h2=true,v1=true,v2=true;
        for (var k = 0; k < 11; k++) {
          if (bit(m[r][c+k]) !== pat1[k]) h1=false;
          if (bit(m[r][c+k]) !== pat2[k]) h2=false;
          if (m[c+k] !== undefined && bit(m[c+k][r]) !== pat1[k]) v1=false;
          if (m[c+k] !== undefined && bit(m[c+k][r]) !== pat2[k]) v2=false;
        }
        if (h1||h2) pen += 40;
        if (v1||v2) pen += 40;
      }
    /* Rule 4 */
    var dark = 0;
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) dark += bit(m[r][c]);
    var pct = dark / (size * size) * 100;
    pen += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return pen;
  }

  /* ── Data encoding ── */
  function strToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) { bytes.push(c); }
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
      else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
    }
    return bytes;
  }

  function buildData(bytes, ver) {
    var charCount = bytes.length;
    var ccBits = ver < 10 ? 8 : 16;
    var bits = [];
    function pushBits(n, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((n >> i) & 1);
    }
    pushBits(4, 4);        /* mode: byte */
    pushBits(charCount, ccBits);
    for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    /* terminator */
    for (var i = 0; i < 4 && bits.length < DCAP[ver] * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    /* padding codewords */
    var pads = [0xEC, 0x11];
    var pi = 0;
    while (bits.length < DCAP[ver] * 8) { pushBits(pads[pi++ % 2], 8); }
    /* bits → bytes */
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
      data.push(b);
    }
    return data;
  }

  function interleave(data, ver) {
    var info = EC_INFO[ver];
    var blocks = [], ecBlocks = [];
    var pos = 0;
    for (var b = 0; b < info.b1; b++) {
      var d = data.slice(pos, pos + info.d1); pos += info.d1;
      blocks.push(d); ecBlocks.push(rsEncode(d, info.ec));
    }
    for (var b = 0; b < info.b2; b++) {
      var d = data.slice(pos, pos + info.d2); pos += info.d2;
      blocks.push(d); ecBlocks.push(rsEncode(d, info.ec));
    }
    var result = [];
    var maxD = Math.max(info.d1, info.d2 || 0);
    for (var i = 0; i < maxD; i++)
      for (var b = 0; b < blocks.length; b++)
        if (i < blocks[b].length) result.push(blocks[b][i]);
    for (var i = 0; i < info.ec; i++)
      for (var b = 0; b < ecBlocks.length; b++)
        result.push(ecBlocks[b][i]);
    return result;
  }

  /* ── Place data bits in matrix ── */
  function placeData(m, size, codewords) {
    var bits = [];
    for (var i = 0; i < codewords.length; i++)
      for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
    var bi = 0;
    var up = true;
    for (var c = size - 1; c >= 0; c -= 2) {
      if (c === 6) c = 5; /* skip timing */
      for (var step = 0; step < size; step++) {
        var r = up ? (size - 1 - step) : step;
        for (var dc = 0; dc <= 1; dc++) {
          var col = c - dc;
          if (col === 6) continue;
          if (m[r][col] === -1) {
            m[r][col] = bi < bits.length ? bits[bi++] : 0;
          }
        }
      }
      up = !up;
    }
  }

  /* ── Main generate function ── */
  function generate(text) {
    var bytes = strToBytes(text);
    /* find minimum version */
    var ver = 1;
    while (ver <= 20 && DCAP[ver] < bytes.length + (ver < 10 ? 3 : 4)) ver++;
    if (ver > 20) throw new Error('QR: data too large');

    var size = ver * 4 + 17;
    var alignPos = ALIGN[ver] || [];
    var data = buildData(bytes, ver);
    var codewords = interleave(data, ver);

    /* try all 8 masks, pick best penalty */
    var bestMask = 0, bestPen = Infinity, bestMatrix;

    for (var mask = 0; mask < 8; mask++) {
      var m = makeMatrix(size);

      /* finder patterns */
      setFinderPattern(m, 0, 0);
      setFinderPattern(m, 0, size - 7);
      setFinderPattern(m, size - 7, 0);

      /* separators */
      for (var i = 0; i < 8; i++) {
        if (m[7][i] === -1) m[7][i] = 2;
        if (m[i][7] === -1) m[i][7] = 2;
        if (m[7][size-1-i] === -1) m[7][size-1-i] = 2;
        if (m[i][size-8] === -1) m[i][size-8] = 2;
        if (m[size-8][i] === -1) m[size-8][i] = 2;
        if (m[size-1-i][7] === -1) m[size-1-i][7] = 2;
      }

      /* alignment patterns */
      for (var ai = 0; ai < alignPos.length; ai++)
        for (var aj = 0; aj < alignPos.length; aj++) {
          var ar = alignPos[ai], ac = alignPos[aj];
          if (m[ar][ac] === -1) setAlignPattern(m, ar, ac);
        }

      setTimingPatterns(m, size);
      reserveFormatArea(m, size);
      placeVersionInfo(m, size, ver);
      placeData(m, size, codewords);
      applyMask(m, size, mask);
      placeFormatInfo(m, size, mask);

      var pen = penalty(m, size);
      if (pen < bestPen) { bestPen = pen; bestMask = mask; bestMatrix = m; }
    }

    return { matrix: bestMatrix, size: size };
  }

  /* ── SVG renderer ── */
  function toSVG(text, cellSize) {
    cellSize = cellSize || 3;
    var qr = generate(text);
    var m = qr.matrix, size = qr.size;
    var dim = size * cellSize;
    var rects = [];
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size; c++)
        if (m[r][c] & 1)
          rects.push('<rect x="' + (c*cellSize) + '" y="' + (r*cellSize) + '" width="' + cellSize + '" height="' + cellSize + '"/>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" width="' + dim + '" height="' + dim + '">'
      + '<rect width="' + dim + '" height="' + dim + '" fill="white"/>'
      + '<g fill="black">' + rects.join('') + '</g></svg>';
  }

  root.QRMin = { toSVG: toSVG };
})(typeof window !== 'undefined' ? window : global);
