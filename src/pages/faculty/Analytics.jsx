import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import Bar from '../../components/Bar';
import { CATEGORIES, cap, noticeStats, userCourses } from '../../utils/helpers';
import { MCA_COHORTS } from '../../utils/mcaCohorts';

export default function Analytics() {
  const { data, user, isHod, exportCourseStudents } = useApp();
  const accessibleCourses = userCourses(data, isHod ? { ...user, role: 'admin' } : user);
  const courses = isHod ? accessibleCourses.filter((course) =>
    [course.department, course.programCode].some((value) =>
      String(value || '').trim().toLowerCase() === String(user.department || '').trim().toLowerCase()))
    : accessibleCourses;
  const [courseId, setCourseId] = useState('');
  const [year, setYear] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const myNotices = data.notices.filter((n) => n.createdBy === user.id && n.status === 'published');
  const myMaterials = data.materials.filter((m) => m.uploadedBy === user.id);

  const sectionStats = MCA_COHORTS.map(({ section, label }) => {
    let total = 0;
    let read = 0;
    myNotices.forEach((n) => {
      const s = noticeStats(data, n);
      const inSec = s.students.filter((st) => st.section === section);
      total += inSec.length;
      read += inSec.filter((st) => s.readUsers.some((r) => r.id === st.id)).length;
    });
    return { section, label, percent: total ? Math.round((read * 100) / total) : 0 };
  });

  const viewsPerMaterial = myMaterials
    .map((m) => ({ title: m.title, views: data.views.filter((v) => v.materialId === m.id).length }))
    .sort((a, b) => b.views - a.views);
  const maxViews = viewsPerMaterial.length ? viewsPerMaterial[0].views : 0;

  async function downloadRoster() {
    const students = await exportCourseStudents(Number(courseId), year);
    if (!students) return;
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
    sheet.addRows(students);
    sheet.getRow(1).font = { bold: true };
    const bytes = await workbook.xlsx.writeBuffer();
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'student-emails-MCA-' + courses.find((course) => course.id === Number(courseId))?.section + '.xlsx';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage(`${students.length} student emails exported.`);
  }

  return (
    <>
      <h4 className="mb-3">Analytics</h4>
      {isHod && <div className="card p-3 mb-3">
        <h6>Download student email list</h6>
        <p className="small text-muted">HOD access only. Export student emails for an MCA course and year.</p>
        <div className="row g-2">
          <div className="col-md-5">
            <select className="form-select" value={courseId} onChange={(e) => {
              setCourseId(e.target.value);
              const selected = courses.find((course) => String(course.id) === e.target.value);
              setYear(selected?.year || '');
            }}>
              <option value="">Choose subject/course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>
                {course.name} ({course.section})
              </option>)}
            </select>
          </div>
          <div className="col-md-3"><input className="form-control" value={year ? `Year ${year}` : ''} placeholder="Year" readOnly /></div>
          <div className="col-md-4"><button className="btn btn-primary" disabled={!courseId || !year} onClick={downloadRoster}>Download Excel</button></div>
        </div>
        {exportMessage && <small className="text-success mt-2">{exportMessage}</small>}
      </div>}
      <div className="row g-3">
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6 className="mb-3">Read rate per notice</h6>
            {myNotices.length === 0 && <p className="text-muted small">No notices yet.</p>}
            {myNotices.map((n) => <Bar key={n.id} label={n.title} value={noticeStats(data, n).percent} max={100} suffix="%" />)}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6 className="mb-3">Most viewed materials</h6>
            {viewsPerMaterial.length === 0 && <p className="text-muted small">No materials yet.</p>}
            {viewsPerMaterial.map((m) => <Bar key={m.title} label={m.title} value={m.views} max={maxViews} suffix=" views" />)}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6 className="mb-3">Responsiveness by section</h6>
            {sectionStats.map((s) => <Bar key={s.section} label={s.label} value={s.percent} max={100} suffix="%" />)}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6 className="mb-3">My notices by category</h6>
            {CATEGORIES.map((c) => (
              <Bar key={c} label={cap(c)} value={myNotices.filter((n) => n.category === c).length} max={Math.max(myNotices.length, 1)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
