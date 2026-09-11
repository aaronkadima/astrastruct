(() => {
  'use strict';

  // Guard legacy UI observers without subclassing the native DOM constructor.
  // Some mobile Chromium/WebView builds do not behave reliably when MutationObserver
  // is subclassed. This wrapper composes the native observer, filters mutations that
  // are known to be self-generated, and coalesces callbacks to one animation frame.
  const NativeMutationObserver = window.MutationObserver;
  if (NativeMutationObserver && !window.__ASTRA_MUTATION_GUARD__) {
    class AstraMutationObserver {
      constructor(callback) {
        this.callback = callback;
        this.pending = [];
        this.frame = 0;
        this.native = new NativeMutationObserver((records) => {
          const meaningful = records.filter((record) => {
            const target = record.target?.nodeType === 1
              ? record.target
              : record.target?.parentElement;
            if (!target) return true;
            if (target.closest?.('.brand small, .mode-pill')) return false;
            if (target.closest?.('#advanced-load-overlay, #connection-overlay')) return false;
            if (target.closest?.('#mobile-dock, #mobile-command-sheet')) return false;
            return true;
          });
          if (!meaningful.length) return;
          this.pending.push(...meaningful);
          if (this.frame) return;
          this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            const batch = this.pending.splice(0);
            try { this.callback(batch, this); }
            catch (err) { setTimeout(() => { throw err; }, 0); }
          });
        });
      }
      observe(target, options) { this.native.observe(target, options); }
      disconnect() {
        this.native.disconnect();
        this.pending.length = 0;
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      takeRecords() { return this.native.takeRecords(); }
    }
    window.MutationObserver = AstraMutationObserver;
    window.__ASTRA_MUTATION_GUARD__ = true;
  }

  let lastError = '';
  const rememberError = value => {
    if (!value) return;
    lastError = value instanceof Error
      ? `${value.name}: ${value.message}`
      : String(value);
    console.error('[AstraStruct bootstrap]', value);
  };

  window.addEventListener('error', event => rememberError(event.error || event.message));
  window.addEventListener('unhandledrejection', event => rememberError(event.reason));

  const esc = value => String(value ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  const recoveryMarkup = detail => `
    <main style="position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#0b1020;color:#e8eef8;font-family:Inter,system-ui,Arial,sans-serif;padding:20px">
      <section style="width:min(720px,100%);max-height:92vh;overflow:auto;background:#111827;border:1px solid #334155;border-radius:14px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.35)">
        <div style="font-size:22px;font-weight:800;margin-bottom:8px">AstraStruct</div>
        <h1 style="font-size:18px;margin:0 0 10px">Falha ao inicializar a interface</h1>
        <p style="color:#aebbd0;line-height:1.55">O projeto salvo não foi apagado. A falha ocorreu na camada de interface, não no arquivo do modelo.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#0a0f1a;border:1px solid #263449;border-radius:8px;padding:12px;color:#f6c177;font-size:12px">${esc(detail)}</pre>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button id="astra-retry" style="min-height:44px;padding:9px 14px;border-radius:8px;border:1px solid #4b82c3;background:#1f5f9c;color:white;cursor:pointer">Recarregar</button>
          <button id="astra-safe" style="min-height:44px;padding:9px 14px;border-radius:8px;border:1px solid #475569;background:#172033;color:#e8eef8;cursor:pointer">Abrir modelo limpo</button>
        </div>
        <p style="font-size:12px;color:#7f8da3;margin:14px 0 0">Antes de abrir o modelo limpo, o JSON atual é copiado para <code>astrastruct.project.recovery</code>.</p>
      </section>
    </main>`;

  const wireRecovery = host => {
    host.querySelector('#astra-retry')?.addEventListener('click', () => location.reload());
    host.querySelector('#astra-safe')?.addEventListener('click', () => {
      const raw = localStorage.getItem('astrastruct.project');
      if (raw) localStorage.setItem('astrastruct.project.recovery', raw);
      localStorage.removeItem('astrastruct.project');
      location.reload();
    });
  };

  const showRecovery = () => {
    const host = document.getElementById('app');
    if (!host) return;
    const app = document.querySelector('.app');
    const top = document.querySelector('.topbar');
    const workspace = document.querySelector('.workspace');
    const svg = document.querySelector('#model-svg');

    let detail = lastError;
    if (!app) detail ||= 'A aplicação não criou o shell principal (.app).';
    else {
      const tr = top?.getBoundingClientRect();
      const wr = workspace?.getBoundingClientRect();
      const sr = svg?.getBoundingClientRect();
      const badLayout = !top || !workspace || !svg || !tr || !wr || !sr ||
        tr.width < 20 || tr.height < 20 || wr.width < 20 || wr.height < 20 || sr.width < 20 || sr.height < 20;
      if (!badLayout && !lastError) return;
      detail ||= `Layout inválido: topbar=${Math.round(tr?.width||0)}×${Math.round(tr?.height||0)}, workspace=${Math.round(wr?.width||0)}×${Math.round(wr?.height||0)}, canvas=${Math.round(sr?.width||0)}×${Math.round(sr?.height||0)}.`;
    }

    host.insertAdjacentHTML('beforeend', recoveryMarkup(detail || 'Falha desconhecida de inicialização.'));
    wireRecovery(host);
  };

  // If the application renders correctly this does nothing. If the shell exists but
  // collapses to a zero-size layout, it now shows a visible diagnostic instead of a
  // seemingly endless black screen.
  window.setTimeout(showRecovery, 4500);
})();
