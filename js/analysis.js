/* =========================================================
   analysis.js
   Calculation engine (assessment stats, CO stats, student
   stats) plus Dashboard / CO Analysis / Student Analysis pages
   and Chart.js visualizations.
   ========================================================= */

const chartInstances = {};

function destroyChart(key) {
  if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
}

function chartJsAvailable() {
  return typeof window.Chart !== 'undefined' && !window.__CHART_JS_FAILED__;
}

/* ---------- Core per-student, per-assessment result ---------- */
function getStudentAssessmentResult(assessment, student) {
  if (student.attendance === 'absent') return { status: 'absent', total: null };
  if (!assessment.rubrics || assessment.rubrics.length === 0) return { status: 'not_entered', total: null };
  const marks = (assessment.marks && assessment.marks[student.id]) || {};
  const enteredCount = assessment.rubrics.filter(r => marks[r.id] !== undefined && marks[r.id] !== null && marks[r.id] !== '').length;
  if (enteredCount !== assessment.rubrics.length) return { status: 'not_entered', total: null };
  const total = assessment.rubrics.reduce((sum, r) => sum + (parseFloat(marks[r.id]) || 0), 0);
  const pass = total >= (STATE.subject.passMark ?? 50);
  return { status: pass ? 'pass' : 'fail', total: round1(total) };
}

/* ---------- Assessment-level statistics ---------- */
function computeAssessmentStats(assessment) {
  const totalStudents = STATE.students.length;
  const present = STATE.students.filter(s => s.attendance === 'present');
  const absent = totalStudents - present.length;

  const results = present.map(s => getStudentAssessmentResult(assessment, s));
  const assessed = results.filter(r => r.status === 'pass' || r.status === 'fail');
  const notEntered = present.length - assessed.length;
  const passCount = assessed.filter(r => r.status === 'pass').length;
  const failCount = assessed.length - passCount;
  const marksArr = assessed.map(r => r.total);
  const average = marksArr.length ? round1(marksArr.reduce((a, b) => a + b, 0) / marksArr.length) : null;
  const highest = marksArr.length ? Math.max(...marksArr) : null;
  const lowest = marksArr.length ? Math.min(...marksArr) : null;
  const passPercentage = assessed.length ? round1((passCount / assessed.length) * 100) : null;
  const rubricsValid = assessment.rubrics.length > 0 && rubricTotal(assessment.rubrics) === 100;

  return {
    totalStudents, present: present.length, absent,
    assessed: assessed.length, notEntered, passCount, failCount,
    average, highest, lowest, passPercentage, rubricsValid
  };
}

/* ---------- CO-level statistics ---------- */
function computeCoStats() {
  const out = {};
  CO_LIST.forEach(co => {
    const mapped = STATE.assessments.filter(a => a.co === co);
    const withData = mapped.map(a => ({ a, stats: computeAssessmentStats(a) })).filter(x => x.stats.average !== null);
    const weightage = STATE.subject.coWeightage[co] || 0;
    let average = null;
    if (withData.length > 0) {
      average = round1(withData.reduce((sum, x) => sum + x.stats.average, 0) / withData.length);
    }
    const contribution = average !== null ? round1((average * weightage) / 100) : null;
    out[co] = {
      mappedCount: mapped.length,
      mappedWithDataCount: withData.length,
      mappedNames: mapped.map(a => a.name),
      average, weightage, contribution,
      studentsAssessed: withData.length ? Math.max(...withData.map(x => x.stats.assessed)) : 0
    };
  });
  return out;
}

function computeOverallWeightedCoScore(coStats) {
  const valid = CO_LIST.filter(co => coStats[co].contribution !== null);
  if (valid.length === 0) return null;
  return round1(valid.reduce((sum, co) => sum + coStats[co].contribution, 0));
}

