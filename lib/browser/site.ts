// The site a URL belongs to (its registrable domain), shared by the safety layer and the
// destination check.

/** Two-label public suffixes this build knows (a pragmatic subset of the public suffix list). */
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'co.jp', 'ne.jp', 'or.jp',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.cn', 'com.mx', 'co.nz', 'co.za', 'com.sg', 'com.tr', 'co.kr',
  'github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'web.app', 'herokuapp.com', 'blogspot.com', 'appspot.com',
]);

/** The site a URL belongs to (its registrable domain): `mail.google.com` → `google.com`. */
export function siteKey(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[')) return host; // localhost, IPs
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  if (labels.length > 2 && TWO_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}
