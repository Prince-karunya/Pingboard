import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { fmtDate, userCourses } from '../../utils/helpers';

export default function ManageMaterials() {
  const { data, user, isHod, updateMaterial, deleteMaterial } = useApp();
  const courses = userCourses(data, isHod ? { ...user, role: 'admin' } : user);

  function viewCount(id) {
    return data.views.filter((v) => v.materialId === id).length;
  }

  function replaceFile(m, file) {
    if (!file) return;
    updateMaterial(m.id, { file });
  }

  function handleDelete(m) {
    if (window.confirm('Delete "' + m.title + '"?')) deleteMaterial(m.id);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">My Materials</h4>
        <Link to="/faculty/materials/upload" className="btn btn-primary">+ Upload</Link>
      </div>

      {courses.map((c) => {
        const list = data.materials.filter((m) => m.courseId === c.id).sort((a, b) => a.unit.localeCompare(b.unit));
        return (
          <div className="card mb-3" key={c.id}>
            <div className="card-header fw-bold">{c.name} <span className="text-muted small">Sec {c.section}</span></div>
            {list.length === 0 && <div className="p-3 text-muted small">No materials yet.</div>}
            <ul className="list-group list-group-flush">
              {list.map((m) => (
                <li className="list-group-item" key={m.id}>
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <b>{m.title}</b> <span className="badge bg-light text-dark border">{m.unit}</span>
                      {m.version > 1 && <span className="badge bg-secondary ms-1">v{m.version}</span>}
                      {m.visibility === 'draft' && <span className="badge bg-dark ms-1">Hidden</span>}
                      <div className="small text-muted">
                        {m.type === 'link' ? m.link : m.fileName} &middot; {fmtDate(m.uploadedAt)} &middot; {viewCount(m.id)} views
                      </div>
                    </div>
                    <div className="d-flex gap-2 align-items-start flex-wrap">
                      {m.type === 'file' && (
                        <label className="btn btn-sm btn-outline-primary mb-0">
                          Replace file
                          <input type="file" hidden onChange={(e) => replaceFile(m, e.target.files[0])} />
                        </label>
                      )}
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => updateMaterial(m.id, { visibility: m.visibility === 'published' ? 'draft' : 'published' })}>
                        {m.visibility === 'published' ? 'Hide' : 'Publish'}
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(m)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {courses.length === 0 && <p className="text-muted">No courses assigned to you.</p>}
    </>
  );
}
