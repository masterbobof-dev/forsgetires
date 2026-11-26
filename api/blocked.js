// Answer for SEO-analysis robots (Ahrefs, Semrush, ...; see "has" in vercel.json):
// they bring no buyers but open thousands of pages and overload the shop database.
// No database is touched here. Search engines (Google, Bing) never get this answer.
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(403).send('Crawling of this site by SEO-analysis robots is not allowed. See /robots.txt');
}
