function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextId(prefix, existing) {
  let i = 1;
  while (existing.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function showLoadManager({ project, commit }) {
  const draft = {
    loadCases: clone(project.loadCases || []),
    loadCombinations: clone(project.loadCombinations || []),
    loads: clone(project.loads || []),
    elementLoads: clone(project.elementLoads || []),
    settings: clone(project.settings || {})
  };

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  document.body.appendChild(wrap);

  function renderModal() {
    const cases = draft.loadCases;
    const combinations = draft.loadCombinations;
    const activeCase = draft.settings.activeLoadCaseId || cases[0]?.id;
    const existingCases = new Set(cases.map(c => c.id));

    wrap.innerHTML = `<div class="modal loads-modal">
      <div class="row"><div><h2>Casos de ação e combinações</h2><div class="hint">As alterações são preparadas aqui e gravadas no modelo somente ao clicar em Aplicar.</div></div><span class="spacer"></span><button class="btn" id="cancel-load-manager">Cancelar</button><button class="btn primary" id="apply-load-manager">Aplicar</button></div>
      <div class="warning">Fatores são definidos pelo usuário. Não constituem combinações normativas oficiais. Packs ABNT NBR, ACI, Eurocodes e fib serão versionados e rastreáveis.</div>
      <div class="loads-layout">
        <section><div class="row section-heading"><h3>Casos de carregamento</h3><span class="spacer"></span><button class="btn small" id="add-case">+ Caso</button></div>
          <table class="table load-table"><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Cargas</th><th></th></tr></thead><tbody>
          ${cases.map(c => {
            const count = draft.loads.filter(l => (l.caseId || cases[0]?.id) === c.id).length + draft.elementLoads.filter(l => (l.caseId || cases[0]?.id) === c.id).length;
            return `<tr><td><code>${c.id}</code></td><td><input class="table-input case-name" data-case="${c.id}" value="${escapeHtml(c.name)}"></td><td><select class="table-input case-type" data-case="${c.id}"><option value="user" ${c.type==='user'?'selected':''}>Usuário</option><option value="permanent" ${c.type==='permanent'?'selected':''}>Permanente</option><option value="variable" ${c.type==='variable'?'selected':''}>Variável</option><option value="wind" ${c.type==='wind'?'selected':''}>Vento</option><option value="thermal" ${c.type==='thermal'?'selected':''}>Térmica</option><option value="other" ${c.type==='other'?'selected':''}>Outra</option></select></td><td>${count}</td><td><div class="row compact"><button class="btn small ${activeCase===c.id?'primary':''}" data-edit-case="${c.id}">${activeCase===c.id?'Editando':'Editar'}</button><button class="btn small danger" data-delete-case="${c.id}" ${cases.length<=1?'disabled':''}>×</button></div></td></tr>`;
          }).join('')}
          </tbody></table>
        </section>
        <section><div class="row section-heading"><h3>Combinações customizadas</h3><span class="spacer"></span><button class="btn small" id="add-combination">+ Combinação</button></div>
          ${combinations.length ? combinations.map(combo => `<div class="combination-card"><div class="row"><code>${combo.id}</code><input class="table-input combo-name" data-combo="${combo.id}" value="${escapeHtml(combo.name)}"><span class="spacer"></span><button class="btn small danger" data-delete-combo="${combo.id}">Excluir</button></div><div class="factor-grid">${cases.map(c => {
            const term = (combo.terms || []).find(t => t.caseId === c.id);
            return `<label><span>${escapeHtml(c.name)}</span><input class="combo-factor" data-combo="${combo.id}" data-case="${c.id}" type="number" step="0.05" value="${term?.factor ?? 0}"></label>`;
          }).join('')}</div></div>`).join('') : '<div class="hint">Nenhuma combinação criada.</div>'}
        </section>
      </div>
    </div>`;

    wrap.querySelector('#cancel-load-manager').onclick = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
    wrap.querySelector('#apply-load-manager').onclick = () => {
      commit(() => {
        project.loadCases = clone(draft.loadCases);
        project.loadCombinations = clone(draft.loadCombinations);
        project.loads = clone(draft.loads);
        project.elementLoads = clone(draft.elementLoads);
        project.settings.activeLoadCaseId = draft.settings.activeLoadCaseId;
        project.settings.analysisScenarioId = draft.settings.analysisScenarioId;
      });
      wrap.remove();
    };

    wrap.querySelector('#add-case').onclick = () => {
      const id = nextId('LC', existingCases);
      draft.loadCases.push({ id, name: `Caso ${draft.loadCases.length + 1}`, type: 'user' });
      for (const combo of draft.loadCombinations) combo.terms = [...(combo.terms || []), { caseId: id, factor: 0 }];
      draft.settings.activeLoadCaseId = id;
      draft.settings.analysisScenarioId = id;
      renderModal();
    };

    wrap.querySelector('#add-combination').onclick = () => {
      const existing = new Set(combinations.map(c => c.id));
      const id = nextId('COMB', existing);
      draft.loadCombinations.push({ id, name: `Combinação customizada ${draft.loadCombinations.length + 1}`, type: 'custom', terms: cases.map((c, i) => ({ caseId: c.id, factor: i === 0 ? 1 : 0 })) });
      draft.settings.analysisScenarioId = id;
      renderModal();
    };

    wrap.querySelectorAll('.case-name').forEach(input => input.oninput = () => {
      const c = draft.loadCases.find(x => x.id === input.dataset.case);
      c.name = input.value;
    });
    wrap.querySelectorAll('.case-type').forEach(input => input.onchange = () => {
      draft.loadCases.find(x => x.id === input.dataset.case).type = input.value;
    });
    wrap.querySelectorAll('[data-edit-case]').forEach(btn => btn.onclick = () => {
      draft.settings.activeLoadCaseId = btn.dataset.editCase;
      renderModal();
    });
    wrap.querySelectorAll('[data-delete-case]').forEach(btn => btn.onclick = () => {
      if (draft.loadCases.length <= 1) return;
      const id = btn.dataset.deleteCase;
      const c = draft.loadCases.find(x => x.id === id);
      if (!confirm(`Excluir o caso “${c?.name || id}” e suas cargas?`)) return;
      draft.loadCases = draft.loadCases.filter(x => x.id !== id);
      draft.loads = draft.loads.filter(l => l.caseId !== id);
      draft.elementLoads = draft.elementLoads.filter(l => l.caseId !== id);
      draft.loadCombinations = draft.loadCombinations.map(combo => ({ ...combo, terms: (combo.terms || []).filter(t => t.caseId !== id) }));
      const fallback = draft.loadCases[0]?.id;
      if (draft.settings.activeLoadCaseId === id) draft.settings.activeLoadCaseId = fallback;
      if (draft.settings.analysisScenarioId === id) draft.settings.analysisScenarioId = fallback;
      renderModal();
    });

    wrap.querySelectorAll('.combo-name').forEach(input => input.oninput = () => {
      draft.loadCombinations.find(x => x.id === input.dataset.combo).name = input.value;
    });
    wrap.querySelectorAll('.combo-factor').forEach(input => input.oninput = () => {
      const combo = draft.loadCombinations.find(x => x.id === input.dataset.combo);
      const caseId = input.dataset.case;
      let term = (combo.terms || []).find(t => t.caseId === caseId);
      if (!term) { term = { caseId, factor: 0 }; combo.terms = [...(combo.terms || []), term]; }
      term.factor = Number(input.value) || 0;
    });
    wrap.querySelectorAll('[data-delete-combo]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.deleteCombo;
      draft.loadCombinations = draft.loadCombinations.filter(x => x.id !== id);
      if (draft.settings.analysisScenarioId === id) draft.settings.analysisScenarioId = draft.settings.activeLoadCaseId || draft.loadCases[0]?.id;
      renderModal();
    });
  }

  renderModal();
}
