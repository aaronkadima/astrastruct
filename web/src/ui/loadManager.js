function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function nextId(prefix, existing) {
  let i = 1;
  while (existing.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function showLoadManager({ project, commit }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  document.body.appendChild(wrap);

  function renderModal() {
    const cases = project.loadCases || [];
    const combinations = project.loadCombinations || [];
    const activeCase = project.settings.activeLoadCaseId || cases[0]?.id;
    const existingCases = new Set(cases.map(c => c.id));

    wrap.innerHTML = `<div class="modal loads-modal">
      <div class="row"><div><h2>Casos de ação e combinações</h2><div class="hint">Gerenciamento linear de cenários. Fatores abaixo são definidos pelo usuário e não constituem combinações normativas oficiais.</div></div><span class="spacer"></span><button class="btn" id="close-load-manager">Fechar</button></div>
      <div class="warning">ABNT NBR, ACI, Eurocodes e fib serão implementados posteriormente como rule packs versionados, com edição e cláusula rastreáveis.</div>
      <div class="loads-layout">
        <section><div class="row section-heading"><h3>Casos de carregamento</h3><span class="spacer"></span><button class="btn small" id="add-case">+ Caso</button></div>
          <table class="table load-table"><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Cargas</th><th></th></tr></thead><tbody>
          ${cases.map(c => {
            const count = (project.loads || []).filter(l => (l.caseId || cases[0]?.id) === c.id).length + (project.elementLoads || []).filter(l => (l.caseId || cases[0]?.id) === c.id).length;
            return `<tr data-case-row="${c.id}"><td><code>${c.id}</code></td><td><input class="table-input case-name" data-case="${c.id}" value="${escapeHtml(c.name)}"></td><td><select class="table-input case-type" data-case="${c.id}"><option value="user" ${c.type==='user'?'selected':''}>Usuário</option><option value="permanent" ${c.type==='permanent'?'selected':''}>Permanente</option><option value="variable" ${c.type==='variable'?'selected':''}>Variável</option><option value="wind" ${c.type==='wind'?'selected':''}>Vento</option><option value="thermal" ${c.type==='thermal'?'selected':''}>Térmica</option><option value="other" ${c.type==='other'?'selected':''}>Outra</option></select></td><td>${count}</td><td><div class="row compact"><button class="btn small ${activeCase===c.id?'primary':''}" data-edit-case="${c.id}">${activeCase===c.id?'Editando':'Editar'}</button><button class="btn small danger" data-delete-case="${c.id}" ${cases.length<=1?'disabled':''}>×</button></div></td></tr>`;
          }).join('')}
          </tbody></table>
        </section>
        <section><div class="row section-heading"><h3>Combinações customizadas</h3><span class="spacer"></span><button class="btn small" id="add-combination">+ Combinação</button></div>
          ${combinations.length ? combinations.map(combo => `<div class="combination-card" data-combo="${combo.id}"><div class="row"><code>${combo.id}</code><input class="table-input combo-name" data-combo="${combo.id}" value="${escapeHtml(combo.name)}"><span class="spacer"></span><button class="btn small danger" data-delete-combo="${combo.id}">Excluir</button></div><div class="factor-grid">${cases.map(c => {
            const term = (combo.terms || []).find(t => t.caseId === c.id);
            return `<label><span>${escapeHtml(c.name)}</span><input class="combo-factor" data-combo="${combo.id}" data-case="${c.id}" type="number" step="0.05" value="${term?.factor ?? 0}"></label>`;
          }).join('')}</div></div>`).join('') : '<div class="hint">Nenhuma combinação criada.</div>'}
        </section>
      </div>
    </div>`;

    wrap.querySelector('#close-load-manager').onclick = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };

    wrap.querySelector('#add-case').onclick = () => {
      const id = nextId('LC', existingCases);
      commit(() => {
        project.loadCases.push({ id, name: `Caso ${project.loadCases.length + 1}`, type: 'user' });
        for (const combo of project.loadCombinations || []) combo.terms = [...(combo.terms || []), { caseId: id, factor: 0 }];
        project.settings.activeLoadCaseId = id;
        project.settings.analysisScenarioId = id;
      });
      renderModal();
    };

    wrap.querySelector('#add-combination').onclick = () => {
      const existing = new Set(combinations.map(c => c.id));
      const id = nextId('COMB', existing);
      commit(() => {
        project.loadCombinations.push({ id, name: `Combinação customizada ${project.loadCombinations.length + 1}`, type: 'custom', terms: cases.map((c, i) => ({ caseId: c.id, factor: i === 0 ? 1 : 0 })) });
        project.settings.analysisScenarioId = id;
      });
      renderModal();
    };

    wrap.querySelectorAll('.case-name').forEach(input => input.onchange = () => {
      const c = project.loadCases.find(x => x.id === input.dataset.case);
      commit(() => { c.name = input.value.trim() || c.id; });
    });
    wrap.querySelectorAll('.case-type').forEach(input => input.onchange = () => {
      const c = project.loadCases.find(x => x.id === input.dataset.case);
      commit(() => { c.type = input.value; });
    });
    wrap.querySelectorAll('[data-edit-case]').forEach(btn => btn.onclick = () => {
      commit(() => { project.settings.activeLoadCaseId = btn.dataset.editCase; });
      renderModal();
    });
    wrap.querySelectorAll('[data-delete-case]').forEach(btn => btn.onclick = () => {
      if (project.loadCases.length <= 1) return;
      const id = btn.dataset.deleteCase;
      const c = project.loadCases.find(x => x.id === id);
      if (!confirm(`Excluir o caso “${c?.name || id}” e suas cargas?`)) return;
      commit(() => {
        project.loadCases = project.loadCases.filter(x => x.id !== id);
        project.loads = project.loads.filter(l => l.caseId !== id);
        project.elementLoads = project.elementLoads.filter(l => l.caseId !== id);
        project.loadCombinations = project.loadCombinations.map(combo => ({ ...combo, terms: (combo.terms || []).filter(t => t.caseId !== id) }));
        const fallback = project.loadCases[0]?.id;
        if (project.settings.activeLoadCaseId === id) project.settings.activeLoadCaseId = fallback;
        if (project.settings.analysisScenarioId === id) project.settings.analysisScenarioId = fallback;
      });
      renderModal();
    });

    wrap.querySelectorAll('.combo-name').forEach(input => input.onchange = () => {
      const c = project.loadCombinations.find(x => x.id === input.dataset.combo);
      commit(() => { c.name = input.value.trim() || c.id; });
    });
    wrap.querySelectorAll('.combo-factor').forEach(input => input.onchange = () => {
      const combo = project.loadCombinations.find(x => x.id === input.dataset.combo);
      const caseId = input.dataset.case;
      const factor = Number(input.value) || 0;
      commit(() => {
        let term = (combo.terms || []).find(t => t.caseId === caseId);
        if (!term) { term = { caseId, factor: 0 }; combo.terms = [...(combo.terms || []), term]; }
        term.factor = factor;
      });
    });
    wrap.querySelectorAll('[data-delete-combo]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.deleteCombo;
      commit(() => {
        project.loadCombinations = project.loadCombinations.filter(x => x.id !== id);
        if (project.settings.analysisScenarioId === id) project.settings.analysisScenarioId = project.settings.activeLoadCaseId || project.loadCases[0]?.id;
      });
      renderModal();
    });
  }

  renderModal();
}
