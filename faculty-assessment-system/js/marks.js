/* =========================================================
   marks.js
   Rubric-wise mark entry per assessment, with auto totals,
   pass/fail status, and autosave.
   ========================================================= */

let selectedMarkAssessmentId = null;
let markSearchTerm = '';

function renderMarksPage(container) {
  if (!selectedMarkAssessmentId && STATE.assessments.length > 0) {
    selectedMarkAssessmentId = STATE.assessments[0].id;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Mark Entry</div>
          <div class="card-desc">Select an assessment, then enter rubric-wise marks for each student. Totals and status update automatically.</div>
        </div>
      </div>
      <div class="field" style="max-width:380px;">
        <label for="markAssessmentSelect">Assessment</label>
        <select id="markAssessmentSelect">
          ${STATE.assessments.map((a, i) => `<option value="${a.id}" ${a.id === selectedMarkAssessmentId ? 'selected' : ''}>Tool ${i + 1} — ${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </div>
      <div id="markEntryHolder"></div>
    </div>
  `;

  document.getElementById('markAssessmentSelect').addEventListener('change', (e) => {
    selectedMarkAssessmentId = e.target.value;
    renderMarkEntryTable();
  });

  renderMarkEntryTable();
}

function renderMarkEntryTable() {
  const holder = document.getElementById('markEntryHolder');
  if (!holder) return;
  const a = STATE.assessments.find(x => x.id === selectedMarkAssessmentId);
  if (!a) { holder.innerHTML = ''; return; }

  const total = rubricTotal(a.rubrics);
  const rubricsValid = a.rubrics.length > 0 && total === 100;

  if (!a.co) {
    holder.innerHTML = `<div class="validation-banner validation-warn mt-16">This assessment has no Course Outcome selected. You can still enter marks, but set a CO in the Assessments page for it to count in CO Analysis.</div>`;
  } else {
    holder.innerHTML = '';
  }

  if (!rubricsValid) {
    holder.innerHTML += emptyState('Create rubrics totaling 100 before entering marks.', `Go to Assessments → ${a.name} and configure rubric criteria that total exactly 100.`);
    return;
  }
  if (STATE.students.length === 0) {
    holder.innerHTML += emptyState('No students entered yet.', 'Add students on the Students page before entering marks.');
    return;
  }

  holder.innerHTML += `
    <div class="field mt-12" style="max-width:320px;">
      <input type="search" id="markSearchInput" placeholder="Search student..." value="${escapeHtml(markSearchTerm)}">
    </div>
    <div class="table-wrap scroll-tight mt-12">
      <table id="marksTable">
        <thead>
          <tr>
            <th>Reg No</th>
            <th>Student</th>
            ${a.rubrics.map(r => `<th class="num" title="${escapeHtml(r.description)}">${escapeHtml(r.name)}<br><span class="text-faint" style="font-weight:500;">(max ${r.max})</span></th>`).join('')}
            <th class="num">Total</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody id="marksTableBody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('markSearchInput').addEventListener('input', (e) => {
    markSearchTerm = e.target.value;
    renderMarkRows(a);
  });

  renderMarkRows(a);
}

function renderMarkRows(a) {
  const tbody = document.getElementById('marksTableBody');
  if (!tbody) return;
  const term = markSearchTerm.trim().toLowerCase();
  const students = STATE.students.filter(s => !term || s.regNo.toLowerCase().includes(term) || s.name.toLowerCase().includes(term));

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${a.rubrics.length + 4}" class="text-soft">No matching students.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    if (s.attendance === 'absent') {
      return `
        <tr>
          <td>${escapeHtml(s.regNo)}</td>
          <td>${escapeHtml(s.name)}</td>
          ${a.rubrics.map(() => `<td class="num text-faint">—</td>`).join('')}
          <td class="num text-faint">—</td>
          <td class="center"><span class="badge badge-absent">ABSENT</span></td>
        </tr>`;
    }
    const studentMarks = (a.marks[s.id]) || {};
    const enteredCount = a.rubrics.filter(r => studentMarks[r.id] !== undefined && studentMarks[r.id] !== null && studentMarks[r.id] !== '').length;
    const complete = enteredCount === a.rubrics.length;
    const studentTotal = complete ? a.rubrics.reduce((sum, r) => sum + (parseFloat(studentMarks[r.id]) || 0), 0) : null;
    let statusBadge = '<span class="badge badge-pending">NOT ENTERED</span>';
    if (complete) {
      const pass = studentTotal >= (STATE.subject.passMark ?? 50);
      statusBadge = pass ? '<span class="badge badge-pass">PASS</span>' : '<span class="badge badge-fail">FAIL</span>';
    } else if (enteredCount > 0) {
      statusBadge = '<span class="badge badge-pending">PARTIAL</span>';
    }

    return `
      <tr data-student="${s.id}">
        <td>${escapeHtml(s.regNo)}</td>
        <td>${escapeHtml(s.name)}</td>
        ${a.rubrics.map(r => `
          <td class="num">
            <input type="number" class="mark-input" min="0" max="${r.max}" step="0.5"
              data-student="${s.id}" data-rubric="${r.id}" data-max="${r.max}"
              value="${studentMarks[r.id] !== undefined ? studentMarks[r.id] : ''}">
          </td>`).join('')}
        <td class="num" data-total-for="${s.id}" style="font-weight:700;">${studentTotal === null ? '—' : round1(studentTotal)}</td>
        <td class="center" data-status-for="${s.id}">${statusBadge}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.mark-input').forEach(input => {
    input.addEventListener('input', (e) => handleMarkInput(e, a));
    input.addEventListener('blur', (e) => handleMarkInput(e, a, true));
  });
}

function handleMarkInput(e, a, isBlur) {
  const input = e.target;
  const studentId = input.getAttribute('data-student');
  const rubricId = input.getAttribute('data-rubric');
  const max = parseFloat(input.getAttribute('data-max'));
  let raw = input.value;

  if (raw === '') {
    input.classList.remove('invalid');
    if (a.marks[studentId]) delete a.marks[studentId][rubricId];
  } else {
    let v = parseFloat(raw);
    if (isNaN(v)) {
      input.classList.add('invalid');
      if (isBlur) showToast('Enter a valid number.', 'error');
      return;
    }
    if (v < 0) { v = 0; input.value = 0; }
    if (v > max) { v = max; input.value = max; if (isBlur) showToast(`Maximum for this criterion is ${max}.`, 'error'); }
    input.classList.remove('invalid');
    if (!a.marks[studentId]) a.marks[studentId] = {};
    a.marks[studentId][rubricId] = v;
  }

  saveState(); // debounced autosave

  // Update just this row's total + status without full re-render (keeps focus/perf)
  const studentMarks = a.marks[studentId] || {};
  const enteredCount = a.rubrics.filter(r => studentMarks[r.id] !== undefined && studentMarks[r.id] !== null && studentMarks[r.id] !== '').length;
  const complete = enteredCount === a.rubrics.length;
  const studentTotal = complete ? a.rubrics.reduce((sum, r) => sum + (parseFloat(studentMarks[r.id]) || 0), 0) : null;

  const totalCell = document.querySelector(`[data-total-for="${studentId}"]`);
  if (totalCell) totalCell.textContent = studentTotal === null ? '—' : round1(studentTotal);

  const statusCell = document.querySelector(`[data-status-for="${studentId}"]`);
  if (statusCell) {
    let badge = '<span class="badge badge-pending">NOT ENTERED</span>';
    if (complete) {
      const pass = studentTotal >= (STATE.subject.passMark ?? 50);
      badge = pass ? '<span class="badge badge-pass">PASS</span>' : '<span class="badge badge-fail">FAIL</span>';
    } else if (enteredCount > 0) {
      badge = '<span class="badge badge-pending">PARTIAL</span>';
    }
    statusCell.innerHTML = badge;
  }
}
