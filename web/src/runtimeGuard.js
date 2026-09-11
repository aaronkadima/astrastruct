(() => {
  'use strict';

  const NativeMutationObserver = window.MutationObserver;
  if (NativeMutationObserver && !window.__ASTRA_MUTATION_GUARD__) {
    class AstraMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        super((records, observer) => {
          const meaningful = records.filter(record => {
            const target = record.target?.nodeType === 1
              ? record.target
              : record.target?.parentElement;
            // Several legacy UI injectors update only the version labels on every
            // callback. textContent itself creates a childList mutation and used to
            // feed the same observers forever. Version-label-only mutations are not
            // structural changes and must not re-trigger injectors.
            return !target?.closest?.('.brand small, .mode-pill');
          });
          if (meaningful.length) callback(meaningful, observer);
        });
      }
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

  const showRecovery = () => {
    if (document.querySelector('.app')) return;
    const host = document.getElementById('app');
    if (!host) return;
    const detail = lastError || 'A interface não concluiu a inicialização dentro do tempo esperado.';
    host.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e8eef8;font-family:Inter,system-ui,Arial,sans-serif;padding:24px">
        <section style="width:min(720px,100%);background:#111827;border:1px solid #334155;border-radius:14px;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.35)">
          <div style="font-size:22px;font-weight:800;margin-bottom:8px">AstraStruct</div>
          <h1 style="font-size:18px;margin:0 0 10px">Falha ao inicializar a interface</h1>
          <p style="color:#aebbd0;line-height:1.55">O modelo salvo não foi apagado. Você pode tentar recarregar ou iniciar uma sessão limpa mantendo uma cópia local de recuperação.</p>
          <pre style="white-space:pre-wrap;word-break:break-word;background:#0a0f1a;border:1px solid #263449;border-radius:8px;padding:12px;color:#f6c177;font-size:12px">${detail.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button id="astra-retry" style="padding:9px 14px;border-radius:8px;border:1px solid #4b82c3;background:#1f5f9c;color:white;cursor:pointer">Recarregar</button>
            <button id="astra-safe" style="padding:9px 14px;border-radius:8px;border:1px solid #475569;background:#172033;color:#e8eef8;cursor:pointer">Iniciar modo seguro</button>
          </div>
          <p style="font-size:12px;color:#7f8da3;margin:14px 0 0">Modo seguro preserva o JSON atual em <code>astrastruct.project.recovery</code> antes de abrir o modelo demonstrativo.</p>
        </section>
      </main>`;
    document.getElementById('astra-retry')?.addEventListener('click', () => location.reload());
    document.getElementById('astra-safe')?.addEventListener('click', () => {
      const raw = localStorage.getItem('astrastruct.project');
      if (raw) localStorage.setItem('astrastruct.project.recovery', raw);
      localStorage.removeItem('astrastruct.project');
      location.reload();
    });
  };

  window.setTimeout(showRecovery, 4000);
})();
