import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, userCourses } from '../../utils/helpers';

export async function openMaterial(m, recordView, getMaterialUrl) {
  if (!(await recordView(m.id))) return;
  if (m.type === 'link') {
    window.open(m.link, '_blank');
  } else {
    const url = await getMaterialUrl(m);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = m.fileName;
    a.click();
  }
}

export default function Materials() {
  const { data, user, recordView, getMaterialUrl, toggleBookmark } = useApp();
  const courses = userCourses(data, user);
  const [courseId, setCourseId] = useState(courses.length ? courses[0].id : null);

  if (courses.length === 0) return <p className="text-muted">No courses found for your class yet.</p>;

  const files = data.materials.filter((m) => m.courseId === courseId && m.visibility === 'published');
  const units = [...new Set(files.map((m) => m.unit))].sort();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  function isBookmarked(id) {
    return data.bookmarks.some((b) => b.userId === user.id && b.type === 'material' && b.itemId === id);
  }

  return (
    <>
      <h4 className="mb-3">Materials</h4>
      <ul className="nav nav-pills mb-3">
        {courses.map((c) => (
          <li className="nav-item" key={c.id}>
            <button className={'nav-link' + (courseId === c.id ? ' active' : '')} onClick={() => setCourseId(c.id)}>{c.name}</button>
          </li>
        ))}
      </ul>

      {units.length === 0 && <p className="text-muted">No materials uploaded for this course yet.</p>}

      {units.map((unit) => (
        <div className="card mb-3" key={unit}>
          <div className="card-header fw-bold"><i className="bi bi-folder2-open me-2"></i>{unit}</div>
          <ul className="list-group list-group-flush">
            {files.filter((m) => m.unit === unit).map((m) => (
              <li className="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2" key={m.id}>
                <div>
                  <i className={'me-2 bi ' + (m.type === 'link' ? 'bi-link-45deg' : 'bi-file-earmark-text')}></i>
                  <b>{m.title}</b>
                  {new Date(m.uploadedAt).getTime() > weekAgo && <span className="badge bg-success ms-2">New</span>}
                  {m.version > 1 && <span className="badge bg-secondary ms-2">v{m.version}</span>}
                  <div className="small text-muted">{m.description} &middot; {fmtDate(m.uploadedAt)}</div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={() => openMaterial(m, recordView, getMaterialUrl)}>
                    {m.type === 'link' ? 'Open' : 'Download'}
                  </button>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => toggleBookmark('material', m.id)}>
                    <i className={'bi ' + (isBookmarked(m.id) ? 'bi-bookmark-fill' : 'bi-bookmark')}></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
