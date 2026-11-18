/** Resolve a Markdown link against the document being read, never the browser route. */
export function localDocumentLink(sourcePath, href, product = true) {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  try {
    const base = new URL(sourcePath, 'https://ronin.local/');
    const target = new URL(href, base);
    const file = decodeURIComponent(target.pathname.slice(1));
    if ((product && !file.startsWith('docs/')) || !/\.md$/i.test(file) || target.search) return null;
    return { path: file, fragment: decodeURIComponent(target.hash.slice(1)) };
  } catch { return null; }
}

/** A shipped guide may point at repository files that the docs-only API cannot read. */
export function productRepositoryHref(sourcePath, href) {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  try {
    const target = new URL(href, new URL(sourcePath, 'https://ronin.local/'));
    const file = target.pathname.slice(1);
    if (!file || (/^docs\/.*\.md$/i.test(file) && !target.search)) return null;
    return `https://github.com/ronincowork/ronin-cowork/blob/master/${file}${target.search}${target.hash}`;
  } catch { return null; }
}

/**
 * A LINK TO A FILE ON THE RONIN BOX, in any form an Agent writes one: /abs, ~/…, file:///…,
 * relative to where it works, each maybe ending :line or :line:col (the file opens; the line is
 * dropped). Its path, or null for a web link, a mail link or an anchor, which keep the browser.
 */
export function fileLinkPath(href) {
  let p = String(href || '').trim().replace(/(?::\d+){1,2}$|#L\d+(?:-L?\d+)?$/, '');
  if (/^file:\/\//i.test(p)) p = p.replace(/^file:\/\/(?:localhost)?/i, '');
  else if (!p || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(p)) return null;
  try { p = decodeURI(p); } catch { /* written as is */ }
  return p.replace(/[?#].*$/, '') || null;
}
