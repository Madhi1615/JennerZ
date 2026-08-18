/* =========================================================
   app.js
   Navigation / routing, Subject Setup, Settings, Reports &
   Backup pages, theme toggle, and application bootstrap.
   ========================================================= */

let currentPage = 'dashboard';

const PAGE_TITLES = {
  dashboard: ['Dashboard', 'Overview of assessments, students and CO performance'],
  subject: ['Subject Setup', 'Subject details, pass mark and CO weightage'],
  students: ['Students', 'Manage the class roster (up to ' + MAX_STUDENTS + ' students)'],
  assessments: ['Assessments', 'Configure assessment tools, CO mapping and rubrics'],
  marks: ['Mark Entry', 'Enter rubric-wise marks for each student'],
  coanalysis: ['CO Analysis', 'Course Outcome performance and weighted contribution'],
  studentanalysis: ['Student Analysis', 'Per-student assessment performance'],
  reports: ['Reports & Backup', 'Export CSV reports, JSON backup, and print reports'],
  settings: ['Settings', 'Pass mark, theme, CO weightage, and data management']
};

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === page);
  });
  closeMobileSidebar();
  renderPage();
  document.getElementById('pageContent').scrollIntoView({ behavior: 'instant', block: 'start' });
}

function renderPage() {
  const [title, subtitle] = PAGE_TITLES[currentPage] || ['', ''];
  document.getElementById('pageTitle').textContent = title;
  const headerSub = STATE.subject.code || STATE.subject.name
    ? `${STATE.subject.code || '—'} · ${STATE.subject.name || 'Untitled Subject'}`
    : subtitle;
  document.getElementById('pageSubtitle').textContent = headerSub;

  const container = document.getElementById('pageContent');
  switch (currentPage) {
    case 'dashboard': renderDashboardPage(container); break;
    case 'subject': renderSubjectPage(container); break;
    case 'students': renderStudentsPage(container); break;
    case 'assessments': renderAssessmentsPage(container); break;
    case 'marks': renderMarksPage(container); break;
    case 'coanalysis': renderCoAnalysisPage(container); break;
    case 'studentanalysis': renderStudentAnalysisPage(container); break;
    case 'reports': renderReportsPage(container); break;
    case 'settings': renderSettingsPage(container); break;
    default: container.innerHTML = '';
  }
}

/* =========================================================
   SUBJECT SETUP PAGE
   ========================================================= */
