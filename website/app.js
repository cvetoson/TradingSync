// Consent-gated, cookieless analytics (Cloudflare Web Analytics).
// The token is filled in after the Cloudflare setup; empty token = no analytics at all.
var CF_ANALYTICS_TOKEN = '4c8c7ab0b7ce465e9316f2dd62602b27';

(function () {
  var KEY = '8sync_consent';
  var banner = document.getElementById('cookie-banner');
  function loadAnalytics() {
    if (!CF_ANALYTICS_TOKEN) return;
    var s = document.createElement('script');
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.defer = true;
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_ANALYTICS_TOKEN }));
    document.body.appendChild(s);
  }
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (choice === 'all') { loadAnalytics(); return; }
  if (choice === 'necessary') return;
  if (!banner || !CF_ANALYTICS_TOKEN) return; // nothing to consent to yet
  banner.style.display = 'block';
  document.getElementById('cookie-accept').onclick = function () {
    try { localStorage.setItem(KEY, 'all'); } catch (e) {}
    banner.style.display = 'none'; loadAnalytics();
  };
  document.getElementById('cookie-necessary').onclick = function () {
    try { localStorage.setItem(KEY, 'necessary'); } catch (e) {}
    banner.style.display = 'none';
  };
})();
