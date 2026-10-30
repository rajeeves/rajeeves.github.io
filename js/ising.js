(function () {
  'use strict';

  var WATCH = ['data-theme'];

  function rgbOf(cssColor) {
    var c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000'; c.fillStyle = cssColor; c.fillRect(0, 0, 1, 1);
    var d = c.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  function loadLevel(url, w, h) {
    if (typeof DecompressionStream === 'function' && typeof Response === 'function')
      return pngBits(url, w, h).catch(function () { return loadLevelImage(url, w, h); });
    return loadLevelImage(url, w, h);
  }
  function urlBytes(url) {
    var m = /^data:[^,]*;base64,/.exec(url);
    if (m) { var bin = atob(url.slice(m[0].length)), b = new Uint8Array(bin.length);
             for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return Promise.resolve(b); }
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (a) { return new Uint8Array(a); });
  }
  function pngBits(url, w, h) {
    return urlBytes(url).then(function (b) {
      var dv = new DataView(b.buffer, b.byteOffset, b.byteLength), p = 8, idat = [], hdr = null;
      while (p + 8 <= b.length) {
        var len = dv.getUint32(p), type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
        if (type === 'IHDR') hdr = [dv.getUint32(p + 8), dv.getUint32(p + 12), b[p + 16], b[p + 17], b[p + 20]];
        else if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
        else if (type === 'IEND') break;
        p += 12 + len;
      }
      if (!hdr || hdr[0] !== w || hdr[1] !== h || hdr[2] !== 1 || hdr[3] !== 0 || hdr[4] !== 0) throw new Error('ising: PNG format');
      var stream = new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Response(stream).arrayBuffer();
    }).then(function (ab) {
      var raw = new Uint8Array(ab), rb = (w + 7) >> 3, out = new Uint8Array(w * h);
      if (raw.length < h * (rb + 1)) throw new Error('ising: PNG data');
      var prev = new Uint8Array(rb), cur = new Uint8Array(rb);
      for (var y = 0; y < h; y++) {
        var o = y * (rb + 1), f = raw[o]; o++;
        for (var i = 0; i < rb; i++) {
          var x = raw[o + i], a = i ? cur[i - 1] : 0, u = prev[i], c = i ? prev[i - 1] : 0, v;
          if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + u; else if (f === 3) v = x + ((a + u) >> 1);
          else if (f === 4) { var q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c);
                              v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c); }
          else throw new Error('ising: PNG filter');
          cur[i] = v & 255;
        }
        for (var xx = 0, r0 = y * w; xx < w; xx++) out[r0 + xx] = (cur[xx >> 3] >> (7 - (xx & 7))) & 1 ? 255 : 0;
        var t = prev; prev = cur; cur = t;
      }
      return out;
    });
  }
  function loadLevelImage(url, w, h) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth !== w || img.naturalHeight !== h) { rej(new Error('ising: level size')); return; }
        var SH = 256, c = document.createElement('canvas'); c.width = w; c.height = SH;
        var x = c.getContext('2d', { willReadFrequently: true }), out = new Uint8Array(w * h);
        for (var y0 = 0; y0 < h; y0 += SH) {
          var sh = Math.min(SH, h - y0);
          x.clearRect(0, 0, w, SH); x.drawImage(img, 0, y0, w, sh, 0, 0, w, sh);
          var d = x.getImageData(0, 0, w, sh).data, o = y0 * w;
          for (var i = 0, n = w * sh; i < n; i++) out[o + i] = d[4 * i] > 127 ? 255 : 0;
        }
        c.width = c.height = 0; img.onload = null; img.src = '';
        res(out);
      };
      img.onerror = function () { rej(new Error('ising: level load')); };
      img.src = url;
    });
  }

  var VS = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  var FS = [
    '#version 300 es',
    'precision highp float; precision highp int;',
    'uniform sampler2D A; uniform sampler2D B;',
    'uniform ivec2 sizeA; uniform ivec2 sizeB;',
    'uniform float bsA; uniform float bsB; uniform vec2 centre; uniform float alpha; uniform uint levB;',
    'uniform vec3 up; uniform vec3 dn; uniform bool torA; uniform bool torB;',
    'out vec4 o;',
    'ivec2 wrap(ivec2 q, ivec2 n){ return q - n * ivec2(floor(vec2(q) / vec2(n))); }',
    'uint hash(uint x, uint y, uint k){ uint h = (x*0x9E3779B1u) ^ (y*0x85EBCA77u) ^ (k*0x27D4EB2Fu);',
    '  h ^= h >> 16; h *= 0x7FEB352Du; h ^= h >> 15; h *= 0x846CA68Bu; h ^= h >> 16; return h; }',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x - centre.x, centre.y - gl_FragCoord.y);',
    '  ivec2 ra = ivec2(floor(p / bsA)) + sizeA / 2, rb = ivec2(floor(p / bsB)) + sizeB / 2;',
    '  bool inA = torA || (all(greaterThanEqual(ra, ivec2(0))) && all(lessThan(ra, sizeA)));',
    '  ivec2 qa = torA ? wrap(ra, sizeA) : clamp(ra, ivec2(0), sizeA - 1);',
    '  ivec2 qb = torB ? wrap(rb, sizeB) : clamp(rb, ivec2(0), sizeB - 1);',
    '  float a = texelFetch(A, qa, 0).r, b = texelFetch(B, qb, 0).r;',
    '  float u = float(hash(uint(qb.x), uint(qb.y), levB) >> 8) * (1.0 / 16777216.0);',
    '  float v = (u < alpha || !inA) ? b : a;',
    '  o = vec4(mix(dn, up, v), 1.0);',
    '}'].join('\n');

  var PVS = ['#version 300 es', 'in uint e; uniform ivec2 size; uniform uint lev; out float val;',
    'void main(){ uint x = e & 4095u, y = (e >> 12) & 4095u; val = float((e >> 24) & 1u); gl_PointSize = 1.0;',
    '  gl_Position = (e >> 25) == lev ? vec4((float(x) + 0.5) / float(size.x) * 2.0 - 1.0, (float(y) + 0.5) / float(size.y) * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0); }'].join('\n');
  var PFS = '#version 300 es\nprecision highp float; in float val; out vec4 o; void main(){ o = vec4(val, 0.0, 0.0, 1.0); }';

  var GVS = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
  var GFS = [
    '#version 300 es',
    'precision highp float; precision highp int; precision highp sampler2D;',
    'uniform sampler2D S; uniform sampler2D P;',
    'uniform ivec2 cs; uniform ivec2 co; uniform ivec2 ct; uniform ivec2 po;',
    'uniform ivec2 sub; uniform uint seed; uniform uint k; uniform float t4; uniform float t8; uniform bool init;',
    'out vec4 o;',
    'uint hsh(uint x){ x ^= x >> 16; x *= 0x7FEB352Du; x ^= x >> 15; x *= 0x846CA68Bu; x ^= x >> 16; return x; }',
    'bool tie(uint gx, uint gy){ uint h = (gx*0x9E3779B1u) ^ (gy*0x85EBCA77u) ^ (k*0xC2B2AE3Du);',
    '  h ^= h >> 16; h *= 0x7FEB352Du; h ^= h >> 15; h *= 0x846CA68Bu; h ^= h >> 16; return (h & 1u) == 1u; }',
    'ivec2 nb(ivec2 g){ return ivec2(g.x < 0 ? g.x + ct.x : (g.x >= ct.x ? g.x - ct.x : g.x), g.y < 0 ? g.y + ct.y : (g.y >= ct.y ? g.y - ct.y : g.y)); }',
    'float par(ivec2 g){ return texelFetch(P, (g >> 1) - po, 0).r > 0.5 ? 1.0 : -1.0; }',
    'float sp(ivec2 g){ ivec2 l = g - co;',
    '  if (all(greaterThanEqual(l, ivec2(0))) && all(lessThan(l, cs))) return texelFetch(S, l, 0).r > 0.5 ? 1.0 : -1.0;',
    '  return par(g); }',
    'void main(){',
    '  ivec2 q = ivec2(gl_FragCoord.xy), g = co + q;',
    '  if (init) { o = vec4(par(g) > 0.0 ? 1.0 : 0.0, 0.0, 0.0, 1.0); return; }',
    '  float si = texelFetch(S, q, 0).r > 0.5 ? 1.0 : -1.0;',
    '  if ((g.x & 1) != sub.x || (g.y & 1) != sub.y) { o = vec4(si > 0.0 ? 1.0 : 0.0, 0.0, 0.0, 1.0); return; }',
    '  float h = sp(nb(g + ivec2(1, 0))) + sp(nb(g - ivec2(1, 0))) + sp(nb(g + ivec2(0, 1))) + sp(nb(g - ivec2(0, 1)));',
    '  float dE = 2.0 * si * h; bool acc = true;',
    '  if (dE > 0.5) { float u = float(hsh(hsh(uint(g.y * ct.x + g.x)) ^ seed) >> 8) * (1.0 / 16777216.0); acc = u < (dE < 5.0 ? t4 : t8); }',
    '  if (acc) { ivec2 b = q & ivec2(-2);',
    '    float s4 = (texelFetch(S, b, 0).r + texelFetch(S, b + ivec2(1, 0), 0).r + texelFetch(S, b + ivec2(0, 1), 0).r',
    '              + texelFetch(S, b + ivec2(1, 1), 0).r) * 2.0 - 4.0 - 2.0 * si;',
    '    float v = s4 > 0.5 ? 1.0 : (s4 < -0.5 ? -1.0 : (tie(uint(g.x >> 1), uint(g.y >> 1)) ? 1.0 : -1.0));',
    '    if (v != par(g)) acc = false; }',
    '  o = vec4((acc ? -si : si) > 0.0 ? 1.0 : 0.0, 0.0, 0.0, 1.0);',
    '}'].join('\n');

  function rootConfig(W, H, seed, sweeps) {
    var B = Math.log(1 + Math.SQRT2) / 2, T4 = Math.floor(Math.exp(-4 * B) * 4294967296) >>> 0, T8 = Math.floor(Math.exp(-8 * B) * 4294967296) >>> 0;
    var a = seed >>> 0 || 1, b = 362436069, c = 521288629, d = 88675123;
    function rnd() { var t = a ^ (a << 11); a = b; b = c; c = d; d = (d ^ (d >>> 19) ^ t ^ (t >>> 8)) >>> 0; return d; }
    for (var i = 0; i < 16; i++) rnd();
    var s = new Int8Array(W * H);
    for (i = 0; i < s.length; i++) s[i] = rnd() & 1 ? 1 : -1;
    for (var n = 0; n < sweeps; n++) for (var p = 0; p < 2; p++) for (var y = 0; y < H; y++) {
      var yu = (y + H - 1) % H, yd = (y + 1) % H;
      for (var x = (y + p) & 1; x < W; x += 2) {
        var j = y * W + x, si = s[j];
        var dE = 2 * si * (s[y * W + (x + W - 1) % W] + s[y * W + (x + 1) % W] + s[yu * W + x] + s[yd * W + x]);
        if (dE <= 0 || rnd() < (dE === 4 ? T4 : T8)) s[j] = -si;
      }
    }
    var out = new Uint8Array(W * H);
    for (i = 0; i < s.length; i++) out[i] = s[i] > 0 ? 255 : 0;
    return out;
  }

  function makeGenerator(gl, FRAMES, TORUS, seed, sweeps) {
    var KMAX = FRAMES.length - 1;
    function lat(j) { return j <= KMAX ? TORUS[j] : [TORUS[KMAX][0] >> (j - KMAX), TORUS[KMAX][1] >> (j - KMAX)]; }
    function frame(j) { return j <= KMAX ? FRAMES[j] : lat(j); }
    function origin(j) { var t = lat(j), f = frame(j); return [(t[0] - f[0]) >> 1, (t[1] - f[1]) >> 1]; }
    var top = KMAX; while (lat(top)[0] > 16 && lat(top)[0] % 2 === 0 && lat(top)[1] % 2 === 0) top++;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, GVS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, GFS));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    var U = {}; ['S', 'P', 'cs', 'co', 'ct', 'po', 'sub', 'seed', 'k', 't4', 't8', 'init'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    var vao = gl.createVertexArray(), B = Math.log(1 + Math.SQRT2) / 2;
    function mk(w, h, data) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      if (data) { gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED, gl.UNSIGNED_BYTE, data); }
      gl.bindTexture(gl.TEXTURE_2D, null);
      var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t: t, f: f, w: w, h: h };
    }
    function del(x) { if (x) { gl.deleteFramebuffer(x.f); gl.deleteTexture(x.t); } }
    function h32(x) { x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846CA68B) >>> 0; x ^= x >>> 16; return x >>> 0; }
    var SUBS = [[0, 0], [1, 1], [1, 0], [0, 1]], pass = 0;
    var L = {};
    var rt = lat(top); L[top] = mk(rt[0], rt[1], rootConfig(rt[0], rt[1], seed, 1000));
    var next = top - 1, cur = null;
    function step(budget) {
      while (next >= 0) {
        var j = next, f = frame(j), o = origin(j), t = lat(j), po = origin(j + 1), cost = f[0] * f[1], fresh = !cur;
        if (fresh) cur = { j: j, A: mk(f[0], f[1]), B: mk(f[0], f[1]), left: 4 * sweeps };
        gl.useProgram(pr); gl.bindVertexArray(vao); gl.disable(gl.BLEND); gl.viewport(0, 0, f[0], f[1]);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L[j + 1].t);
        gl.uniform1i(U.S, 0); gl.uniform1i(U.P, 1);
        gl.uniform2i(U.cs, f[0], f[1]); gl.uniform2i(U.co, o[0], o[1]); gl.uniform2i(U.ct, t[0], t[1]); gl.uniform2i(U.po, po[0], po[1]);
        gl.uniform1ui(U.k, j + 1); gl.uniform1f(U.t4, Math.exp(-4 * B)); gl.uniform1f(U.t8, Math.exp(-8 * B));
        if (fresh) {
          gl.uniform1i(U.init, 1); gl.bindFramebuffer(gl.FRAMEBUFFER, cur.A.f);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
          gl.drawArrays(gl.TRIANGLES, 0, 3); budget -= cost;
        }
        gl.uniform1i(U.init, 0);
        while (cur.left > 0 && budget > 0) {
          var i = (4 * sweeps - cur.left) & 3;
          gl.uniform2i(U.sub, SUBS[i][0], SUBS[i][1]); gl.uniform1ui(U.seed, h32(Math.imul(seed, 7919) + Math.imul(++pass, 0x9E3779B9)));
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.A.t);
          gl.bindFramebuffer(gl.FRAMEBUFFER, cur.B.f); gl.drawArrays(gl.TRIANGLES, 0, 3);
          var tmp = cur.A; cur.A = cur.B; cur.B = tmp; cur.left--; budget -= cost;
        }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
        if (cur.left > 0) return true;
        del(cur.B); L[j] = cur.A; cur = null; next--;
        if (budget <= 0) break;
      }
      return next >= 0;
    }
    function read(j) {
      var x = L[j], W = x.w, H = x.h, out = new Uint8Array(W * H), rows = Math.max(1, Math.min(H, (1 << 19) / W | 0)), buf = new Uint8Array(W * rows * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.f);
      for (var y = 0; y < H; y += rows) {
        var n = Math.min(rows, H - y), v = n === rows ? buf : buf.subarray(0, W * n * 4);
        gl.readPixels(0, y, W, n, gl.RGBA, gl.UNSIGNED_BYTE, v);
        for (var i = 0, m = W * n, b = y * W; i < m; i++) out[b + i] = v[4 * i] > 127 ? 255 : 0;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return out;
    }
    function dispose(keep) { if (cur) { del(cur.A); del(cur.B); cur = null; } for (var j in L) if (!(keep && keep(+j))) { del(L[j]); delete L[j]; } gl.deleteProgram(pr); gl.deleteVertexArray(vao); }
    return { top: top, lat: lat, frame: frame, level: function (j) { return L[j]; }, next: function () { return next; },
             step: step, read: read, dispose: dispose };
  }

  function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }


  function mount(canvas, opts) {
    opts = opts || {};
    var meta = opts.data || {}, urls = meta.levels;
    if (!urls) { console.error('ising: no level data'); return; }
    var FRAMES = meta.frames, TORUS = meta.torus, KMAX = FRAMES.length - 1;
    var blockPx = opts.blockPx || 1;
    var zmax = Math.max(0, Math.min(KMAX, opts.zmax != null ? opts.zmax : KMAX, urls.length - 1));
    var nlev = zmax + 1;
    var fade = opts.fade != null ? opts.fade : 0.6;
    var targetRate = opts.rate != null ? opts.rate : 15;
    var rate = targetRate;
    var liveMaxZoom = opts.liveMaxZoom != null ? opts.liveMaxZoom : Infinity;
    var maxLoad = opts.maxLoad != null ? opts.maxLoad : 0.25;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)');
    var freezeOnReduce = opts.reducedMotion === 'freeze';
    var reducedZ = Math.min(zmax, opts.reducedZ != null ? opts.reducedZ : (opts.zoomIn ? zmax : 0));
    var workerSrc = opts.worker;
    var wantLive = targetRate > 0 && typeof Worker !== 'undefined' && !!(workerSrc || opts.workerUrl);

    var allowSoftware = opts.softwareGL === 'allow', stillReason = null;
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false,
                                           failIfMajorPerformanceCaveat: !allowSoftware });
    if (!gl) stillReason = 'no hardware WebGL2';
    else {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      if (!allowSoftware && /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer)) stillReason = 'software renderer: ' + renderer;
      else if (FRAMES.slice(0, zmax + 1).some(function (f) { return f[0] > gl.getParameter(gl.MAX_TEXTURE_SIZE) || f[1] > gl.getParameter(gl.MAX_TEXTURE_SIZE); }))
        stillReason = 'MAX_TEXTURE_SIZE too small';
    }
    if (stillReason) {
      if (gl) { var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
      var c2 = canvas.cloneNode(false); canvas.parentNode.replaceChild(c2, canvas); canvas = c2; gl = null;
    }
    var live = { active: null, source: null, msFixed: null, msPerSweep: null };
    var levels = null, ready = false, tex = [], fbo = [], prog, pprog, vaoMain, vaoPts, ptsBuf, U = {}, PU = {}, colours;
    var z = 0, visible = true, pending = false;
    var worker = null, workerBusy = false, lastTick = 0, lastSend = 0, owed = 0, win = null, looping = false;
    var MIN_INTERVAL = 1000 / 30, interval = MIN_INTERVAL;

    function readColours() {
      var cs = getComputedStyle(canvas);
      var up = rgbOf(cs.getPropertyValue('--spin-up').trim() || '#000'),
          dn = rgbOf(cs.getPropertyValue('--spin-down').trim() || '#fff');
      colours = opts.flip ? [dn, up] : [up, dn];
    }

    function zoomFromScroll() {
      if (freezeOnReduce && reduce.matches) return reducedZ;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (typeof opts.scrollEnd === 'function') max = Math.min(max, opts.scrollEnd());
      var f = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      return (opts.zoomIn ? 1 - f : f) * zmax;
    }

    function cssBlock() {
      return blockPx / (window.devicePixelRatio || 1);
    }
    function isTorus(k) { return FRAMES[k][0] === TORUS[k][0] && FRAMES[k][1] === TORUS[k][1]; }

    function initGL(adopt) {
      function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
      function link(vs, fs) { var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); return pr; }
      if (prog) { finishLevels(adopt); return; }
      prog = link(VS, FS); pprog = link(PVS, PFS);
      ['A', 'B', 'sizeA', 'sizeB', 'bsA', 'bsB', 'centre', 'alpha', 'levB', 'up', 'dn', 'torA', 'torB'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      ['size', 'lev'].forEach(function (n) { PU[n] = gl.getUniformLocation(pprog, n); });
      vaoMain = gl.createVertexArray(); gl.bindVertexArray(vaoMain);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      vaoPts = gl.createVertexArray(); gl.bindVertexArray(vaoPts);
      ptsBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ptsBuf);
      var ploc = gl.getAttribLocation(pprog, 'e'); gl.enableVertexAttribArray(ploc); gl.vertexAttribIPointer(ploc, 1, gl.UNSIGNED_INT, 0, 0);
      gl.bindVertexArray(null);
      finishLevels(adopt);
    }
    function finishLevels(adopt) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (adopt) { tex = adopt.tex; fbo = adopt.fbo; }
      else tex = levels.map(function (d, k) {
        var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, FRAMES[k][0], FRAMES[k][1]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FRAMES[k][0], FRAMES[k][1], gl.RED, gl.UNSIGNED_BYTE, d);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        fbo[k] = f;
        return t;
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog); gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1);
      if (!adopt) ready = true;
    }
    function drawPoints(list) {
      if (!list.length || gl.isContextLost()) return;
      gl.useProgram(pprog); gl.bindVertexArray(vaoPts);
      gl.bindBuffer(gl.ARRAY_BUFFER, ptsBuf); gl.bufferData(gl.ARRAY_BUFFER, list, gl.STREAM_DRAW);
      for (var k = 0; k < tex.length; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[k]); gl.viewport(0, 0, FRAMES[k][0], FRAMES[k][1]);
        gl.uniform2i(PU.size, FRAMES[k][0], FRAMES[k][1]); gl.uniform1ui(PU.lev, k);
        gl.drawArrays(gl.POINTS, 0, list.length);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null); gl.useProgram(prog);
    }

    function renderGL() {
      pending = false;
      if (gl.isContextLost()) return;
      if (!ready) { if (reveal) renderReveal(); return; }
      var dpr = window.devicePixelRatio || 1;
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      z = zoomFromScroll();
      var k = zmax === 0 ? 0 : Math.min(Math.floor(z), zmax - 1), f = zmax === 0 ? 0 : z - k;
      var c = cssBlock() * dpr;
      var kb = Math.min(k + 1, nlev - 1);
      var alpha = fade > 0 ? smooth((f - (1 - fade) / 2) / fade) : (f >= 0.5 ? 1 : 0);
      if (worker && live.active != null && k < live.active) { kb = Math.min(live.active, nlev - 1); alpha = 1; }
      requestLevel();
      gl.viewport(0, 0, w, h); gl.useProgram(prog); gl.bindVertexArray(vaoMain);
      gl.uniform1i(U.torA, isTorus(k)); gl.uniform1i(U.torB, isTorus(kb));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[k]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[kb]);
      gl.uniform2i(U.sizeA, FRAMES[k][0], FRAMES[k][1]); gl.uniform2i(U.sizeB, FRAMES[kb][0], FRAMES[kb][1]);
      gl.uniform1f(U.bsA, c * Math.pow(2, k - z)); gl.uniform1f(U.bsB, c * Math.pow(2, kb - z));
      gl.uniform2f(U.centre, w / 2, h / 2); gl.uniform1f(U.alpha, alpha); gl.uniform1ui(U.levB, kb);
      gl.uniform3fv(U.up, colours[0]); gl.uniform3fv(U.dn, colours[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add('ising-on');
    }

    var reveal = null;
    function renderReveal() {
      var dpr = window.devicePixelRatio || 1;
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      z = zoomFromScroll();
      var j = reveal.j, L = reveal.gen.level(j), f = reveal.gen.frame(j), t = reveal.gen.lat(j), tor = f[0] === t[0] && f[1] === t[1];
      var c = cssBlock() * dpr;
      gl.viewport(0, 0, w, h); gl.useProgram(prog); gl.bindVertexArray(vaoMain);
      gl.uniform1i(U.torA, tor); gl.uniform1i(U.torB, tor);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, L.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.t);
      gl.uniform2i(U.sizeA, f[0], f[1]); gl.uniform2i(U.sizeB, f[0], f[1]);
      gl.uniform1f(U.bsA, c * Math.pow(2, j - z)); gl.uniform1f(U.bsB, c * Math.pow(2, j - z));
      gl.uniform2f(U.centre, w / 2, h / 2); gl.uniform1f(U.alpha, 0); gl.uniform1ui(U.levB, j);
      gl.uniform3fv(U.up, colours[0]); gl.uniform3fv(U.dn, colours[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add('ising-on');
    }

    var stillData = null, mips = null, mipImgs = null;
    function tieBit(k, gx, gy) {
      var h = (Math.imul(gx, 0x9E3779B1) ^ Math.imul(gy, 0x85EBCA77) ^ Math.imul(k, 0xC2B2AE3D | 0)) >>> 0;
      h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846CA68B) >>> 0; h ^= h >>> 16;
      return h & 1;
    }
    function buildMips() {
      var w = FRAMES[0][0], h = FRAMES[0][1], ox = (TORUS[0][0] - w) >> 1, oy = (TORUS[0][1] - h) >> 1, d = stillData;
      mips = [{ w: w, h: h, d: d }];
      for (var k = 1; k <= zmax && (w >> 1) >= 64 && (h >> 1) >= 64; k++) {
        var nw = w >> 1, nh = h >> 1, nd = new Uint8Array(nw * nh), gx0 = ox >> k, gy0 = oy >> k;
        for (var y = 0; y < nh; y++) for (var x = 0; x < nw; x++) {
          var i = 2 * y * w + 2 * x, S = (d[i] ? 1 : -1) + (d[i + 1] ? 1 : -1) + (d[i + w] ? 1 : -1) + (d[i + w + 1] ? 1 : -1);
          nd[y * nw + x] = (S > 0 || (S === 0 && tieBit(k, gx0 + x, gy0 + y))) ? 255 : 0;
        }
        mips.push({ w: nw, h: nh, d: nd }); w = nw; h = nh; d = nd;
      }
    }
    function buildStill() {
      var up = colours[0].map(function (v) { return Math.round(v * 255); }), dn = colours[1].map(function (v) { return Math.round(v * 255); });
      mipImgs = mips.map(function (m) {
        var t = document.createElement('canvas'); t.width = m.w; t.height = m.h;
        var x = t.getContext('2d'), img = x.createImageData(m.w, m.h), p = img.data, d = m.d;
        for (var i = 0; i < d.length; i++) { var col = d[i] ? up : dn; p[4 * i] = col[0]; p[4 * i + 1] = col[1]; p[4 * i + 2] = col[2]; p[4 * i + 3] = 255; }
        x.putImageData(img, 0, 0); return t;
      });
    }
    function renderStill() {
      pending = false;
      if (!mipImgs) return;
      var ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var zs = Math.max(0, Math.min(mips.length - 1, Math.log2(Math.min(mips[0].w * blockPx / w, mips[0].h * blockPx / h))));
      z = zoomFromScroll();
      var zz = zmax > 0 ? z / zmax * zs : 0;
      var k = Math.min(mips.length - 1, Math.ceil(zz - 1e-9)), sc = blockPx * Math.pow(2, k - zz);
      var m = mips[k], iw = m.w * sc, ih = m.h * sc;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mipImgs[k], w / 2 - iw / 2, h / 2 - ih / 2, iw, ih);
      canvas.classList.add('ising-on');
    }

    var render = gl ? renderGL : renderStill;
    function request() { if (!pending) { pending = true; requestAnimationFrame(function () { render(); kick(); }); } }

    function sizeFor(scale) {
      var c = cssBlock();
      return [Math.ceil(canvas.clientWidth * scale / c / 64 + 1) * 64, Math.ceil(canvas.clientHeight * scale / c / 64 + 1) * 64];
    }
    function liveWindow() {
      var a = activeLevel(), smax = Math.pow(2, (1 + fade) / 2);
      return { max: sizeFor(smax), live: sizeFor(Math.min(smax, Math.pow(2, z - a))) };
    }
    function activeLevel() {
      if (zmax === 0) return 0;
      var k = Math.min(Math.floor(z), zmax - 1), f = z - k;
      return f >= (1 + fade) / 2 ? k + 1 : k;
    }
    function liveAllowed() {
      return worker && !reduce.matches && visible && focused && !document.hidden && z <= liveMaxZoom && rate > 0;
    }
    function startWorker() {
      var url = opts.workerUrl;
      var blobUrl = null;
      if (!url) url = blobUrl = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }));
      try { worker = new Worker(url); } catch (e) { worker = null; }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (!worker) return;
      win = liveWindow();
      var lv = levels; levels = null;
      worker.postMessage({ type: 'init', levels: lv, frames: FRAMES.slice(0, nlev), torus: TORUS.slice(0, nlev),
                           size: win.live, max: win.max, active: activeLevel(), seed: (Math.random() * 4294967296) >>> 0 },
                         lv.map(function (d) { return d.buffer; }));
      worker.onerror = function () { worker = null; };
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'ready') { live.active = m.active; return; }
        if (m.type !== 'tick' && m.type !== 'active') return;
        live.active = m.active;
        if (m.type === 'active' && m.done && switching) { switching = false; workerBusy = false; }
        if (m.type === 'tick') workerBusy = false;
        if (m.type === 'tick' && m.sweeps > 0) {
          var ema = function (o, v) { return o == null ? v : 0.8 * o + 0.2 * v; };
          live.msFixed = ema(live.msFixed, m.msPatch);
          live.msPerSweep = ema(live.msPerSweep, m.ms / m.sweeps);
          interval = Math.max(MIN_INTERVAL, live.msFixed / (0.5 * maxLoad));
          rate = Math.max(0.05, Math.min(targetRate, (1000 * maxLoad - 1000 * live.msFixed / interval) / live.msPerSweep));
        }
        if (gl && !gl.isContextLost()) {
          if (m.changed) drawPoints(m.changed);
          for (var i = 0; i < m.patches.length; i++) {
            var p = m.patches[i];
            if (p.k >= tex.length) continue;
            gl.bindTexture(gl.TEXTURE_2D, tex[p.k]);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, p.x, p.y, p.w, p.h, gl.RED, gl.UNSIGNED_BYTE, p.data);
          }
        }
        request();
      };
    }
    function liveLoop(t) {
      if (!liveAllowed()) { looping = false; owed = 0; return; }
      requestAnimationFrame(liveLoop);
      var dt = Math.min(250, t - lastTick); lastTick = t;
      owed = Math.min(owed + dt * rate / 1000, 2);
      if (!workerBusy && owed > 0 && t - lastSend >= interval) {
        workerBusy = true; lastSend = t;
        win = liveWindow();
        worker.postMessage({ type: 'tick', sweeps: owed, level: activeLevel(), size: win.live, max: win.max });
        owed = 0;
      }
    }
    var switching = false;
    function requestLevel() {
      if (!worker || workerBusy || reduce.matches || document.hidden) return;
      var want = activeLevel();
      if (live.active != null && want !== live.active) {
        workerBusy = switching = true; win = liveWindow();
        worker.postMessage({ type: 'active', level: want, size: win.live, max: win.max });
      }
    }
    function kick() {
      if (looping || !liveAllowed()) return;
      looping = true; lastTick = performance.now(); requestAnimationFrame(liveLoop);
    }

    function onTheme() { readColours(); if (mips) buildStill(); request(); }
    function onScroll() { focused = true; request(); kick(); }

    function loadAll() {
      var out = [];
      return urls.slice(0, nlev).reduce(function (pr, u, k) {
        return pr.then(function () { return loadLevel(u, FRAMES[k][0], FRAMES[k][1]).then(function (d) { out.push(d); }); });
      }, Promise.resolve()).then(function () { return out; });
    }
    var revealMs = opts.revealMs != null ? opts.revealMs : 120;
    var GEN_BUDGET = opts.genBudget || (1 << 25);
    function generate() {
      var gen;
      try { gen = makeGenerator(gl, FRAMES, TORUS, (Math.random() * 4294967296) >>> 0, opts.genSweeps || 6); }
      catch (e) { console.warn('ising: generation unavailable, using the stored sample', e); return startStored(); }
      var still = reduce.matches && freezeOnReduce;
      reveal = { gen: gen, j: gen.top, shown: 0 };
      live.source = 'generated';
      var readBack = null, readK = 0;
      function frame(t) {
        if (gl.isContextLost()) return;
        if (gen.next() >= 0) gen.step(GEN_BUDGET);
        var need = Math.max(0, Math.min(nlev - 1, Math.floor(zoomFromScroll())));
        if (!still && reveal.j > need && gen.next() < reveal.j - 1 && t - reveal.shown >= revealMs) { reveal.j--; reveal.shown = t; }
        if (!still && reveal.shown === 0) reveal.shown = t;
        if (!still) renderReveal();
        if (gen.next() >= 0 || (!still && reveal.j > need)) { requestAnimationFrame(frame); return; }
        if (readBack === null) {
          readBack = wantLive && !reduce.matches ? [] : false;
          if (gl.getError() !== gl.NO_ERROR) { console.warn('ising: GL error during generation, using the stored sample'); gen.dispose(); reveal = null; return startStored(); }
        }
        if (readBack && readK < nlev) { readBack.push(gen.read(readK++)); requestAnimationFrame(frame); return; }
        var adopt = { tex: [], fbo: [] };
        for (var k = 0; k < nlev; k++) { adopt.tex.push(gen.level(k).t); adopt.fbo.push(gen.level(k).f); }
        gen.dispose(function (j) { return j < nlev; });
        reveal = null;
        initGL(adopt); ready = true;
        if (readBack) { levels = readBack; startWorker(); kick(); }
        request();
      }
      requestAnimationFrame(frame);
    }
    function startStored() {
      live.source = 'stored';
      loadAll()
        .then(function (ls) {
          levels = ls;
          initGL();
          if (wantLive && !reduce.matches) { startWorker(); kick(); }
          request();
        })
        .catch(function (e) { console.error(e); });
    }
    readColours();
    if (gl) {
      if (opts.generate) { try { initGL({ tex: [], fbo: [] }); generate(); } catch (e) { console.warn(e); startStored(); } }
      else startStored();
    } else {
      loadLevel(urls[0], FRAMES[0][0], FRAMES[0][1])
        .then(function (d) { stillData = d; buildMips(); buildStill(); request(); })
        .catch(function (e) { console.error(e); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      request();
      if (worker) { win = liveWindow(); worker.postMessage({ type: 'size', size: win.live, max: win.max }); }
    });
    document.addEventListener('visibilitychange', kick);
    var focused = true;
    window.addEventListener('blur', function () { focused = false; });
    function refocus() { if (!focused) { focused = true; kick(); } }
    window.addEventListener('focus', refocus);
    window.addEventListener('pointermove', refocus, { passive: true });
    reduce.addEventListener('change', function () {
      if (gl && ready && wantLive && !worker && !reduce.matches) {
        if (!levels && live.source === 'generated') levels = tex.map(function (t, k) { return readLevel(k); });
        if (levels) startWorker();
      }
      request(); kick();
    });
    function readLevel(k) {
      var W = FRAMES[k][0], H = FRAMES[k][1], out = new Uint8Array(W * H), buf = new Uint8Array(W * 4 * 128);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[k]);
      for (var y = 0; y < H; y += 128) { gl.readPixels(0, y, W, 128, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (var i = 0; i < W * 128; i++) out[y * W + i] = buf[4 * i] > 127 ? 255 : 0; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return out;
    }
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; kick(); }).observe(canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: WATCH });
    if (gl) {
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
      canvas.addEventListener('webglcontextrestored', function () {
        if (worker) { worker.terminate(); worker = null; }
        ready = false; live.active = null; workerBusy = switching = false;
        reveal = null; prog = null; ready = false;
        if (opts.generate) { initGL({ tex: [], fbo: [] }); generate(); }
        else loadAll().then(function (ls) { levels = ls; initGL(); if (wantLive && !reduce.matches) { startWorker(); kick(); } request(); });
      });
    }
  }

  window.IsingZoom = { mount: mount };
})();
