/* =========================================================
   storage.js
   Central application state + persistence (localStorage) +
   shared UI utilities (toast, modal, id generation).
   ========================================================= */

const STORAGE_KEY = 'fams_data_v1';
const MAX_STUDENTS = 40;
const NUM_ASSESSMENTS = 15;
const CO_LIST = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];

/* ---------- ID generation ---------- */
function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Default state ---------- */
function defaultAssessment(index) {
  return {
    id: uid('asmt'),
    name: 'Assessment Tool ' + index,
    description: '',
    co: '',
    rubrics: [],
    marks: {} // { [studentId]: { [rubricId]: number } }
  };
}

function defaultState() {
  const assessments = [];
  for (let i = 1; i <= NUM_ASSESSMENTS; i++) assessments.push(defaultAssessment(i));
  return {
    subject: {
      name: '',
      code: '',
      year: '',
      faculty: '',
      passMark: 50,
      coWeightage: { CO1: 20, CO2: 20, CO3: 20, CO4: 20, CO5: 20 }
    },
    students: [],
    assessments: assessments,
    theme: 'light',
    meta: { createdAt: new Date().toISOString(), version: 1 }
  };
}

/* ---------- App state (in-memory) ---------- */
let STATE = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      STATE = defaultState();
      return STATE;
    }
    const parsed = JSON.parse(raw);
    STATE = normalizeState(parsed);
    return STATE;
  } catch (e) {
    console.error('Failed to load state, resetting to defaults.', e);
    STATE = defaultState();
    return STATE;
  }
}

/* Ensure a loaded/imported object has every field the app expects,
   filling in gaps without discarding existing valid data. */
function normalizeState(obj) {
  const base = defaultState();
  if (!obj || typeof obj !== 'object') return base;

  const out = base;
  out.subject = Object.assign({}, base.subject, obj.subject || {});
  out.subject.coWeightage = Object.assign({}, base.subject.coWeightage, (obj.subject && obj.subject.coWeightage) || {});
  if (typeof out.subject.passMark !== 'number' || isNaN(out.subject.passMark)) out.subject.passMark = 50;

  out.students = Array.isArray(obj.students) ? obj.students.map(s => ({
    id: s.id || uid('stu'),
    regNo: s.regNo || '',
    name: s.name || '',
    attendance: s.attendance === 'absent' ? 'absent' : 'present'
  })) : [];

  if (Array.isArray(obj.assessments) && obj.assessments.length > 0) {
    out.assessments = obj.assessments.slice(0, NUM_ASSESSMENTS).map((a, idx) => ({
      id: a.id || uid('asmt'),
      name: a.name || ('Assessment Tool ' + (idx + 1)),
      description: a.description || '',
      co: CO_LIST.includes(a.co) ? a.co : '',
      rubrics: Array.isArray(a.rubrics) ? a.rubrics.map(r => ({
        id: r.id || uid('rub'),
        name: r.name || '',
        description: r.description || '',
        max: typeof r.max === 'number' ? r.max : parseFloat(r.max) || 0
      })) : [],
      marks: a.marks && typeof a.marks === 'object' ? a.marks : {}
    }));
    while (out.assessments.length < NUM_ASSESSMENTS) {
      out.assessments.push(defaultAssessment(out.assessments.length + 1));
    }
  }

  out.theme = obj.theme === 'dark' ? 'dark' : 'light';
  out.meta = Object.assign({}, base.meta, obj.meta || {});
  return out;
}

/* ---------- Persistence ---------- */
let saveTimer = null;
function saveState(immediate) {
  setSaveStatus('saving');
  const doSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
      setSaveStatus('saved');
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
      showToast('Could not save data. Browser storage may be full.', 'error');
    }
  };
  if (immediate) {
    clearTimeout(saveTimer);
    doSave();
  } else {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 250);
  }
}

function setSaveStatus(status) {
  const texts = document.querySelectorAll('#saveStatusText, #saveStatusTextTop');
  const dots = document.querySelectorAll('#saveStatus, #saveStatusTop');
  let label = 'Saved locally';
  if (status === 'saving') label = 'Saving...';
  if (status === 'error') label = 'Save failed';
  texts.forEach(t => { if (t) t.textContent = status === 'saved' ? '✓ Saved locally' : label; });
  dots.forEach(d => {
    if (!d) return;
    d.classList.toggle('saving', status === 'saving');
    d.style.color = status === 'error' ? 'var(--danger)' : '';
  });
}

function resetState() {
  STATE = defaultState();
  saveState(true);
}

/* ---------- Toast notifications ---------- */
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s ease';
    setTimeout(() => el.remove(), 260);
  }, 2800);
}

/* ---------- Modal / confirm dialog ---------- */
function showModal({ title, bodyHtml, confirmText, cancelText, onConfirm, danger, wide }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h3 id="modalTitle">${escapeHtml(title || '')}</h3>
      <div>${bodyHtml || ''}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modalCancelBtn">${escapeHtml(cancelText || 'Cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modalConfirmBtn">${escapeHtml(confirmText || 'Confirm')}</button>
      </div>
    </div>`;
  root.appendChild(backdrop);
  const close = () => { root.innerHTML = ''; };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('#modalCancelBtn').addEventListener('click', close);
  backdrop.querySelector('#modalConfirmBtn').addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });
  return close;
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

/* ---------- Helpers ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round1(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function formatNum(n, suffix) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return round1(n) + (suffix || '');
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