function renderSubjectPage(container) {
  const subj = STATE.subject;
  const wTotal = round1(CO_LIST.reduce((s, co) => s + (parseFloat(subj.coWeightage[co]) || 0), 0));

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Subject Details</div></div>
      <div class="field-row">
        <div class="field">
          <label for="subName">Subject Name</label>
          <input type="text" id="subName" value="${escapeHtml(subj.name)}" placeholder="e.g. Control Systems">
        </div>
        <div class="field">
          <label for="subCode">Subject Code</label>
          <input type="text" id="subCode" value="${escapeHtml(subj.code)}" placeholder="e.g. EEA402">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="subYear">Academic Year</label>
          <input type="text" id="subYear" value="${escapeHtml(subj.year)}" placeholder="e.g. 2026-2027">
        </div>
        <div class="field">
          <label for="subFaculty">Faculty Name</label>
          <input type="text" id="subFaculty" value="${escapeHtml(subj.faculty)}" placeholder="e.g. Dr. Judy Simon">
        </div>
      </div>
      <div class="field" style="max-width:220px;">
        <label for="subPassMark">Pass Mark (out of 100)</label>
        <input type="number" id="subPassMark" min="0" max="100" value="${subj.passMark}">
        <div class="error-text" id="passMarkErr" style="display:none;">Pass mark must be between 0 and 100.</div>
      </div>
      <button class="btn btn-primary mt-8" id="saveSubjectBtn">Save Subject Details</button>
    </div>

    <div class="card mt-16">
      <div class="card-header">
        <div>
          <div class="card-title">CO Weightage</div>
          <div class="card-desc">Enter the weightage for each Course Outcome. The total must equal exactly 100. Decimal values are allowed.</div>
        </div>
      </div>
      <div class="grid grid-cols-3" id="coWeightageInputs"></div>
      <div class="validation-banner mt-16" id="coWeightageBanner"></div>
      <button class="btn btn-primary" id="saveCoWeightageBtn">Save CO Weightage</button>
    </div>
  `;

  const coHolder = document.getElementById('coWeightageInputs');
  coHolder.innerHTML = CO_LIST.map(co => `
    <div class="field">
      <label for="co_${co}">${co}</label>
      <input type="number" id="co_${co}" class="co-weightage-input" min="0" max="100" step="0.5" value="${subj.coWeightage[co]}">
    </div>
  `).join('');

  const updateBanner = () => {
    const total = round1(CO_LIST.reduce((s, co) => s + (parseFloat(document.getElementById('co_' + co).value) || 0), 0));
    const banner = document.getElementById('coWeightageBanner');
    if (total === 100) { banner.className = 'validation-banner validation-ok mt-16'; banner.textContent = 'CO Weightage Total: 100 / 100 ✓'; }
    else if (total < 100) { banner.className = 'validation-banner validation-bad mt-16'; banner.textContent = `CO weightage total is less than 100. (Currently ${total})`; }
    else { banner.className = 'validation-banner validation-bad mt-16'; banner.textContent = `CO weightage total exceeds 100. (Currently ${total})`; }
    return total;
  };
  updateBanner();
  coHolder.querySelectorAll('.co-weightage-input').forEach(el => el.addEventListener('input', updateBanner));

  document.getElementById('saveSubjectBtn').addEventListener('click', () => {
    const passMark = parseFloat(document.getElementById('subPassMark').value);
    const errEl = document.getElementById('passMarkErr');
    if (isNaN(passMark) || passMark < 0 || passMark > 100) {
      errEl.style.display = 'block';
      document.getElementById('subPassMark').classList.add('invalid');
      return;
    }
    errEl.style.display = 'none';
    document.getElementById('subPassMark').classList.remove('invalid');

    subj.name = document.getElementById('subName').value.trim();
    subj.code = document.getElementById('subCode').value.trim();
    subj.year = document.getElementById('subYear').value.trim();
    subj.faculty = document.getElementById('subFaculty').value.trim();
    subj.passMark = passMark;
    saveState();
    showToast('Subject details saved.', 'success');
    renderPage();
  });

  document.getElementById('saveCoWeightageBtn').addEventListener('click', () => {
    const total = updateBanner();
    if (total !== 100) {
      showToast('CO weightage total must equal exactly 100 before saving.', 'error');
      return;
    }
    CO_LIST.forEach(co => {
      subj.coWeightage[co] = parseFloat(document.getElementById('co_' + co).value) || 0;
    });
    saveState();
    showToast('CO weightage saved.', 'success');
  });
}

/* =========================================================
   REPORTS & BACKUP PAGE
   ========================================================= */
function renderReportsPage(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">CSV Reports</div></div>
      <div class="grid grid-cols-3">
        <div class="card">
          <div class="card-title" style="font-size:14.5px;">Assessment Marks</div>
          <div class="card-desc mb-12">Rubric-wise marks for one assessment.</div>
          <select id="exportAssessmentSelect" class="mb-12">
            ${STATE.assessments.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm w-full" id="exportAssessmentCsvBtn">Export CSV</button>
        </div>
        <div class="card">
          <div class="card-title" style="font-size:14.5px;">All-Assessment Summary</div>
          <div class="card-desc mb-12">Every student's mark across all 15 assessments.</div>
          <button class="btn btn-secondary btn-sm w-full mt-24" id="exportSummaryCsvBtn">Export CSV</button>
        </div>
        <div class="card">
          <div class="card-title" style="font-size:14.5px;">Class Analysis</div>
          <div class="card-desc mb-12">Per-assessment average, pass/fail, pass %.</div>
          <button class="btn btn-secondary btn-sm w-full mt-24" id="exportClassCsvBtn">Export CSV</button>
        </div>
      </div>
      <div class="mt-16">
        <button class="btn btn-accent btn-sm" id="exportCoCsvBtn">Export CO Analysis CSV</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Print Reports</div></div>
      <div class="field-row">
        <div>
          <label for="printAssessmentSelect">Assessment Report</label>
          <select id="printAssessmentSelect" class="mb-12">
            ${STATE.assessments.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" id="printAssessmentBtn">Print Assessment Report</button>
        </div>
        <div>
          <label>CO Analysis Report</label>
          <div class="hint mb-12">Print a full CO performance summary with weighted contributions.</div>
          <button class="btn btn-secondary btn-sm" id="printCoBtn">Print CO Report</button>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">JSON Backup</div></div>
      <p class="text-soft text-sm mb-12">Export the complete application state — subject, students, assessments, rubrics and marks — as a JSON file you can restore later or on another computer.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="exportJsonBtn">Export JSON Backup</button>
        <button class="btn btn-secondary" id="importJsonBtn">Import JSON Backup</button>
        <input type="file" id="importJsonInput" accept=".json" style="display:none">
      </div>
      <div class="note-box mt-16">Assessment data is stored locally in this browser. Export a JSON backup regularly to prevent data loss when browser storage is cleared.</div>
    </div>
  `;

  document.getElementById('exportAssessmentCsvBtn').addEventListener('click', () => {
    exportAssessmentMarksCsv(document.getElementById('exportAssessmentSelect').value);
  });
  document.getElementById('exportSummaryCsvBtn').addEventListener('click', exportAllAssessmentSummaryCsv);
  document.getElementById('exportClassCsvBtn').addEventListener('click', exportClassAnalysisCsv);
  document.getElementById('exportCoCsvBtn').addEventListener('click', exportCoAnalysisCsv);
  document.getElementById('printAssessmentBtn').addEventListener('click', () => {
    printAssessmentReport(document.getElementById('printAssessmentSelect').value);
  });
  document.getElementById('printCoBtn').addEventListener('click', printCoReport);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJsonBackup);
  document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('importJsonInput').click());
  document.getElementById('importJsonInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importJsonBackupFile(e.target.files[0]);
    e.target.value = '';
  });
}

