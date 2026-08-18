/* =========================================================
   export.js
   CSV exports, JSON backup/restore, print reports,
   clear-all-data, and sample/demo data loading.
   ========================================================= */

/* ---------- Generic CSV download ---------- */
function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function csvEscape(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function subjectFileTag() {
  const y = STATE.subject.year ? STATE.subject.year.replace(/\s+/g, '') : new Date().getFullYear();
  return (STATE.subject.code || 'assessment') + '-' + y;
}

/* ---------- Export 1: Assessment marks (per-assessment) ---------- */
function exportAssessmentMarksCsv(assessmentId) {
  const a = STATE.assessments.find(x => x.id === assessmentId);
  if (!a) return;
  const header = ['Register Number', 'Student Name', 'Attendance', ...a.rubrics.map(r => r.name), 'Total', 'Status'];
  const rows = [header];
  STATE.students.forEach(s => {
    const result = getStudentAssessmentResult(a, s);
    const marks = (a.marks && a.marks[s.id]) || {};
    const rubricVals = a.rubrics.map(r => marks[r.id] !== undefined ? marks[r.id] : '');
    rows.push([
      s.regNo, s.name, s.attendance === 'present' ? 'Present' : 'Absent',
      ...rubricVals,
      result.total === null ? '' : result.total,
      result.status.toUpperCase().replace('_', ' ')
    ]);
  });
  downloadCsv(`assessment-marks-${sanitizeFilename(a.name)}.csv`, rows);
  showToast('CSV exported.', 'success');
}

/* ---------- Export 2: All-assessment summary ---------- */
function exportAllAssessmentSummaryCsv() {
  const header = ['Register Number', 'Student Name', ...STATE.assessments.map(a => a.name), 'Overall Average'];
  const rows = [header];
  STATE.students.forEach(s => {
    const stats = computeStudentStats(s);
    const marks = stats.rows.map(r => r.total === null ? (r.status === 'absent' ? 'ABSENT' : '') : r.total);
    rows.push([s.regNo, s.name, ...marks, stats.average === null ? '' : stats.average]);
  });
  downloadCsv(`all-assessment-summary-${subjectFileTag()}.csv`, rows);
  showToast('CSV exported.', 'success');
}

/* ---------- Export 3: Class analysis ---------- */
function exportClassAnalysisCsv() {
  const header = ['Assessment', 'CO', 'Rubric Total', 'Average', 'Pass', 'Fail', 'Absent', 'Pass Percentage'];
  const rows = [header];
  STATE.assessments.forEach(a => {
    const stats = computeAssessmentStats(a);
    rows.push([
      a.name, a.co || '', rubricTotal(a.rubrics),
      stats.average === null ? '' : stats.average,
      stats.passCount, stats.failCount, stats.absent,
      stats.passPercentage === null ? '' : stats.passPercentage
    ]);
  });
  downloadCsv(`class-analysis-${subjectFileTag()}.csv`, rows);
  showToast('CSV exported.', 'success');
}

/* ---------- CO analysis export ---------- */
function exportCoAnalysisCsv() {
  const coStats = computeCoStats();
  const header = ['CO', 'Mapped Assessments', 'CO Average', 'Weightage', 'Weighted Contribution', 'Students Assessed'];
  const rows = [header];
  CO_LIST.forEach(co => {
    const s = coStats[co];
    rows.push([
      co, s.mappedNames.join(' | '),
      s.average === null ? '' : s.average,
      s.weightage, s.contribution === null ? '' : s.contribution,
      s.studentsAssessed
    ]);
  });
  downloadCsv(`co-analysis-${subjectFileTag()}.csv`, rows);
  showToast('CO Analysis CSV exported.', 'success');
}

function sanitizeFilename(str) {
  return String(str).replace(/[^a-z0-9\-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'assessment';
}

/* ---------- JSON Backup ---------- */
function exportJsonBackup() {
  const json = JSON.stringify(STATE, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const y = STATE.subject.year ? STATE.subject.year.replace(/[^\w]/g, '') : new Date().getFullYear();
  triggerDownload(blob, `faculty-assessment-backup-${y}.json`);
  showToast('Backup exported.', 'success');
}

function importJsonBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      showToast('Invalid backup file.', 'error');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || !('subject' in parsed) || !('students' in parsed) || !('assessments' in parsed)) {
      showToast('Invalid backup file.', 'error');
      return;
    }
    showModal({
      title: 'Restore from Backup',
      bodyHtml: `<p>This will replace <strong>all current data</strong> (subject, students, assessments, marks) with the contents of this backup file. This cannot be undone.</p>`,
      confirmText: 'Restore Backup',
      danger: true,
      onConfirm: () => {
        STATE = normalizeState(parsed);
        saveState(true);
        showToast('Backup restored successfully.', 'success');
        renderPage();
      }
    });
  };
  reader.readAsText(file);
}

/* ---------- Clear all data (double confirmation) ---------- */
function clearAllDataFlow() {
  showModal({
    title: 'Clear All Data',
    bodyHtml: `<p><strong>WARNING:</strong> This will permanently remove all locally stored assessment data, including students, assessments, rubrics, and marks.</p>`,
    confirmText: 'Continue',
    danger: true,
    onConfirm: () => {
      showModal({
        title: 'Final Confirmation',
        bodyHtml: `<p>Final confirmation: delete all data? This action cannot be undone.</p>`,
        confirmText: 'Delete All Data',
        danger: true,
        onConfirm: () => {
          resetState();
          showToast('All data cleared.', 'success');
          selectedMarkAssessmentId = null;
          selectedStudentAnalysisId = null;
          openAssessmentId = null;
          navigateTo('dashboard');
        }
      });
    }
  });
}

/* ---------- Sample / demo data ---------- */
function loadSampleDataFlow() {
  const doLoad = () => {
    STATE = buildSampleState();
    saveState(true);
    showToast('Sample data loaded.', 'success');
    navigateTo('dashboard');
  };
  const hasData = STATE.students.length > 0 || STATE.subject.name;
  if (hasData) {
    showModal({
      title: 'Load Sample Data',
      bodyHtml: `<p>This will replace your current data with sample demo data (40 students, 15 assessments, sample marks). This cannot be undone.</p>`,
      confirmText: 'Load Sample Data',
      danger: true,
      onConfirm: doLoad
    });
  } else {
    doLoad();
  }
}

function buildSampleState() {
  const state = defaultState();
  state.subject = {
    name: 'Control Systems',
    code: 'EEA402',
    year: '2026-2027',
    faculty: 'Dr. Judy Simon',
    passMark: 50,
    coWeightage: { CO1: 20, CO2: 20, CO3: 20, CO4: 20, CO5: 20 }
  };

  for (let i = 1; i <= 40; i++) {
    state.students.push({
      id: uid('stu'),
      regNo: 'REG' + String(1000 + i),
      name: 'Student ' + i,
      attendance: (i % 17 === 0) ? 'absent' : 'present'
    });
  }

  const names = ['Quiz', 'Assignment', 'Simulation Lab', 'Scenario Based Learning', 'Case Study',
    'Analytical Problem Solving', 'Short Answer Test', 'Mini Project', 'Peer Review', 'Concept Map',
    'Lab Report', 'Group Discussion', 'Design Task', 'Open Book Test', 'Capstone Exercise'];
  const rubricSets = [
    [['Concept Understanding', 25], ['Application', 25], ['Analysis', 20], ['Problem Solving', 20], ['Presentation', 10]],
    [['Accuracy', 40], ['Completeness', 30], ['Timeliness', 15], ['Presentation', 15]],
    [['Setup', 20], ['Execution', 40], ['Result Interpretation', 25], ['Report', 15]]
  ];

  state.assessments = names.map((name, idx) => {
    const rubricSet = rubricSets[idx % rubricSets.length];
    const rubrics = rubricSet.map(([rname, max]) => ({ id: uid('rub'), name: rname, description: '', max }));
    const asmt = {
      id: uid('asmt'),
      name,
      description: 'Sample assessment for demonstration purposes.',
      co: CO_LIST[idx % CO_LIST.length],
      rubrics,
      marks: {}
    };
    state.students.forEach((s, si) => {
      if (s.attendance === 'absent') return;
      // leave a few students with no marks entered to demonstrate "not entered"
      if ((si + idx) % 23 === 0) return;
      const marks = {};
      let remaining = 100;
      rubrics.forEach((r, ri) => {
        const isLast = ri === rubrics.length - 1;
        const base = r.max * (0.55 + 0.4 * pseudoRandom(si * 13 + idx * 7 + ri));
        const val = Math.round(Math.min(r.max, Math.max(0, base)) * 2) / 2;
        marks[r.id] = val;
      });
      asmt.marks[s.id] = marks;
    });
    return asmt;
  });

  return state;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------- Print: Assessment report ---------- */
function printAssessmentReport(assessmentId) {
  const a = STATE.assessments.find(x => x.id === assessmentId);
  if (!a) return;
  const stats = computeAssessmentStats(a);

  const rows = STATE.students.map(s => {
    const result = getStudentAssessmentResult(a, s);
    const marks = (a.marks && a.marks[s.id]) || {};
    return `
      <tr>
        <td>${escapeHtml(s.regNo)}</td>
        <td>${escapeHtml(s.name)}</td>
        ${a.rubrics.map(r => `<td style="text-align:right;">${marks[r.id] !== undefined ? marks[r.id] : '—'}</td>`).join('')}
        <td style="text-align:right;font-weight:700;">${result.total === null ? '—' : result.total}</td>
        <td>${result.status === 'absent' ? 'ABSENT' : result.status === 'not_entered' ? 'NOT ENTERED' : result.status.toUpperCase()}</td>
      </tr>`;
  }).join('');

  const html = `
    <div class="print-report">
      <div class="print-header">
        <h2>${escapeHtml(STATE.subject.name || 'Untitled Subject')} (${escapeHtml(STATE.subject.code || '')})</h2>
        <div>Faculty Assessment Report</div>
      </div>
      <div class="print-meta">
        <div><strong>Academic Year:</strong> ${escapeHtml(STATE.subject.year || '—')}</div>
        <div><strong>Faculty:</strong> ${escapeHtml(STATE.subject.faculty || '—')}</div>
        <div><strong>Assessment:</strong> ${escapeHtml(a.name)}</div>
        <div><strong>Course Outcome:</strong> ${escapeHtml(a.co || '—')}</div>
        <div><strong>Rubric Total:</strong> ${rubricTotal(a.rubrics)} / 100</div>
        <div><strong>Pass Mark:</strong> ${STATE.subject.passMark} / 100</div>
      </div>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:11.5px;">
        <thead>
          <tr>
            <th>Reg No</th><th>Student</th>
            ${a.rubrics.map(r => `<th>${escapeHtml(r.name)} (${r.max})</th>`).join('')}
            <th>Total</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="print-meta mt-16">
        <div><strong>Total Students:</strong> ${stats.totalStudents}</div>
        <div><strong>Present:</strong> ${stats.present}</div>
        <div><strong>Absent:</strong> ${stats.absent}</div>
        <div><strong>Assessed:</strong> ${stats.assessed}</div>
        <div><strong>Class Average:</strong> ${formatNum(stats.average)}</div>
        <div><strong>Pass Count:</strong> ${stats.passCount}</div>
        <div><strong>Fail Count:</strong> ${stats.failCount}</div>
        <div><strong>Pass Percentage:</strong> ${formatNum(stats.passPercentage, '%')}</div>
      </div>
    </div>
  `;
  openPrintWindow(html, `Assessment Report - ${a.name}`);
}

/* ---------- Print: CO report ---------- */
function printCoReport() {
  const coStats = computeCoStats();
  const overall = computeOverallWeightedCoScore(coStats);
  const html = `
    <div class="print-report">
      <div class="print-header">
        <h2>${escapeHtml(STATE.subject.name || 'Untitled Subject')} (${escapeHtml(STATE.subject.code || '')})</h2>
        <div>Course Outcome (CO) Analysis Report</div>
      </div>
      <div class="print-meta">
        <div><strong>Academic Year:</strong> ${escapeHtml(STATE.subject.year || '—')}</div>
        <div><strong>Faculty:</strong> ${escapeHtml(STATE.subject.faculty || '—')}</div>
      </div>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr><th>CO</th><th>Mapped Assessments</th><th>Average</th><th>Weightage</th><th>Weighted Contribution</th></tr></thead>
        <tbody>
          ${CO_LIST.map(co => {
            const s = coStats[co];
            return `<tr><td>${co}</td><td>${escapeHtml(s.mappedNames.join(', ') || '—')}</td><td>${formatNum(s.average)}</td><td>${round1(s.weightage)}%</td><td>${formatNum(s.contribution)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <h3 class="mt-16">Overall Weighted CO Score: ${overall === null ? '—' : formatNum(overall) + ' / 100'}</h3>
    </div>
  `;
  openPrintWindow(html, 'CO Analysis Report');
}

function openPrintWindow(bodyHtml, title) {
  const win = window.open('', '_blank');
  if (!win) { showToast('Please allow pop-ups to print reports.', 'error'); return; }
  win.document.write(`
    <html><head><title>${escapeHtml(title)}</title>
    <style>
      body{ font-family: Arial, Helvetica, sans-serif; color:#16213A; padding:30px; }
      .print-header{ text-align:center; border-bottom:2px solid #16213A; padding-bottom:14px; margin-bottom:18px; }
      .print-meta{ display:grid; grid-template-columns: repeat(2,1fr); gap:6px 24px; font-size:12.5px; margin-bottom:18px; }
      table{ width:100%; border-collapse:collapse; }
      th, td{ border:1px solid #999; padding:6px 8px; text-align:left; }
      .mt-16{ margin-top:16px; }
    </style>
    </head><body>${bodyHtml}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
