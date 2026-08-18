/* =========================================================
   assessments.js
   Assessment configuration: name, description, CO mapping,
   rubric builder with 100-point validation.
   ========================================================= */

let openAssessmentId = null; // which assessment is expanded for editing
let draftRubrics = null;     // working copy of rubrics while editing an assessment

function rubricTotal(rubrics) {
  return rubrics.reduce((sum, r) => sum + (parseFloat(r.max) || 0), 0);
}

function renderAssessmentsPage(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Assessment Tools (${NUM_ASSESSMENTS})</div>
          <div class="card-desc">Configure each tool's name, mapped Course Outcome, and rubric. A rubric must total exactly 100 before marks can be entered.</div>
        </div>
      </div>
      <div class="assessment-card-grid" id="assessmentGrid"></div>
    </div>
    <div id="assessmentEditorHolder"></div>
  `;
  renderAssessmentGrid();
  if (openAssessmentId) renderAssessmentEditor();
}

function renderAssessmentGrid() {
  const grid = document.getElementById('assessmentGrid');
  if (!grid) return;
  grid.innerHTML = STATE.assessments.map((a, idx) => {
    const total = rubricTotal(a.rubrics);
    const valid = a.rubrics.length > 0 && total === 100;
    return `
      <div class="assessment-mini-card" data-open="${a.id}">
        <div class="amc-top">
          <div>
            <div class="text-faint text-sm">Tool ${idx + 1}</div>
            <div class="amc-name">${escapeHtml(a.name)}</div>
          </div>
          ${a.co ? `<span class="badge badge-pass">${a.co}</span>` : `<span class="badge badge-pending">No CO</span>`}
        </div>
        <ul class="amc-list">
          <li><span>Rubric criteria</span><span>${a.rubrics.length}</span></li>
          <li><span>Rubric total</span><span>${total} / 100</span></li>
        </ul>
        ${valid
          ? `<span class="badge badge-ok">Rubric 100/100 ✓</span>`
          : `<span class="badge badge-bad">${a.rubrics.length === 0 ? 'No rubric yet' : 'Rubric ' + total + '/100 ✕'}</span>`}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => {
      openAssessmentId = el.getAttribute('data-open');
      const a = STATE.assessments.find(x => x.id === openAssessmentId);
      draftRubrics = JSON.parse(JSON.stringify(a.rubrics));
      renderAssessmentEditor();
      document.getElementById('assessmentEditorHolder').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function renderAssessmentEditor() {
  const holder = document.getElementById('assessmentEditorHolder');
  const a = STATE.assessments.find(x => x.id === openAssessmentId);
  if (!a) { holder.innerHTML = ''; return; }

  const total = rubricTotal(draftRubrics);
  let bannerClass = 'validation-warn', bannerText = `Rubric total: ${total} / 100 — add rubric criteria to reach 100.`;
  if (draftRubrics.length > 0) {
    if (total === 100) { bannerClass = 'validation-ok'; bannerText = 'Rubric Total: 100 / 100 ✓'; }
    else if (total > 100) { bannerClass = 'validation-bad'; bannerText = `Rubric total exceeds 100. (Currently ${total})`; }
    else { bannerClass = 'validation-bad'; bannerText = `Rubric total must equal exactly 100. (Currently ${total})`; }
  }

  holder.innerHTML = `
    <div class="card mt-16">
      <div class="card-header">
        <div class="card-title">Edit Assessment</div>
        <button class="btn btn-ghost btn-sm" id="closeEditorBtn">Close</button>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="asmtName">Assessment Name</label>
          <input type="text" id="asmtName" value="${escapeHtml(a.name)}">
        </div>
        <div class="field">
          <label for="asmtCo">Mapped Course Outcome</label>
          <select id="asmtCo">
            <option value="">— Select CO —</option>
            ${CO_LIST.map(co => `<option value="${co}" ${a.co === co ? 'selected' : ''}>${co}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="asmtDesc">Assessment Description</label>
        <textarea id="asmtDesc" placeholder="Briefly describe this assessment tool...">${escapeHtml(a.description)}</textarea>
      </div>

      <div class="section-divider"></div>

      <div class="flex-between mb-12">
        <div class="card-title" style="font-size:14.5px;">Rubric Builder</div>
        <button class="btn btn-secondary btn-sm" id="addRubricBtn">+ Add Rubric Criterion</button>
      </div>

      <div id="rubricRowsHolder"></div>

      <div class="rubric-total-line">
        <span>Rubric Total</span>
        <span>${total} / 100</span>
      </div>
      <div class="validation-banner ${bannerClass} mt-12">${bannerText}</div>

      <div class="btn-row mt-16">
        <button class="btn btn-primary" id="saveAssessmentBtn">Save Assessment</button>
        <button class="btn btn-secondary" id="cancelAssessmentBtn">Cancel</button>
      </div>
    </div>
  `;

  renderRubricRows();

  document.getElementById('closeEditorBtn').addEventListener('click', () => { openAssessmentId = null; draftRubrics = null; renderAssessmentsPage(document.getElementById('pageContent')); });
  document.getElementById('cancelAssessmentBtn').addEventListener('click', () => { openAssessmentId = null; draftRubrics = null; renderAssessmentsPage(document.getElementById('pageContent')); });
  document.getElementById('addRubricBtn').addEventListener('click', () => {
    draftRubrics.push({ id: uid('rub'), name: '', description: '', max: 0 });
    renderAssessmentEditor();
  });
  document.getElementById('saveAssessmentBtn').addEventListener('click', () => saveAssessmentEditor());
}

function renderRubricRows() {
  const holder = document.getElementById('rubricRowsHolder');
  if (!holder) return;
  if (draftRubrics.length === 0) {
    holder.innerHTML = `<div class="hint mb-12">No rubric criteria yet. Add at least one, with maximum marks totaling 100.</div>`;
    return;
  }
  holder.innerHTML = draftRubrics.map((r, idx) => `
    <div class="rubric-row" data-idx="${idx}">
      <div>
        <label>Criterion Name</label>
        <input type="text" class="rubric-name" data-idx="${idx}" value="${escapeHtml(r.name)}" placeholder="e.g. Concept Understanding">
      </div>
      <div>
        <label>Description (optional)</label>
        <input type="text" class="rubric-desc" data-idx="${idx}" value="${escapeHtml(r.description)}" placeholder="What this criterion assesses">
      </div>
      <div>
        <label>Max Mark</label>
        <input type="number" class="rubric-max" data-idx="${idx}" value="${r.max}" min="0" max="100" step="0.5">
      </div>
      <div style="padding-top:24px;">
        <button class="icon-btn" data-remove="${idx}" title="Remove criterion" style="color:var(--danger);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  holder.querySelectorAll('.rubric-name').forEach(el => el.addEventListener('input', (e) => {
    draftRubrics[+e.target.getAttribute('data-idx')].name = e.target.value;
  }));
  holder.querySelectorAll('.rubric-desc').forEach(el => el.addEventListener('input', (e) => {
    draftRubrics[+e.target.getAttribute('data-idx')].description = e.target.value;
  }));
  holder.querySelectorAll('.rubric-max').forEach(el => el.addEventListener('input', (e) => {
    let v = parseFloat(e.target.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 100) v = 100;
    draftRubrics[+e.target.getAttribute('data-idx')].max = v;
    refreshRubricTotalsOnly();
  }));
  holder.querySelectorAll('[data-remove]').forEach(el => el.addEventListener('click', (e) => {
    draftRubrics.splice(+e.currentTarget.getAttribute('data-remove'), 1);
    renderAssessmentEditor();
  }));
}

