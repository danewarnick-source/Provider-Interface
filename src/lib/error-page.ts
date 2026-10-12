import { DENIM, DENIM_FONTS } from "./design-tokens";

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Preview is warming up — Provider Interface</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${DENIM.deep}" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; height: 100%; }
      body {
        font: 15px/1.55 ${DENIM_FONTS.body};
        background: ${DENIM.bg};
        color: ${DENIM.text};
        display: grid;
        place-items: center;
        padding: 1.5rem 1rem;
      }
      .card {
        max-width: 34rem;
        width: 100%;
        background: ${DENIM.paper};
        border-radius: 20px;
        box-shadow: 0 24px 60px -30px rgba(27, 51, 80, 0.35), 0 1px 2px rgba(27, 51, 80, 0.06);
        overflow: hidden;
      }
      .band {
        background: ${DENIM.deep};
        color: #fff;
        padding: 1.25rem 1.75rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-family: ${DENIM_FONTS.heading};
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px; height: 28px;
      }
      .band small {
        margin-left: auto;
        font-family: ${DENIM_FONTS.body};
        font-weight: 600;
        color: ${DENIM.ondarkp};
        font-size: 12px;
      }
      .body { padding: 1.75rem; }
      h1 {
        font-family: ${DENIM_FONTS.heading};
        font-weight: 700;
        font-size: 1.45rem;
        line-height: 1.25;
        margin: 0 0 0.5rem;
        letter-spacing: -0.025em;
        color: ${DENIM.deep};
      }
      p { color: ${DENIM.text}; margin: 0 0 1rem; }
      ul {
        margin: 0; padding: 0; list-style: none;
        background: ${DENIM.pt0};
        border: 1px solid ${DENIM.line};
        border-radius: 14px;
        padding: 0.85rem 1rem;
        font-size: 13.5px;
        color: ${DENIM.text};
      }
      li { padding: 0.2rem 0 0.2rem 1.2rem; position: relative; }
      li::before {
        content: ""; position: absolute; left: 0; top: 0.7em;
        width: 6px; height: 6px; border-radius: 999px; background: ${DENIM.acc};
      }
      .actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.5rem; align-items: center; }
      a, button {
        appearance: none;
        font: inherit;
        cursor: pointer;
        padding: 0.65rem 1.25rem;
        border-radius: 999px;
        border: 1px solid transparent;
        text-decoration: none;
        font-weight: 600;
        transition: transform 0.05s ease, background 0.15s ease, box-shadow 0.15s ease;
      }
      .primary {
        background: ${DENIM.pri}; color: #fff;
        box-shadow: 0 8px 18px -10px rgba(27, 51, 80, 0.35);
      }
      .primary:hover { background: ${DENIM.deep}; }
      .secondary { background: ${DENIM.paper}; color: ${DENIM.pri}; border-color: ${DENIM.line}; }
      .secondary:hover { background: ${DENIM.pt0}; }
      button:active, a:active { transform: translateY(1px); }
      a:focus-visible, button:focus-visible { outline: 2px solid ${DENIM.pri}; outline-offset: 2px; }
      .status {
        margin-left: auto;
        font-size: 12.5px;
        color: ${DENIM.muted};
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 1em;
      }
      .spinner {
        width: 12px; height: 12px;
        border: 2px solid ${DENIM.pt2};
        border-top-color: ${DENIM.pri};
        border-radius: 999px;
        animation: spin 0.8s linear infinite;
        display: none;
      }
      .status.loading .spinner { display: inline-block; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .foot {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid ${DENIM.line};
        font-size: 12.5px;
        color: ${DENIM.muted};
      }
      .foot a { color: ${DENIM.pri}; padding: 0; border: 0; background: transparent; font-weight: 600; }
      .foot a:hover { text-decoration: underline; }
      @media (max-width: 480px) {
        .body { padding: 1.35rem; }
        .band { padding: 1.1rem 1.35rem; }
        .actions { flex-direction: column; align-items: stretch; }
        .status { margin-left: 0; justify-content: center; }
        .primary, .secondary { width: 100%; text-align: center; }
      }
    </style>
  </head>
  <body>
    <main class="card" role="alert" aria-live="polite">
      <div class="band">
        <span class="logo" aria-hidden="true"><svg viewBox="0 0 36 36" width="28" height="28" fill="none"><defs><linearGradient id="pi-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${DENIM.pri}"/><stop offset="1" stop-color="${DENIM.deep}"/></linearGradient><linearGradient id="pi-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${DENIM.accl}"/><stop offset="1" stop-color="${DENIM.acc}"/></linearGradient></defs><rect width="36" height="36" rx="9" fill="url(#pi-t)" stroke="${DENIM.ondark}" stroke-opacity=".25"/><g transform="translate(18 18.6) scale(.62) translate(-18 -18.5)" fill="url(#pi-b)"><rect x="4" y="5" width="28" height="5" rx=".8"/><rect x="9" y="10" width="5" height="22" rx=".8"/><rect x="22" y="10" width="5" height="22" rx=".8"/></g></svg></span>
        <span>Provider Interface preview</span>
        <small>Status: warming up</small>
      </div>
      <div class="body">
        <h1>Hang tight — the preview is warming up</h1>
        <p>The latest build is still deploying, or it ran into an error before the page could render. This usually clears itself within a few seconds.</p>
        <ul>
          <li>A recent change may still be building</li>
          <li>The preview server may be cold-starting</li>
          <li>The last build may have failed — try again, then check the build log</li>
        </ul>
        <div class="actions">
          <button class="primary" id="retry" type="button">Try again</button>
          <a class="secondary" href="/">Go to home</a>
          <span class="status" id="status"><span class="spinner" aria-hidden="true"></span><span id="status-text"></span></span>
        </div>
        <div class="foot">
          Still stuck after a minute? Reload the editor and rebuild, or contact your admin.
        </div>
      </div>
    </main>
    <script>
      (function () {
        var GUARD = 'hive-error-page:autoreloaded';
        var btn = document.getElementById('retry');
        var status = document.getElementById('status');
        var statusText = document.getElementById('status-text');
        function setStatus(text, loading) {
          statusText.textContent = text || '';
          status.classList.toggle('loading', !!loading);
        }
        if (btn) btn.addEventListener('click', function () {
          setStatus('Reloading…', true);
          location.reload();
        });
        try {
          var already = sessionStorage.getItem(GUARD);
          if (!already) {
            sessionStorage.setItem(GUARD, String(Date.now()));
            var seconds = 4;
            setStatus('Retrying in ' + seconds + 's…', true);
            var tick = setInterval(function () {
              seconds -= 1;
              if (seconds <= 0) { clearInterval(tick); location.reload(); return; }
              setStatus('Retrying in ' + seconds + 's…', true);
            }, 1000);
          } else {
            sessionStorage.removeItem(GUARD);
            setStatus('Auto-retry already tried — use Try again.', false);
          }
        } catch (_) { /* sessionStorage unavailable — manual retry only */ }
      })();
    </script>
  </body>
</html>`;
}