/* =========================================================
   SETTINGS PAGE
   ========================================================= */
function renderSettingsPage(container) {
  let storageSize = '—';
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    storageSize = (new Blob([raw]).size / 1024).toFixed(1) + ' KB';
  } catch (e) {}

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Appearance</div></div>
      <div class="flex-between">
        <div>
          <div style="font-weight:600; font-size:13.5px;">Theme</div>
          <div class="text-soft text-sm">Choose light or dark mode. Preference is saved in this browser.</div>
        </div>
        <div class="btn-row">
          <button class="btn ${STATE.theme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="setLightBtn">Light</button>
          <button class="btn ${STATE.theme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="setDarkBtn">Dark</button>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Pass Mark &amp; CO Weightage</div></div>
      <p class="text-soft text-sm mb-12">Manage these on the Subject Setup page.</p>
      <button class="btn btn-secondary btn-sm" id="goSubjectBtn">Go to Subject Setup</button>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Demo Data</div></div>
      <p class="text-soft text-sm mb-12">Load sample data (40 students, 15 assessments, sample marks) to explore the application.</p>
      <button class="btn btn-accent btn-sm" id="loadSampleBtn">Load Sample Data</button>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Data Storage</div></div>
      <div class="co-metric-row"><span>Storage used</span><span class="val">${storageSize}</span></div>
      <div class="co-metric-row"><span>Students</span><span class="val">${STATE.students.length} / ${MAX_STUDENTS}</span></div>
      <div class="co-metric-row"><span>Assessments configured</span><span class="val">${STATE.assessments.filter(a => a.rubrics.length && rubricTotal(a.rubrics) === 100).length} / ${NUM_ASSESSMENTS}</span></div>
      <div class="note-box mt-16">Assessment data is stored locally in this browser. Export a JSON backup regularly to prevent data loss when browser storage is cleared.</div>
      <div class="btn-row mt-16">
        <button class="btn btn-secondary btn-sm" id="settingsExportJsonBtn">Export Backup</button>
        <button class="btn btn-secondary btn-sm" id="settingsImportJsonBtn">Restore Backup</button>
        <input type="file" id="settingsImportJsonInput" accept=".json" style="display:none">
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Application Information</div></div>
      <div class="co-metric-row"><span>Application</span><span class="val">Faculty Assessment Management System</span></div>
      <div class="co-metric-row"><span>Storage</span><span class="val">Browser Local Storage (no server, no database)</span></div>
      <div class="co-metric-row"><span>Assessment tools</span><span class="val">${NUM_ASSESSMENTS}</span></div>
      <div class="co-metric-row"><span>Student capacity</span><span class="val">${MAX_STUDENTS}</span></div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">Danger Zone</div></div>
      <p class="text-soft text-sm mb-12">Permanently delete all locally stored data and reset the application.</p>
      <button class="btn btn-danger btn-sm" id="clearAllBtn">Clear All Data</button>
    </div>
  `;

  document.getElementById('setLightBtn').addEventListener('click', () => setTheme('light'));
  document.getElementById('setDarkBtn').addEventListener('click', () => setTheme('dark'));
  document.getElementById('goSubjectBtn').addEventListener('click', () => navigateTo('subject'));
  document.getElementById('loadSampleBtn').addEventListener('click', loadSampleDataFlow);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllDataFlow);
  document.getElementById('settingsExportJsonBtn').addEventListener('click', exportJsonBackup);
  document.getElementById('settingsImportJsonBtn').addEventListener('click', () => document.getElementById('settingsImportJsonInput').click());
  document.getElementById('settingsImportJsonInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importJsonBackupFile(e.target.files[0]);
    e.target.value = '';
  });
}

/* =========================================================
   THEME
   ========================================================= */
function setTheme(theme) {
  STATE.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggleLabel').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  saveState();
  if (['dashboard', 'coanalysis', 'studentanalysis'].includes(currentPage)) renderPage();
}

function toggleTheme() {
  setTheme(STATE.theme === 'dark' ? 'light' : 'dark');
}

/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
}
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const open = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', open);
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', String(open));
}

/* =========================================================
   INIT
   ========================================================= */
function init() {
  loadState();
  document.documentElement.setAttribute('data-theme', STATE.theme);
  document.getElementById('themeToggleLabel').textContent = STATE.theme === 'dark' ? 'Light mode' : 'Dark mode';

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-page')));
  });

  document.getElementById('hamburgerBtn').addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebarThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('mobileThemeToggle').addEventListener('click', toggleTheme);

  navigateTo('dashboard');
  setSaveStatus('saved');
}

document.addEventListener('DOMContentLoaded', init);
