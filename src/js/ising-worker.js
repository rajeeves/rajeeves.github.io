'use strict';
var BETA = Math.log(1 + Math.SQRT2) / 2;
var T4 = Math.floor(Math.exp(-4 * BETA) * 4294967296) >>> 0;
var T8 = Math.floor(Math.exp(-8 * BETA) * 4294967296) >>> 0;
var frames, torus, off, nl, s = [], win = [], fwin = [], wsize, wmax, active = 0, r = new Uint32Array(4);
var log = new Uint32Array(1 << 16), nlog = 0;
function record(k, x, y) {
  if (nlog === log.length) { var b = new Uint32Array(log.length * 2); b.set(log); log = b; }
  log[nlog++] = (k << 25) | (y << 12) | x;
}
var PHB = new Uint32Array(5);
for (var q = 0; q < 5; q++) PHB[q] = Math.min(4294967295, Math.floor(4294967296 / (1 + Math.exp(-2 * BETA * (2 * q - 4)))));
var FG_SWEEPS = 6;

function tieBit(k, gx, gy) {
  var h = (Math.imul(gx, 0x9E3779B1) ^ Math.imul(gy, 0x85EBCA77) ^ Math.imul(k, 0xC2B2AE3D | 0)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846CA68B) >>> 0;
  h ^= h >>> 16;
  return h & 1;
}
function majority(k, S, gx, gy) { return S > 0 ? 1 : S < 0 ? -1 : (tieBit(k, gx, gy) ? 1 : -1); }

function seed(x) {
  for (var i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) | 0; var t = x ^ (x >>> 16); t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15; t = Math.imul(t, 0x735a2d97); r[i] = (t ^ (t >>> 15)) >>> 0;
  }
}

function centred(k, size) {
  var fw = frames[k][0], fh = frames[k][1], vw = Math.min(size[0], fw), vh = Math.min(size[1], fh);
  vw -= vw & 1; vh -= vh & 1;
  var x0 = (fw - vw) >> 1, y0 = (fh - vh) >> 1;
  if ((x0 + off[k][0]) & 1) x0--; if ((y0 + off[k][1]) & 1) y0--;
  return [Math.max(0, x0), Math.max(0, y0), Math.max(0, x0) + vw, Math.max(0, y0) + vh];
}
function setWindows() {
  for (var k = 0; k < nl; k++) { fwin[k] = centred(k, wmax); win[k] = centred(k, [Math.min(wsize[0], wmax[0]), Math.min(wsize[1], wmax[1])]); }
}
function setSizes(live, max) {
  if (!live) return;
  max = max || live;
  if (wsize && wmax && live[0] === wsize[0] && live[1] === wsize[1] && max[0] === wmax[0] && max[1] === wmax[1]) return;
  wsize = live; wmax = max; setWindows();
}

function sweep(k, constrained) {
  var w = constrained ? fwin[k] : win[k], x0 = w[0], y0 = w[1], x1 = w[2], y1 = w[3], W = frames[k][0], a = s[k];
  var c = constrained ? s[k + 1] : null, CW = constrained ? frames[k + 1][0] : 0;
  var ox = off[k][0], oy = off[k][1], cox = constrained ? off[k + 1][0] : 0, coy = constrained ? off[k + 1][1] : 0;
  var r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], flips = 0;
  for (var p = 0; p < 2; p++) {
    for (var y = y0 + 1; y < y1 - 1; y++) {
      var row = y * W, xs = x0 + 1; if (((xs + y) & 1) !== p) xs++;
      for (var x = xs; x < x1 - 1; x += 2) {
        var i = row + x, si = a[i];
        var dE = 2 * si * (a[i + 1] + a[i - 1] + a[i + W] + a[i - W]);
        if (dE > 0) {
          var m = Math.imul(r1, 5); var u = Math.imul((m << 7) | (m >>> 25), 9) >>> 0;
          var t = r1 << 9; r2 ^= r0; r3 ^= r1; r1 ^= r2; r0 ^= r3; r2 ^= t; r3 = (r3 << 11) | (r3 >>> 21);
          if (u >= (dE === 4 ? T4 : T8)) continue;
        }
        if (constrained) {
          var gx = x + ox, gy = y + oy, bx = gx & ~1, by = gy & ~1, j = (by - oy) * W + (bx - ox);
          var S = a[j] + a[j + 1] + a[j + W] + a[j + W + 1] - 2 * si;
          var cgx = gx >> 1, cgy = gy >> 1;
          if (majority(k + 1, S, cgx, cgy) !== c[(cgy - coy) * CW + (cgx - cox)]) continue;
        }
        a[i] = -si; flips++;
      }
    }
  }
  r[0] = r0; r[1] = r1; r[2] = r2; r[3] = r3;
  return flips;
}

