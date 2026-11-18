// Wspólne przygotowanie testów: atrapa Supabase zamiast prawdziwej biblioteki z CDN.
// Strona ma sprawdzanie integralności (SRI) biblioteki, które celowo blokuje podmienione pliki,
// więc w testach usuwamy atrybut integrity z HTML (tylko w testach, aplikacja zostaje bez zmian).
const fs = require('fs'), path = require('path');
const fake = fs.readFileSync(path.join(__dirname, 'fake-supabase.js'), 'utf8');
module.exports = async function stub(t) {
  await t.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript', body: fake }));
  await t.route(u => u.port === '8765' && (u.pathname.endsWith('/') || u.pathname.endsWith('/index.html')), async r => {
    const res = await r.fetch();
    const body = (await res.text()).replace(/ integrity="[^"]*"/g, '');
    await r.fulfill({ response: res, body });
  });
};
