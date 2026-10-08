import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/helpers';

export default function Reports() {
  const { data } = useApp();
  const published = data.notices.filter((n) => n.status === 'published');
  const faculty = data.users.filter((u) => u.role === 'faculty' || u.role === 'admin');

  // activity per faculty member
  const facultyRows = faculty.map((f) => {
    const mine = published.filter((n) => n.createdBy === f.id);
    return {
      name: f.name,
      notices: mine.length,
      materials: data.materials.filter((m) => m.uploadedBy === f.id).length,
    };
  });

  function exportCSV() {
    const rows = [['Name', 'Notices posted', 'Materials uploaded']];
    facultyRows.forEach((r) => rows.push([r.name, r.notices, r.materials]));
    downloadCSV('faculty_activity_report.csv', rows);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Reports</h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-bold">Faculty activity</div>
        <div className="table-responsive">
          <table className="table mb-0">
            <thead><tr><th>Name</th><th>Notices</th><th>Materials</th></tr></thead>
            <tbody>
              {facultyRows.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td>{r.notices}</td><td>{r.materials}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}
