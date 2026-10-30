(function () {
  'use strict';

  var LIGS = ['<=<', '>=>', '>>=', '=<<', '<$>', '<*>', '<|>', '<->', '===', '!==', '...',
              '->', '<-', '=>', '<=', '>=', '::', '/=', '==', '!=', '++', '|>', '<|', '&&', '||',
              '<>', '..', '//', '**', '>>', '<<', '\\\\'];

  function tokens(s) {
    var out = [], i = 0;
    while (i < s.length) {
      var t = s[i];
      for (var k = 0; k < LIGS.length; k++) if (s.substr(i, LIGS[k].length) === LIGS[k]) { t = LIGS[k]; break; }
      out.push(t); i += t.length;
    }
    return out;
  }

  function derivedEmail(url) {
    return url.replace(/^\/+|\/+$/g, '').replace('.', '@');
  }

  function align(a, b) {
    var A = a.map(function (t) { return t.toLowerCase(); }), B = b.map(function (t) { return t.toLowerCase(); });
    var n = A.length, m = B.length, i, j, dp = [];
    for (i = 0; i <= n; i++) dp.push(new Int16Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var pairs = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { pairs.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return pairs;
  }

  function mount(el) {
    var texts = { url: el.dataset.url, name: el.dataset.name.toLowerCase() };
    texts.email = derivedEmail(texts.url);
    var state = null, layer = document.createElement('span');
    layer.className = 'morph-layer';
    el.appendChild(layer);

    function measure(toks, st) {
      var row = document.createElement('span');
      row.className = 'morph-measure st-' + st;
      toks.forEach(function (t) { var c = document.createElement('span'); c.className = 'g'; c.textContent = t; row.appendChild(c); });
      el.appendChild(row);
      var xs = [].map.call(row.children, function (c) { return c.offsetLeft; }), w = row.offsetWidth;
      el.removeChild(row);
      return { xs: xs, w: w };
    }

    function glyph(t, x, st) {
      var g = document.createElement('span');
      g.className = 'g st-' + st; g.textContent = t;
      g.style.transform = 'translate(' + x + 'px, 0)';
      layer.appendChild(g);
      return g;
    }

    function render(st) {
      var tk = tokens(texts[st]), M = measure(tk, st);
      layer.textContent = '';
      tk.forEach(function (t, k) { glyph(t, M.xs[k], st); });
      el.style.width = M.w + 'px';
      state = st; el.dataset.state = st;
      layer.offsetWidth;
      el.classList.add('settled');
    }

    function set(to, animate) {
      if (to === state) return;
      clearTimeout(el._t);
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!animate || reduce || state === null) { render(to); return; }
      var a = tokens(texts[state]), b = tokens(texts[to]), Ma = measure(a, state), Mb = measure(b, to);
      var drift = state === 'email' || to === 'email', up = drift ? '-0.45em' : '0', down = drift ? '0.7em' : '0';
      var pairs = align(a, b), inA = {}, inB = {};
      pairs.forEach(function (p) { inA[p[0]] = p[1]; inB[p[1]] = p[0]; });
      el.classList.remove('settled');
      layer.textContent = '';
      el.style.width = Math.max(Ma.w, Mb.w) + 'px';
      var moves = [];
      a.forEach(function (t, i) {
        if (i in inA) return;
        var g = glyph(t, Ma.xs[i], state), x = Ma.xs[i];
        moves.push(function () { g.style.transitionDelay = '0ms'; g.style.transform = 'translate(' + x + 'px, ' + up + ')'; g.style.opacity = '0'; });
      });
      pairs.forEach(function (p) {
        var ca = a[p[0]], cb = b[p[1]], xa = Ma.xs[p[0]], xb = Mb.xs[p[1]];
        var g = glyph(cb, xa, state), ghost = ca !== cb ? glyph(ca, xa, state) : null;
        if (ghost) g.style.opacity = '0';
        moves.push(function () {
          g.className = 'g st-' + to; g.style.transitionDelay = '120ms';
          g.style.transform = 'translate(' + xb + 'px, 0)'; g.style.opacity = '1';
          if (ghost) { ghost.className = 'g st-' + to; ghost.style.transitionDelay = '120ms';
            ghost.style.transform = 'translate(' + xb + 'px, 0)'; ghost.style.opacity = '0'; }
        });
      });
      b.forEach(function (t, j) {
        if (j in inB) return;
        var x = Mb.xs[j], g = glyph(t, x, to);
        g.style.transform = 'translate(' + x + 'px, ' + down + ')'; g.style.opacity = '0';
        moves.push(function () { g.style.transitionDelay = '380ms'; g.style.transform = 'translate(' + x + 'px, 0)'; g.style.opacity = '1'; });
      });
      state = to; el.dataset.state = to;
      layer.offsetWidth;
      moves.forEach(function (f) { f(); });
      clearTimeout(el._t);
      el._t = setTimeout(function () { render(to); }, 1040);
    }

    el.morph = { set: set, get state() { return state; }, text: function (st) { return texts[st]; },
                 rerender: function () { if (state) render(state); } };
    return el.morph;
  }

  window.Morph = { mount: mount };
})();