/* ---------- Student-level statistics ---------- */
function computeStudentStats(student) {
  const rows = STATE.assessments.map(a => {
    const result = getStudentAssessmentResult(a, student);
    return { assessment: a, co: a.co, status: result.status, total: result.total };
  });
  const completed = rows.filter(r => r.status === 'pass' || r.status === 'fail');
  const passCount = rows.filter(r => r.status === 'pass').length;
  const failCount = rows.filter(r => r.status === 'fail').length;
  const absentCount = rows.filter(r => r.status === 'absent').length;
  const notEnteredCount = rows.filter(r => r.status === 'not_entered').length;
  const average = completed.length ? round1(completed.reduce((s, r) => s + r.total, 0) / completed.length) : null;
  return { rows, passCount, failCount, absentCount, notEnteredCount, average, completedCount: completed.length };
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboardPage(container) {
  const totalStudents = STATE.students.length;
  const present = STATE.students.filter(s => s.attendance === 'present').length;
  const absent = totalStudents - present;

  const perAssessment = STATE.assessments.map(a => ({ a, stats: computeAssessmentStats(a) }));
  const withAvg = perAssessment.filter(x => x.stats.average !== null);
  const overallAverage = withAvg.length ? round1(withAvg.reduce((s, x) => s + x.stats.average, 0) / withAvg.length) : null;
  const withPassPct = perAssessment.filter(x => x.stats.passPercentage !== null);
  const avgPassPct = withPassPct.length ? round1(withPassPct.reduce((s, x) => s + x.stats.passPercentage, 0) / withPassPct.length) : null;

  container.innerHTML = `
    <div class="grid grid-cols-4">
      <div class="stat-card accent">
        <div class="stat-label">Total Students</div>
        <div class="stat-value">${totalStudents}</div>
        <div class="stat-sub">of ${MAX_STUDENTS} max</div>
      </div>
      <div class="stat-card ok">
        <div class="stat-label">Present</div>
        <div class="stat-value">${present}</div>
        <div class="stat-sub">${absent} absent</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Assessment Tools</div>
        <div class="stat-value">${NUM_ASSESSMENTS}</div>
        <div class="stat-sub">${withAvg.length} with entered marks</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-label">Overall Average</div>
        <div class="stat-value">${formatNum(overallAverage)}</div>
        <div class="stat-sub">Average Pass %: ${formatNum(avgPassPct, '%')}</div>
      </div>
    </div>

    ${totalStudents === 0 ? `<div class="card mt-16">${emptyState('No students entered yet.', 'Add students on the Students page to begin tracking assessments.')}</div>` : ''}

    <div class="card mt-16">
      <div class="card-header">
        <div class="card-title">Assessment Summary</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Assessment</th><th>CO</th><th class="center">Rubric</th><th class="num">Average</th><th class="num">Pass</th><th class="num">Fail</th><th class="num">Absent</th><th class="num">Pass %</th></tr></thead>
          <tbody>
            ${perAssessment.map(({ a, stats }) => `
              <tr>
                <td>${escapeHtml(a.name)}</td>
                <td>${a.co ? `<span class="badge badge-pass">${a.co}</span>` : `<span class="badge badge-pending">—</span>`}</td>
                <td class="center">${stats.rubricsValid ? '<span class="badge badge-ok">100 ✓</span>' : '<span class="badge badge-bad">✕</span>'}</td>
                <td class="num">${formatNum(stats.average)}</td>
                <td class="num">${stats.passCount}</td>
                <td class="num">${stats.failCount}</td>
                <td class="num">${stats.absent}</td>
                <td class="num">${formatNum(stats.passPercentage, '%')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-cols-2 mt-16">
      <div class="chart-card">
        <div class="card-title" style="font-size:14.5px;">Assessment-wise Class Average</div>
        <div class="chart-canvas-wrap mt-12" id="chartAvgWrap"></div>
      </div>
      <div class="chart-card">
        <div class="card-title" style="font-size:14.5px;">Assessment-wise Pass Percentage</div>
        <div class="chart-canvas-wrap mt-12" id="chartPassWrap"></div>
      </div>
    </div>
  `;

  renderBarChart('chartAvgWrap', 'dashAvg',
    perAssessment.map((x, i) => 'A' + (i + 1)),
    perAssessment.map(x => x.stats.average),
    'Average', '#2454C7');
  renderBarChart('chartPassWrap', 'dashPass',
    perAssessment.map((x, i) => 'A' + (i + 1)),
    perAssessment.map(x => x.stats.passPercentage),
    'Pass %', '#12897D');
}

/* =========================================================
   CO ANALYSIS
   ========================================================= */
function renderCoAnalysisPage(container) {
  const coStats = computeCoStats();
  const overall = computeOverallWeightedCoScore(coStats);
  const weightageTotal = CO_LIST.reduce((s, co) => s + (STATE.subject.coWeightage[co] || 0), 0);

  container.innerHTML = `
    ${round1(weightageTotal) !== 100 ? `<div class="validation-banner validation-warn">CO Weightage currently totals ${round1(weightageTotal)} / 100. Adjust it in Subject Setup for accurate weighted scoring.</div>` : ''}

    <div class="grid grid-cols-3" id="coCardsGrid"></div>

    <div class="overall-score-banner">
      <div class="label">Overall Weighted CO Score</div>
      <div class="value">${overall === null ? '—' : formatNum(overall) + ' / 100'}</div>
      ${overall === null ? `<div class="mt-8" style="font-size:12.5px; color:#D7E1FB;">No assessments have data yet.</div>` : ''}
    </div>

    <div class="card mt-16">
      <div class="card-header"><div class="card-title">CO Mapping Status</div></div>
      <div id="coMappingNotes"></div>
    </div>

    <div class="grid grid-cols-2 mt-16">
      <div class="chart-card">
        <div class="card-title" style="font-size:14.5px;">CO-wise Average</div>
        <div class="chart-canvas-wrap mt-12" id="chartCoAvgWrap"></div>
      </div>
      <div class="chart-card">
        <div class="card-title" style="font-size:14.5px;">CO Weighted Contribution</div>
        <div class="chart-canvas-wrap mt-12" id="chartCoContribWrap"></div>
      </div>
    </div>
  `;

  const grid = document.getElementById('coCardsGrid');
  grid.innerHTML = CO_LIST.map(co => {
    const s = coStats[co];
    return `
      <div class="co-card">
        <div class="co-name">${co}</div>
        <div class="co-metric-row"><span>Average</span><span class="val">${formatNum(s.average)}</span></div>
        <div class="co-metric-row"><span>Weightage</span><span class="val">${round1(s.weightage)}%</span></div>
        <div class="co-metric-row"><span>Weighted Contribution</span><span class="val">${formatNum(s.contribution)}</span></div>
        <div class="co-metric-row"><span>Mapped assessments</span><span class="val">${s.mappedCount}</span></div>
        <div class="co-metric-row"><span>Students assessed</span><span class="val">${s.studentsAssessed}</span></div>
      </div>
    `;
  }).join('');

  const notesHolder = document.getElementById('coMappingNotes');
  let notes = [];
  STATE.assessments.forEach(a => {
    if (!a.co) notes.push(`<div class="validation-banner validation-warn">"${escapeHtml(a.name)}": Please select a CO before using this assessment in CO analysis.</div>`);
  });
  CO_LIST.forEach(co => {
    if (coStats[co].mappedCount === 0) notes.push(`<div class="validation-banner validation-warn">No assessment mapped to ${co}.</div>`);
  });
  notesHolder.innerHTML = notes.length ? notes.join('') : `<div class="validation-banner validation-ok">All Course Outcomes have mapped assessments.</div>`;

  renderBarChart('chartCoAvgWrap', 'coAvg', CO_LIST, CO_LIST.map(co => coStats[co].average), 'CO Average', '#2454C7');
  renderBarChart('chartCoContribWrap', 'coContrib', CO_LIST, CO_LIST.map(co => coStats[co].contribution), 'Weighted Contribution', '#12897D');
}

/* =========================================================
   STUDENT ANALYSIS
   ========================================================= */
let selectedStudentAnalysisId = null;

function renderStudentAnalysisPage(container) {
  if (STATE.students.length === 0) {
    container.innerHTML = `<div class="card">${emptyState('No students entered yet.', 'Add students on the Students page to view individual analysis.')}</div>`;
    return;
  }
  if (!selectedStudentAnalysisId || !STATE.students.find(s => s.id === selectedStudentAnalysisId)) {
    selectedStudentAnalysisId = STATE.students[0].id;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Select Student</div></div>
      <div class="field" style="max-width:420px;">
        <input type="search" id="studentAnalysisSearch" placeholder="Search by register number or name">
      </div>
      <div class="field" style="max-width:420px;">
        <select id="studentAnalysisSelect"></select>
      </div>
    </div>
    <div id="studentAnalysisDetail" class="mt-16"></div>
  `;

  const select = document.getElementById('studentAnalysisSelect');
  function populateSelect(term) {
    const t = (term || '').trim().toLowerCase();
    const filtered = STATE.students.filter(s => !t || s.regNo.toLowerCase().includes(t) || s.name.toLowerCase().includes(t));
    select.innerHTML = filtered.map(s => `<option value="${s.id}" ${s.id === selectedStudentAnalysisId ? 'selected' : ''}>${escapeHtml(s.regNo)} — ${escapeHtml(s.name)}</option>`).join('')
      || '<option value="">No matches</option>';
  }
  populateSelect('');

  document.getElementById('studentAnalysisSearch').addEventListener('input', (e) => {
    populateSelect(e.target.value);
    if (select.value) { selectedStudentAnalysisId = select.value; renderStudentDetail(); }
  });
  select.addEventListener('change', (e) => {
    selectedStudentAnalysisId = e.target.value;
    renderStudentDetail();
  });

  renderStudentDetail();
}

function renderStudentDetail() {
  const holder = document.getElementById('studentAnalysisDetail');
  const student = STATE.students.find(s => s.id === selectedStudentAnalysisId);
  if (!holder || !student) { if (holder) holder.innerHTML = ''; return; }

  const stats = computeStudentStats(student);

  holder.innerHTML = `
    <div class="grid grid-cols-4">
      <div class="stat-card"><div class="stat-label">Attendance</div><div class="stat-value" style="font-size:20px;">${student.attendance === 'present' ? '<span class="badge badge-pass">PRESENT</span>' : '<span class="badge badge-absent">ABSENT</span>'}</div></div>
      <div class="stat-card ok"><div class="stat-label">Overall Average</div><div class="stat-value">${formatNum(stats.average)}</div><div class="stat-sub">across ${stats.completedCount} completed assessments</div></div>
      <div class="stat-card"><div class="stat-label">Pass / Fail</div><div class="stat-value" style="font-size:20px;">${stats.passCount} / ${stats.failCount}</div></div>
      <div class="stat-card warn"><div class="stat-label">Absent / Not Entered</div><div class="stat-value" style="font-size:20px;">${stats.absentCount} / ${stats.notEnteredCount}</div></div>
    </div>

    <div class="card mt-16">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(student.name)} <span class="text-soft text-sm">(${escapeHtml(student.regNo)})</span></div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Assessment</th><th>CO</th><th class="num">Mark</th><th class="center">Status</th></tr></thead>
          <tbody>
            ${stats.rows.map(r => `
              <tr>
                <td>${escapeHtml(r.assessment.name)}</td>
                <td>${r.co || '<span class="text-faint">—</span>'}</td>
                <td class="num">${r.total === null ? '—' : r.total}</td>
                <td class="center">${statusBadgeFor(r.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="chart-card mt-16">
      <div class="card-title" style="font-size:14.5px;">Assessment-wise Marks — ${escapeHtml(student.name)}</div>
      <div class="chart-canvas-wrap tall mt-12" id="studentChartWrap"></div>
    </div>
  `;

  renderBarChart('studentChartWrap', 'studentPerf',
    stats.rows.map((r, i) => 'A' + (i + 1)),
    stats.rows.map(r => r.total),
    'Marks', '#2454C7');
}

function statusBadgeFor(status) {
  if (status === 'pass') return '<span class="badge badge-pass">PASS</span>';
  if (status === 'fail') return '<span class="badge badge-fail">FAIL</span>';
  if (status === 'absent') return '<span class="badge badge-absent">ABSENT</span>';
  return '<span class="badge badge-pending">NOT ENTERED</span>';
}

/* =========================================================
   Chart rendering helper (Chart.js with graceful fallback)
   ========================================================= */
function renderBarChart(wrapId, key, labels, data, label, color) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  destroyChart(key);

  if (!chartJsAvailable()) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">Chart library unavailable</div><div class="empty-state-sub">Data is still available in the tables above. Charts require an internet connection to load Chart.js.</div></div>`;
    return;
  }
  const hasData = data.some(d => d !== null && d !== undefined);
  if (!hasData) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No valid assessment data available.</div></div>`;
    return;
  }
  wrap.innerHTML = `<canvas></canvas>`;
  const ctx = wrap.querySelector('canvas').getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#A8B2C6' : '#5A6479';

  chartInstances[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color, borderRadius: 4, maxBarThickness: 34 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor } },
        y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });
}