function fixup(k) {
  var w = fwin[k], W = frames[k][0], a = s[k], c = s[k + 1], CW = frames[k + 1][0], bad = 0;
  var ox = off[k][0], oy = off[k][1], cox = off[k + 1][0], coy = off[k + 1][1];
  for (var y = w[1]; y < w[3]; y += 2) for (var x = w[0]; x < w[2]; x += 2) {
    var j = y * W + x, S = a[j] + a[j + 1] + a[j + W] + a[j + W + 1];
    var cgx = (x + ox) >> 1, cgy = (y + oy) >> 1, cv = c[(cgy - coy) * CW + (cgx - cox)];
    if (majority(k + 1, S, cgx, cgy) !== cv) { a[j] = a[j + 1] = a[j + W] = a[j + W + 1] = cv; bad++; }
  }
  return bad;
}

function imageChain(k, rect) {
  var rects = [], x0 = rect[0], y0 = rect[1], x1 = rect[2], y1 = rect[3];
  for (var j = k; j < nl - 1; j++) {
    var W = frames[j][0], H = frames[j][1], CW = frames[j + 1][0], CH = frames[j + 1][1];
    var ox = off[j][0], oy = off[j][1], cox = off[j + 1][0], coy = off[j + 1][1];
    var px0 = Math.max(((x0 + ox) >> 1) - cox, 0, Math.ceil(ox / 2) - cox);
    var py0 = Math.max(((y0 + oy) >> 1) - coy, 0, Math.ceil(oy / 2) - coy);
    var px1 = Math.min(((x1 + ox + 1) >> 1) - cox, CW, Math.floor((ox + W) / 2) - cox);
    var py1 = Math.min(((y1 + oy + 1) >> 1) - coy, CH, Math.floor((oy + H) / 2) - coy);
    if (px1 <= px0 || py1 <= py0) break;
    rects.push([j + 1, px0, py0, px1, py1]);
    x0 = px0; y0 = py0; x1 = px1; y1 = py1;
  }
  return rects;
}
function parentValue(j, px, py) {
  var W = frames[j][0], cx = 2 * (px + off[j + 1][0]) - off[j][0], cy = 2 * (py + off[j + 1][1]) - off[j][1], i = cy * W + cx, a = s[j];
  return majority(j + 1, a[i] + a[i + 1] + a[i + W] + a[i + W + 1], px + off[j + 1][0], py + off[j + 1][1]);
}
function derive(k, rect) {
  var rects = imageChain(k, rect);
  rects.forEach(function (q) {
    var j = q[0] - 1, c = s[q[0]], CW = frames[q[0]][0];
    for (var py = q[2]; py < q[4]; py++) for (var px = q[1]; px < q[3]; px++) c[py * CW + px] = parentValue(j, px, py);
  });
  return rects;
}

