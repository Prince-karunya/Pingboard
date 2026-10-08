import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MCA_COHORTS, MCA_DEPARTMENT } from '../../utils/mcaCohorts';
import { parseCsv } from '../../utils/csv';
import LoadingIndicator from '../../components/LoadingIndicator';

const emptyForm = {
  name: '', email: '', password: '', rollNo: '', cohort: 'AMCA',
};

export default function Students() {
  const { data, user, getHodStudents, manageStudents, exportCourseStudents } = useApp();
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const hodCourses = data.courses.filter((course) =>
    [course.department, course.programCode].some((value) =>
      String(value || '').trim().toLowerCase() === String(user.department || '').trim().toLowerCase()));

  async function refreshStudents() {
    setStudentsLoading(true);
    try {
      const result = await getHodStudents();
      if (result) setStudents(result);
    } finally {
      setStudentsLoading(false);
    }
  }

  useEffect(() => {
    refreshStudents();
  }, []);

  const selectedCourse = hodCourses.find((course) => String(course.id) === courseId);
  const query = search.trim().toLowerCase();
  const visibleStudents = students.filter((student) => (
    (!cohortFilter || student.section === cohortFilter)
    && (!selectedCourse || (
      student.program_code === selectedCourse.programCode
      && student.year === selectedCourse.year
      && (!selectedCourse.section || student.section === selectedCourse.section)
    ))
    && (!query || student.name.toLowerCase().includes(query)
      || student.email.toLowerCase().includes(query)
      || student.roll_no.toLowerCase().includes(query))
  ));

  async function addStudent(event) {
    event.preventDefault();
    const cohort = MCA_COHORTS.find((item) => item.section === form.cohort);
    if (!cohort) return;
    const result = await manageStudents('create', {
      student: {
        ...form, department: MCA_DEPARTMENT, programCode: 'mca',
        year: cohort.year, section: cohort.section,
      },
    });
    if (!result) return;
    setForm(emptyForm);
    setMessage('Student account created.');
    refreshStudents();
  }

  function downloadCsvTemplate() {
    const csv = 'name,email,password,rollNo,cohort\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mca-student-accounts-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importStudents(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setMessage('');
    setBulkBusy(true);
    try {
      const rows = parseCsv(await file.text());
      const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]/g, ''));
      const requiredHeaders = ['name', 'email', 'password', 'rollno', 'cohort'];
      if (!headers || requiredHeaders.some((header) => !headers.includes(header))) {
        throw new Error('CSV headers must include name,email,password,rollNo,cohort.');
      }
      if (rows.length > 100) throw new Error('Upload at most 100 student accounts at a time.');

      const emails = new Set();
      const rollNumbers = new Set();
      const studentsToCreate = rows.map((row, index) => {
        const rowLabel = `CSV row ${index + 2}`;
        const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
        if (!record.name) throw new Error(`${rowLabel}: enter a student name.`);
        if (!/^[^@\s]+@gmail\.com$/i.test(record.email)) {
          throw new Error(`${rowLabel}: enter a valid Gmail address.`);
        }
        if (record.password.length < 8) {
          throw new Error(`${rowLabel}: password must be at least 8 characters.`);
        }
        if (!record.rollno) throw new Error(`${rowLabel}: enter a roll number.`);
        const cohort = MCA_COHORTS.find((item) => item.section === record.cohort.toUpperCase());
        if (!cohort) throw new Error(`${rowLabel}: cohort must be AMCA or NMCA.`);

        const email = record.email.toLowerCase();
        const rollNo = record.rollno.toLowerCase();
        if (emails.has(email)) throw new Error(`${rowLabel}: this email appears more than once in the CSV.`);
        if (rollNumbers.has(rollNo)) throw new Error(`${rowLabel}: this roll number appears more than once in the CSV.`);
        emails.add(email);
        rollNumbers.add(rollNo);

        return {
          name: record.name,
          email: record.email,
          password: record.password,
          rollNo: record.rollno,
          department: MCA_DEPARTMENT,
          programCode: 'mca',
          year: cohort.year,
          section: cohort.section,
        };
      });
      if (!studentsToCreate.length) throw new Error('The CSV file has no student rows.');

      const result = await manageStudents('create-bulk', { students: studentsToCreate });
      if (!result) return;
      setMessage(`${result.created.length} student accounts created.`);
      await refreshStudents();
    } catch (importError) {
      setMessage(importError.message);
    } finally {
      setBulkBusy(false);
    }
  }

  async function editStudent(student) {
    const name = window.prompt('Student name:', student.name);
    if (name === null) return;
    const rollNo = window.prompt('Roll number:', student.roll_no);
    if (rollNo === null) return;
    const cohort = window.prompt('Section / year group (AMCA or NMCA):', student.section);
    if (cohort === null) return;
    const selectedCohort = MCA_COHORTS.find((item) => item.section === cohort.trim().toUpperCase());
    if (!selectedCohort) {
      setMessage('Choose AMCA or NMCA.');
      return;
    }
    const result = await manageStudents('update', {
      userId: student.user_id,
      changes: { name, rollNo, programCode: 'mca', year: selectedCohort.year, section: selectedCohort.section },
    });
    if (result) {
      setMessage('Student details updated.');
      refreshStudents();
    }
  }

  async function changePassword(student) {
    const password = window.prompt(`Enter a new password for ${student.name} (at least 8 characters):`);
    if (password === null) return;
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (await manageStudents('update', { userId: student.user_id, changes: { password } })) {
      setMessage(`Password for ${student.name} updated.`);
    }
  }

  async function deactivateStudent(student) {
    if (!window.confirm(`Deactivate ${student.name}'s student account?`)) return;
    if (await manageStudents('deactivate', { userId: student.user_id })) {
      setMessage(`${student.name}'s account deactivated.`);
      refreshStudents();
    }
  }

  async function activateStudent(student) {
    if (await manageStudents('update', { userId: student.user_id, changes: { active: true } })) {
      setMessage(`${student.name}'s account activated.`);
      refreshStudents();
    }
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Permanently delete ${student.name}'s account? This also removes their saved calendar events, bookmarks, and read receipts.`)) return;
    if (await manageStudents('delete', { userId: student.user_id })) {
      setMessage(`${student.name}'s account permanently deleted.`);
      refreshStudents();
    }
  }

  async function downloadEmails() {
    if (!selectedCourse) return;
    const rows = await exportCourseStudents(selectedCourse.id, selectedCourse.year);
    if (!rows) return;
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Student emails');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Email', key: 'email', width: 36 },
      { header: 'Roll number', key: 'roll_no', width: 20 },
      { header: 'Department', key: 'department', width: 14 },
      { header: 'Program', key: 'program_code', width: 14 },
      { header: 'Year', key: 'year', width: 12 },
      { header: 'Section', key: 'section', width: 12 },
    ];
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    const bytes = await workbook.xlsx.writeBuffer();
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `student-emails-MCA-${selectedCourse.section}.xlsx`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${rows.length} student emails exported.`);
  }

  return (
    <>
      <h4 className="mb-2">Department students</h4>
      <p className="text-muted">Manage MCA department student accounts for AMCA (Year 1) and NMCA (Year 2).</p>
      {message && <div className="alert alert-info py-2">{message}</div>}

      <form onSubmit={addStudent} className="card p-3 mb-3">
        <h6>Add student</h6>
        <div className="row g-2">
          <div className="col-md-3"><input required className="form-control" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="col-md-3"><input required className="form-control" type="email" placeholder="Student Gmail" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div className="col-md-2"><input required minLength="8" className="form-control" type="password" placeholder="Password (8+ chars)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
          <div className="col-md-2"><input required className="form-control" placeholder="Roll number" value={form.rollNo} onChange={(event) => setForm({ ...form, rollNo: event.target.value })} /></div>
          <div className="col-md-2"><select className="form-select" value={form.cohort} onChange={(event) => setForm({ ...form, cohort: event.target.value })}>
            {MCA_COHORTS.map((item) => <option key={item.section} value={item.section}>{item.label}</option>)}
          </select></div>
          <div className="col-md-2"><button className="btn btn-primary">Create student account</button></div>
        </div>
      </form>

      <section className="card p-3 mb-3" aria-labelledby="bulk-student-title">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h6 id="bulk-student-title" className="mb-1">Register students in bulk</h6>
            <p className="small text-muted mb-0">Upload a CSV with name, email, password, rollNo, and cohort (AMCA or NMCA). Up to 100 students per upload.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={downloadCsvTemplate}>Download CSV template</button>
        </div>
        <label className="form-label small mt-3 mb-1" htmlFor="student-csv">Student account CSV</label>
        <input id="student-csv" type="file" accept=".csv,text/csv" className="form-control"
          disabled={bulkBusy} onChange={importStudents} />
        {bulkBusy && <LoadingIndicator label="Validating CSV and creating student accounts..." />}
        <small className="text-warning mt-2">The CSV contains temporary passwords. Store it securely and delete it after upload.</small>
      </section>

      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" placeholder="Search by name, Gmail, or roll number" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="col-md-3">
          <select className="form-select" value={cohortFilter} onChange={(event) => setCohortFilter(event.target.value)}>
            <option value="">All MCA cohorts</option>
            {MCA_COHORTS.map((item) => <option key={item.section} value={item.section}>{item.label}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={courseId} onChange={(event) => {
            setCourseId(event.target.value);
            const course = hodCourses.find((item) => String(item.id) === event.target.value);
            if (course) setCohortFilter(course.section);
          }}>
            <option value="">All MCA courses</option>
            {hodCourses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.section}</option>)}
          </select>
        </div>
        <div className="col-md-2"><button className="btn btn-outline-primary w-100" disabled={!selectedCourse} onClick={downloadEmails}>Export course emails</button></div>
      </div>

      <div className="table-responsive">
        <table className="table bg-white align-middle">
          <thead><tr><th>Name</th><th>Email</th><th>Roll number</th><th>Department</th><th>Year</th><th>Section</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {studentsLoading && <tr><td colSpan="8"><LoadingIndicator label="Loading student accounts..." centered /></td></tr>}
            {visibleStudents.map((student) => (
              <tr key={student.user_id}>
                <td>{student.name}</td>
                <td className="small">{student.email}</td>
                <td>{student.roll_no}</td>
                <td>{MCA_DEPARTMENT}</td>
                <td>{student.year}</td>
                <td>{student.section}</td>
                <td>{student.active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                <td className="text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => editStudent(student)}>Edit</button>
                  {student.active
                    ? <button className="btn btn-sm btn-outline-danger me-1" onClick={() => deactivateStudent(student)}>Deactivate</button>
                    : <button className="btn btn-sm btn-outline-success me-1" onClick={() => activateStudent(student)}>Activate</button>}
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => changePassword(student)}>Reset password</button>
                  <button className="btn btn-sm btn-danger ms-1" onClick={() => deleteStudent(student)}>Delete</button>
                </td>
              </tr>
            ))}
            {!studentsLoading && visibleStudents.length === 0 && <tr><td colSpan="8" className="text-center text-muted">No students found for this department and filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
