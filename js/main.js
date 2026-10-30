IsingZoom.mount(document.getElementById('rg'), {
  data: {
    frames: [[2048, 4096], [2048, 4096], [2048, 4096], [1024, 2048]],
    torus: [[8192, 16384], [4096, 8192], [2048, 4096], [1024, 2048]],
    levels: ['ising/l0.png', 'ising/l1.png', 'ising/l2.png', 'ising/l3.png']
  },
  workerUrl: 'js/ising-worker.js',
  zoomIn: true, zmax: 3, rate: 1, reducedMotion: 'freeze', generate: true
});

(function () {
  var root = document.documentElement, el = document.querySelector('.morph'), m = Morph.mount(el);
  var contactSeen = false, hovering = false;
  var settle = function (animate) { m.set(contactSeen ? 'email' : (hovering ? 'name' : 'url'), animate); };

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function start() {
    if (!reduce) { m.set('name', false); setTimeout(function () { settle(true); }, 1500); }
    else settle(false);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);

  el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hovering = true; settle(true); } });
  el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hovering = false; settle(true); } });
  el.addEventListener('click', function (e) {
    if (m.state === 'email') { location.href = 'mailto:' + m.text('email'); return; }
    if (e.pointerType !== 'mouse') { hovering = !hovering; settle(true); }
  });
  el.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && m.state === 'email') { e.preventDefault(); location.href = 'mailto:' + m.text('email'); }
  });

  new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var now = en.isIntersecting && window.scrollY > 40;
      if (now !== contactSeen) {
        contactSeen = now;
        el.tabIndex = now ? 0 : -1;
        el.setAttribute('role', now ? 'link' : 'presentation');
        if (now) { el.removeAttribute('aria-hidden'); el.setAttribute('aria-label', m.text('email')); }
        else { el.setAttribute('aria-hidden', 'true'); el.removeAttribute('aria-label'); }
        settle(true);
      }
    });
  }, { rootMargin: '0px 0px -40% 0px' }).observe(document.getElementById('contact'));

  document.querySelector('.pointer').addEventListener('click', function () {
    if (m.state === 'email') location.href = 'mailto:' + m.text('email');
  });

  addEventListener('resize', function () { m.rerender(); });
  if (document.fonts) document.fonts.addEventListener('loadingdone', function () { m.rerender(); });
  new MutationObserver(function () {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { hovering = false; settle(false); m.rerender(); });
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
