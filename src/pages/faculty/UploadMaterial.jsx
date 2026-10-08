import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { userCourses } from '../../utils/helpers';

export default function UploadMaterial() {
  const { data, user, isHod, addMaterial, createNotice } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courses = userCourses(data, isHod ? { ...user, role: 'admin' } : user);
  const requestedCourseId = searchParams.get('courseId');
  const initialCourseId = courses.some((course) => String(course.id) === requestedCourseId)
    ? Number(requestedCourseId) : courses[0]?.id || '';

  const [form, setForm] = useState({
    courseId: initialCourseId,
    unit: 'Unit 1', title: '', description: '', type: 'file', link: '',
    visibility: 'published', notify: true,
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function finish() {
    const courseId = Number(form.courseId);
    const added = await addMaterial({
      courseId, unit: form.unit, title: form.title.trim(), description: form.description.trim(),
      type: form.type, fileName: file ? file.name : '', file: form.type === 'file' ? file : null,
      link: form.link.trim(), visibility: form.visibility,
    });
    if (!added) return;

    // automatic notice so students know about the new material
    if (form.notify && form.visibility === 'published') {
      const course = data.courses.find((c) => c.id === courseId);
      const notice = await createNotice({
        title: 'New material: ' + form.title.trim(),
        body: form.unit + ' material has been uploaded for ' + course.name + '. Open the Materials page to view it.',
        category: 'general', priority: 'normal',
        department: course.department, year: course.year, section: course.section,
        dueDate: '', needsAck: false, status: 'published', publishAt: new Date().toISOString(),
      });
      if (!notice) {
        navigate('/faculty/materials');
        return;
      }
    }
    navigate('/faculty/materials');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.courseId) return setError('You have no course assigned. Ask the admin to assign one.');
    if (!form.title.trim()) return setError('Title is required.');
    if (form.type === 'file' && !file) return setError('Please choose a file.');
    if (form.type === 'link' && !form.link.trim()) return setError('Please enter a link.');

    await finish();
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
      <h4 className="mb-3">Upload Material</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card p-3">
        <div className="row g-2 mb-3">
          <div className="col-md-8">
            <label className="small text-muted">Course</label>
            <select className="form-select" name="courseId" value={form.courseId} onChange={handleChange}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} (Sec {c.section})</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="small text-muted">Unit</label>
            <input className="form-control" name="unit" value={form.unit} onChange={handleChange} />
          </div>
        </div>

        <label className="small text-muted">Title</label>
        <input className="form-control mb-3" name="title" value={form.title} onChange={handleChange} />

        <label className="small text-muted">Description (optional)</label>
        <input className="form-control mb-3" name="description" value={form.description} onChange={handleChange} />

        <div className="mb-3">
          <div className="form-check form-check-inline">
            <input className="form-check-input" type="radio" name="type" id="tf" value="file" checked={form.type === 'file'} onChange={handleChange} />
            <label className="form-check-label" htmlFor="tf">Upload file</label>
          </div>
          <div className="form-check form-check-inline">
            <input className="form-check-input" type="radio" name="type" id="tl" value="link" checked={form.type === 'link'} onChange={handleChange} />
            <label className="form-check-label" htmlFor="tl">External link</label>
          </div>
        </div>

        {form.type === 'file' ? (
          <div className="mb-3">
            <input className="form-control" type="file" accept=".ppt,.pptx,.pdf,.doc,.docx,.zip,.png,.jpg" onChange={(e) => setFile(e.target.files[0])} />
            <small className="text-muted">PPT, PDF, DOCX, ZIP or images (up to 50 MB).</small>
          </div>
        ) : (
          <input className="form-control mb-3" name="link" placeholder="https://..." value={form.link} onChange={handleChange} />
        )}

        <label className="small text-muted">Visibility</label>
        <select className="form-select mb-3" name="visibility" value={form.visibility} onChange={handleChange}>
          <option value="published">Publish now</option>
          <option value="draft">Keep as draft (hidden from students)</option>
        </select>

        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" id="notify" name="notify" checked={form.notify} onChange={handleChange} />
          <label className="form-check-label" htmlFor="notify">Notify students automatically</label>
        </div>

        <button className="btn btn-primary">Upload</button>
      </div>
    </form>
  );
}