function patch(k, x0, y0, x1, y1) {
  var W = frames[k][0], w = x1 - x0, h = y1 - y0, d = new Uint8Array(w * h), a = s[k];
  for (var y = 0; y < h; y++) for (var i = (y0 + y) * W + x0, j = y * w, e = j + w; j < e; i++, j++) d[j] = a[i] > 0 ? 255 : 0;
  return { k: k, x: x0, y: y0, w: w, h: h, data: d };
}
function packedLog() {
  var out = new Uint32Array(nlog);
  for (var n = 0; n < nlog; n++) {
    var e = log[n], k = e >>> 25, y = (e >>> 12) & 4095, x = e & 4095;
    out[n] = e | (s[k][y * frames[k][0] + x] > 0 ? 1 << 24 : 0);
  }
  nlog = 0;
  return out;
}
function propagate(k, x, y) {
  for (var j = k; j < nl - 1; j++) {
    var px = ((x + off[j][0]) >> 1) - off[j + 1][0], py = ((y + off[j][1]) >> 1) - off[j + 1][1];
    if (px < 0 || py < 0 || px >= frames[j + 1][0] || py >= frames[j + 1][1]) return;
    var i = py * frames[j + 1][0] + px, v = parentValue(j, px, py);
    if (v === s[j + 1][i]) return;
    s[j + 1][i] = v; record(j + 1, px, py); x = px; y = py;
  }
}
var BAND = 32, carry = 0;
function heatbath(k, n) {
  var w = win[k], x0 = w[0] + 1, y0 = w[1] + 1, nx = w[2] - w[0] - 2, ny = w[3] - w[1] - 2, W = frames[k][0];
  var a = s[k], flips = 0, r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3];
  var perRow = n / ny;
  for (var b0 = 0; b0 < ny; b0 += BAND) {
    var bh = Math.min(BAND, ny - b0), want = perRow * bh + carry, nb = Math.floor(want); carry = want - nb;
    for (var t = 0; t < nb; t++) {
      var mm = Math.imul(r1, 5), u1 = Math.imul((mm << 7) | (mm >>> 25), 9) >>> 0;
      var tt = r1 << 9; r2 ^= r0; r3 ^= r1; r1 ^= r2; r0 ^= r3; r2 ^= tt; r3 = (r3 << 11) | (r3 >>> 21);
      mm = Math.imul(r1, 5); var u2 = Math.imul((mm << 7) | (mm >>> 25), 9) >>> 0;
      tt = r1 << 9; r2 ^= r0; r3 ^= r1; r1 ^= r2; r0 ^= r3; r2 ^= tt; r3 = (r3 << 11) | (r3 >>> 21);
      var x = x0 + Math.floor((u1 >>> 16) * nx / 65536), y = y0 + b0 + Math.floor((u1 & 0xffff) * bh / 65536);
      var i = y * W + x, h = a[i + 1] + a[i - 1] + a[i + W] + a[i - W];
      var v = u2 < PHB[(h + 4) >> 1] ? 1 : -1;
      if (v !== a[i]) { a[i] = v; record(k, x, y); flips++; propagate(k, x, y); }
    }
  }
  r[0] = r0; r[1] = r1; r[2] = r2; r[3] = r3;
  return flips;
}

function setActive(target) {
  target = Math.max(0, Math.min(nl - 1, target));
  while (active > target) {
    var t0 = performance.now(), k = active - 1, bad = fixup(k), flips = 0;
    for (var n = 0; n < FG_SWEEPS; n++) flips += sweep(k, true);
    var w = fwin[k];
    active = k;
    send('active', { ms: performance.now() - t0, info: [{ k: k, fixedBlocks: bad, flips: flips }], done: active === target },
         [patch(k, w[0], w[1], w[2], w[3])]);
  }
  if (active !== target) { active = target; send('active', { ms: 0, info: [], done: true }, []); }
}

function send(type, extra, ps) {
  var msg = { type: type, active: active, patches: ps };
  for (var key in extra) msg[key] = extra[key];
  postMessage(msg, ps.map(function (p) { return p.data.buffer; }));
}

onmessage = function (e) {
  var m = e.data;
  if (m.type === 'init') {
    frames = m.frames; torus = m.torus; nl = frames.length; seed(m.seed);
    off = frames.map(function (f, k) { return [(torus[k][0] - f[0]) >> 1, (torus[k][1] - f[1]) >> 1]; });
    for (var k = 0; k < nl; k++) {
      var d = m.levels[k], a = new Int8Array(d.buffer, d.byteOffset, d.length);
      for (var i = 0; i < d.length; i++) a[i] = d[i] ? 1 : -1;
      s[k] = a;
    }
    setSizes(m.size, m.max); active = Math.max(0, Math.min(nl - 1, m.active | 0));
    send('ready', {}, []);
  } else if (m.type === 'size') {
    setSizes(m.size, m.max);
  } else if (m.type === 'active') {
    setSizes(m.size, m.max);
    if (m.fgSweeps != null) FG_SWEEPS = m.fgSweeps;
    if (m.level === active) send('active', { ms: 0, info: [], done: true }, []); else setActive(m.level);
  } else if (m.type === 'tick') {
    setSizes(m.size, m.max);
    if (m.level != null && m.level !== active) setActive(m.level);
    var t2 = performance.now(), w = win[active];
    var flips = heatbath(active, Math.round(m.sweeps * (w[2] - w[0] - 2) * (w[3] - w[1] - 2)));
    var t3 = performance.now(), changed = packedLog();
    postMessage({ type: 'tick', active: active, sweeps: m.sweeps, flips: flips, changed: changed, patches: [],
                  ms: t3 - t2, msPatch: performance.now() - t3 }, [changed.buffer]);
  }
};
