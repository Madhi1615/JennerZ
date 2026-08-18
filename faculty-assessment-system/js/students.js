/* =========================================================
   students.js
   Student roster management (max 40 students).
   ========================================================= */

let studentSearchTerm = '';
let editingStudentId = null;

function renderStudentsPage(container) {
  const count = STATE.students.length;
  const present = STATE.students.filter(s => s.attendance === 'present').length;
  const absent = count - present;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Students (${count} / ${MAX_STUDENTS})</div>
          <div class="card-desc">Present: ${present} &nbsp;·&nbsp; Absent: ${absent}</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" id="importCsvBtn">Import CSV</button>
          <input type="file" id="importCsvInput" accept=".csv" style="display:none">
          <button class="btn btn-primary btn-sm" id="addStudentBtn" ${count >= MAX_STUDENTS ? 'disabled' : ''}>+ Add Student</button>
        </div>
      </div>

      <div class="field" style="max-width:340px;">
        <input type="search" id="studentSearchInput" placeholder="Search by register number or name" value="${escapeHtml(studentSearchTerm)}">
      </div>

      ${count >= MAX_STUDENTS ? `<div class="validation-banner validation-warn">Maximum of ${MAX_STUDENTS} students reached.</div>` : ''}

      <div id="studentTableHolder"></div>
    </div>
  `;

  document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal(null));
  document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('importCsvInput').click());
  document.getElementById('importCsvInput').addEventListener('change', handleStudentCsvImport);
  document.getElementById('studentSearchInput').addEventListener('input', (e) => {
    studentSearchTerm = e.target.value;
    renderStudentTable();
  });

  renderStudentTable();
}

function renderStudentTable() {
  const holder = document.getElementById('studentTableHolder');
  if (!holder) return;

  const term = studentSearchTerm.trim().toLowerCase();
  const filtered = STATE.students.filter(s =>
    !term || s.regNo.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)
  );

  if (STATE.students.length === 0) {
    holder.innerHTML = emptyState('No students entered yet.', 'Add students individually or import them from a CSV file (Register Number, Name, Attendance).');
    return;
  }
  if (filtered.length === 0) {
    holder.innerHTML = emptyState('No matching students.', 'Try a different search term.');
    return;
  }

  let rows = filtered.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.regNo)}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${s.attendance === 'present'
        ? '<span class="badge badge-pass">PRESENT</span>'
        : '<span class="badge badge-absent">ABSENT</span>'}</td>
      <td>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${s.id}" style="color:var(--danger)">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  holder.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>S.No</th><th>Register Number</th><th>Student Name</th><th>Attendance</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  holder.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openStudentModal(btn.getAttribute('data-edit')));
  });
  holder.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteStudent(btn.getAttribute('data-del')));
  });
}

function emptyState(title, sub) {
  return `
    <div class="empty-state">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 9h10M7 13h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <div class="empty-state-sub">${escapeHtml(sub || '')}</div>
    </div>`;
}

function openStudentModal(studentId) {
  editingStudentId = studentId;
  const student = studentId ? STATE.students.find(s => s.id === studentId) : { regNo: '', name: '', attendance: 'present' };
  if (!student) return;

  showModal({
    title: studentId ? 'Edit Student' : 'Add Student',
    confirmText: studentId ? 'Save Changes' : 'Add Student',
    bodyHtml: `
      <div class="field">
        <label for="stuRegNo">Register Number</label>
        <input type="text" id="stuRegNo" value="${escapeHtml(student.regNo)}" autocomplete="off">
        <div class="error-text" id="stuRegNoErr" style="display:none;"></div>
      </div>
      <div class="field">
        <label for="stuName">Student Name</label>
        <input type="text" id="stuName" value="${escapeHtml(student.name)}" autocomplete="off">
      </div>
      <div class="field">
        <label for="stuAttendance">Attendance</label>
        <select id="stuAttendance">
          <option value="present" ${student.attendance === 'present' ? 'selected' : ''}>Present</option>
          <option value="absent" ${student.attendance === 'absent' ? 'selected' : ''}>Absent</option>
        </select>
      </div>
    `,
    onConfirm: () => {} // overridden below to allow validation-retry
  });

  // Intercept confirm to validate before closing
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener('click', () => saveStudentFromModal());
}

function saveStudentFromModal() {
  const regNo = document.getElementById('stuRegNo').value.trim();
  const name = document.getElementById('stuName').value.trim();
  const attendance = document.getElementById('stuAttendance').value;
  const errEl = document.getElementById('stuRegNoErr');

  if (!regNo) {
    errEl.textContent = 'Register number is required.';
    errEl.style.display = 'block';
    document.getElementById('stuRegNo').classList.add('invalid');
    return;
  }
  const duplicate = STATE.students.find(s => s.regNo.toLowerCase() === regNo.toLowerCase() && s.id !== editingStudentId);
  if (duplicate) {
    errEl.textContent = 'Register number already exists. Please enter a unique register number.';
    errEl.style.display = 'block';
    document.getElementById('stuRegNo').classList.add('invalid');
    return;
  }
  if (!name) {
    showToast('Student name is required.', 'error');
    return;
  }

  if (editingStudentId) {
    const s = STATE.students.find(s => s.id === editingStudentId);
    s.regNo = regNo; s.name = name; s.attendance = attendance;
    showToast('Student updated.', 'success');
  } else {
    if (STATE.students.length >= MAX_STUDENTS) {
      showToast('Maximum of ' + MAX_STUDENTS + ' students reached.', 'error');
      closeModal();
      return;
    }
    STATE.students.push({ id: uid('stu'), regNo, name, attendance });
    showToast('Student added.', 'success');
  }
  closeModal();
  saveState();
  renderPage(); // full re-render to update counts/header everywhere relevant
}

function deleteStudent(studentId) {
  const student = STATE.students.find(s => s.id === studentId);
  if (!student) return;
  showModal({
    title: 'Delete Student',
    bodyHtml: `<p>Remove <strong>${escapeHtml(student.name)}</strong> (${escapeHtml(student.regNo)})? This also removes all of their entered marks. This cannot be undone.</p>`,
    confirmText: 'Delete',
    danger: true,
    onConfirm: () => {
      STATE.students = STATE.students.filter(s => s.id !== studentId);
      STATE.assessments.forEach(a => { delete a.marks[studentId]; });
      saveState();
      showToast('Student deleted.', 'success');
      renderPage();
    }
  });
}

/* ---------- CSV Import ---------- */
function handleStudentCsvImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error('Empty file');

      let startIdx = 0;
      const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
      if (firstCols.some(c => c.includes('register') || c.includes('name'))) startIdx = 1;

      let added = 0, skipped = 0;
      for (let i = startIdx; i < lines.length; i++) {
        if (STATE.students.length >= MAX_STUDENTS) { skipped++; continue; }
        const cols = lines[i].split(',').map(c => c.trim());
        const regNo = cols[0] || '';
        const name = cols[1] || '';
        const attRaw = (cols[2] || 'present').toLowerCase();
        const attendance = attRaw.startsWith('a') ? 'absent' : 'present';
        if (!regNo || !name) { skipped++; continue; }
        if (STATE.students.some(s => s.regNo.toLowerCase() === regNo.toLowerCase())) { skipped++; continue; }
        STATE.students.push({ id: uid('stu'), regNo, name, attendance });
        added++;
      }
      saveState();
      showToast(`Imported ${added} student(s).` + (skipped ? ` ${skipped} skipped (duplicate, invalid, or over limit).` : ''), added > 0 ? 'success' : 'error');
      renderPage();
    } catch (err) {
      showToast('Could not read CSV file. Expected columns: Register Number, Name, Attendance.', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