function refreshRubricTotalsOnly() {
  const total = rubricTotal(draftRubrics);
  const totalLine = document.querySelector('.rubric-total-line span:last-child');
  if (totalLine) totalLine.textContent = `${total} / 100`;
  const banner = document.querySelector('.validation-banner');
  if (banner) {
    banner.className = 'validation-banner mt-12';
    if (draftRubrics.length === 0) {
      banner.classList.add('validation-warn');
      banner.textContent = `Rubric total: ${total} / 100 — add rubric criteria to reach 100.`;
    } else if (total === 100) {
      banner.classList.add('validation-ok');
      banner.textContent = 'Rubric Total: 100 / 100 ✓';
    } else if (total > 100) {
      banner.classList.add('validation-bad');
      banner.textContent = `Rubric total exceeds 100. (Currently ${total})`;
    } else {
      banner.classList.add('validation-bad');
      banner.textContent = `Rubric total must equal exactly 100. (Currently ${total})`;
    }
  }
}

function saveAssessmentEditor() {
  const a = STATE.assessments.find(x => x.id === openAssessmentId);
  if (!a) return;
  const name = document.getElementById('asmtName').value.trim();
  const co = document.getElementById('asmtCo').value;
  const description = document.getElementById('asmtDesc').value.trim();

  if (!name) { showToast('Assessment name is required.', 'error'); return; }
  for (const r of draftRubrics) {
    if (!r.name.trim()) { showToast('Every rubric criterion needs a name.', 'error'); return; }
  }
  const total = rubricTotal(draftRubrics);
  if (draftRubrics.length > 0 && total !== 100) {
    showToast(total > 100 ? 'Rubric total exceeds 100.' : 'Rubric total must equal exactly 100.', 'error');
    return;
  }

  // If rubric set changed (criteria removed), clean up any orphaned marks
  const validRubricIds = new Set(draftRubrics.map(r => r.id));
  Object.keys(a.marks || {}).forEach(studentId => {
    Object.keys(a.marks[studentId]).forEach(rubricId => {
      if (!validRubricIds.has(rubricId)) delete a.marks[studentId][rubricId];
    });
  });

  a.name = name;
  a.co = co;
  a.description = description;
  a.rubrics = draftRubrics;

  saveState();
  showToast('Assessment saved.', 'success');
  openAssessmentId = null;
  draftRubrics = null;
  renderAssessmentsPage(document.getElementById('pageContent'));
}
