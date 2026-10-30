const fs = require('fs');
const [, , inFile, outFile, katexPath, selDir, selOut] = process.argv;
const path = require('path');
const katex = require(katexPath ? path.resolve(katexPath) : 'katex');
const ALL = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const P = ALL.filter(p => !(p.type || []).includes('thesis'));
const ME = 'Erramilli';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstLast = a => { const i = a.indexOf(', '); return i < 0 ? a : a.slice(i + 2) + ' ' + a.slice(0, i); };
function title(t) {
  return t.split(/(\$[^$]+\$)/).map(seg =>
    seg.startsWith('$') && seg.endsWith('$') && seg.length > 2
      ? katex.renderToString(seg.slice(1, -1), { output: 'mathml', throwOnError: false })
      : esc(seg)).join('');
}
const link = p => p.arxiv ? `https://arxiv.org/abs/${p.arxiv}`
  : p.doi ? `https://doi.org/${p.doi}` : `https://inspirehep.net/literature/${p.inspire_id}`;

const items = P.map(p => {
  const authors = p.authors.map(a => {
    const n = firstLast(a);
    return `<span class="au${a.includes(ME) ? ' me' : ''}">${esc(n)}</span>`;
  }).join('<span class="sep">, </span>');
  const j = p.journal || {};
  const ref = [];
  if (j.journal_title) ref.push(`<span>${esc(j.journal_title)}</span>` +
    (j.journal_volume ? ` <span>${esc(j.journal_volume)}</span>` : '') +
    (j.year ? ` <span class="sep">(</span><span>${esc(j.year)}</span><span class="sep">)</span>` : '') +
    (j.artid || j.page_start ? ` <span>${esc(j.artid || j.page_start)}</span>` : ''));
  if (p.arxiv) ref.push(`<a class="ax" href="https://arxiv.org/abs/${esc(p.arxiv)}">${esc(p.arxiv)}</a>`);
  return `<li class="paper">
  <span class="pyear">${esc((p.date || '').slice(0, 4))}</span>
  <div class="pbody">
    <a class="ptitle" href="${esc(link(p))}" data-raw="${esc(p.title)}">${title(p.title)}</a>
    <div class="pauthors">${authors}</div>
    ${ref.length ? `<div class="pref">${ref.join('<span class="sep"> · </span>')}</div>` : ''}
  </div>
</li>`;
});
fs.writeFileSync(outFile, items.join('\n') + '\n');
console.log(items.length, 'papers ->', outFile, '(theses left out:', ALL.length - P.length + ')');

if (selDir && selOut) {
  const files = fs.existsSync(selDir) ? fs.readdirSync(selDir) : [];
  const isBlurb = f => f.endsWith('.txt') && !f.endsWith('.title.txt') && !f.endsWith('.note.txt');
  const blurbs = files.filter(isBlurb).map(f => f.slice(0, -4));
  const wip = blurbs.filter(b => b.startsWith('wip-')).sort();
  const released = blurbs.filter(b => !b.startsWith('wip-')).sort().reverse();
  const read = f => fs.readFileSync(path.join(selDir, f), 'utf8').trim();
  const blurb = name => { const t = read(name + '.txt'); return t ? `\n  <p class="selblurb">${esc(t)}</p>` : ''; };
  const figFor = name => {
    const fig = files.find(f => f.startsWith(name + '.') && /\.(png|jpe?g|webp)$/i.test(f));
    return fig ? `<img src="data:image/${path.extname(fig).slice(1).replace('jpg', 'jpeg')};base64,${fs.readFileSync(path.join(selDir, fig)).toString('base64')}" alt="">`
               : '<div class="selfig"></div>';
  };
  const wipHtml = wip.map(name => {
    if (!files.includes(name + '.title.txt')) throw new Error(name + '.txt has no ' + name + '.title.txt');
    const note = files.includes(name + '.note.txt') ? `<span class="selnote">${esc(read(name + '.note.txt'))}</span>` : '';
    return `<li class="sel wip">${figFor(name)}<div class="selbody">
  <span class="ptitle wiptitle">${esc(read(name + '.title.txt'))}</span>${note}${blurb(name)}
</div></li>`;
  });
  const html = wipHtml.concat(released.map(ax => {
    const p = ALL.find(q => q.arxiv === ax);
    if (!p) throw new Error('selected paper ' + ax + ' is not in the INSPIRE data');
    return `<li class="sel">${figFor(ax)}<div class="selbody">
  <a class="ptitle" href="${esc(link(p))}" data-raw="${esc(p.title)}">${title(p.title)}</a>${blurb(ax)}
</div></li>`;
  })).join('\n');
  fs.writeFileSync(selOut, html + '\n');
  console.log(blurbs.length, 'selected papers ->', selOut);
}
