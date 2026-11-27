/* Seven-segment readout, drawn as SVG in currentColor with ghost segments (class "off", filled by .lcd .off in site.css).
   ALVLCD.seg('67')       -> '<svg ...>' for the characters 0-9, '.', and ' ' (blank digit)
   ALVLCD.fmt(85.1, 4)    -> ' 85.1'  one decimal, left-padded with blanks to `width` digits (the dot does not count)
   ALVLCD.fmt(177, 3, 0)  -> '177'    third argument = decimals (default 1) */
window.ALVLCD = (function () {
  const S = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };
  const H = y => `8,${y} 12,${y - 4} 48,${y - 4} 52,${y} 48,${y + 4} 12,${y + 4}`;
  const V = (x, a, b) => `${x},${a} ${x + 4},${a + 4} ${x + 4},${b - 4} ${x},${b} ${x - 4},${b - 4} ${x - 4},${a + 4}`;
  const P = { a: H(5), g: H(50), d: H(95), f: V(5, 8, 47), b: V(55, 8, 47), e: V(5, 53, 92), c: V(55, 53, 92) };
  function seg(str) {
    let x = 0, out = '';
    for (const ch of String(str)) {
      if (ch === '.') { out += `<circle cx="${x - 2}" cy="94" r="5" fill="currentColor"/>`; x += 8; continue; }
      const on = S[ch] || '';
      out += `<g transform="translate(${x} 0) skewX(-6)">` + Object.keys(P).map(k => `<polygon points="${P[k]}" ${on.includes(k) ? 'fill="currentColor"' : 'class="off"'}/>`).join('') + '</g>';
      x += 68;
    }
    return `<svg viewBox="-4 -2 ${x} 104" aria-hidden="true">${out}</svg>`;
  }
  function fmt(n, width, dec) {
    let s = Number(n).toFixed(dec == null ? 1 : dec);
    while (s.replace('.', '').length < width) s = ' ' + s;
    return s;
  }
  return { seg, fmt };
})();
