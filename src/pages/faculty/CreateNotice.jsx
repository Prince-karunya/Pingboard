import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { CATEGORIES, PRIORITIES, userCourses, cap } from '../../utils/helpers';

export default function CreateNotice() {
  const { data, user, isHod, createNotice } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courses = userCourses(data, isHod ? { ...user, role: 'admin' } : user);
  const requestedCourseId = searchParams.get('courseId');
  const initialCourseId = courses.some((course) => String(course.id) === requestedCourseId)
    ? Number(requestedCourseId) : courses[0]?.id || '';
  const [form, setForm] = useState({
    title: '', body: '', category: 'general', priority: 'normal',
    scope: 'course', courseId: initialCourseId, dueDate: '', needsAck: false, schedule: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  const selectedCourse = courses.find((course) => course.id === Number(form.courseId));
  const recipients = data.users.filter((student) => student.role === 'student' && student.active && (
    form.scope === 'college' && isHod
      ? true
      : selectedCourse && student.programCode === selectedCourse.programCode
        && student.year === selectedCourse.year && (!selectedCourse.section || student.section === selectedCourse.section)
  ));

  async function save(status) {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and details are required.');
      return;
    }
    if (form.scope === 'course' && !selectedCourse) {
      setError('Choose one of your assigned courses.');
      return;
    }
    const publishAt = form.schedule ? new Date(form.schedule).toISOString() : new Date().toISOString();
    const created = await createNotice({
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: form.priority,
      department: form.scope === 'course' ? selectedCourse.department : '',
      year: form.scope === 'course' ? selectedCourse.year : '',
      section: form.scope === 'course' ? selectedCourse.section : '',
      courseId: form.scope === 'course' ? selectedCourse.id : null,
      imageFile,
      dueDate: form.dueDate,
      needsAck: form.needsAck,
      status: status,
      publishAt: publishAt,
    });
    if (created) navigate('/faculty/notices');
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h4 className="mb-3">Create Notice</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card p-3">
        <label className="small text-muted">Title</label>
        <input className="form-control mb-3" name="title" value={form.title} onChange={handleChange} />

        <label className="small text-muted">Details</label>
        <textarea className="form-control mb-3" rows="6" name="body" value={form.body} onChange={handleChange} />

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="small text-muted">Category</label>
            <select className="form-select" name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="small text-muted">Priority</label>
            <select className="form-select" name="priority" value={form.priority} onChange={handleChange}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
            </select>
          </div>
        </div>

        <label className="small text-muted">Audience</label>
        {isHod && <select className="form-select mb-2" name="scope" value={form.scope} onChange={handleChange}>
          <option value="course">A course and year</option>
          <option value="college">Main college notice (all students)</option>
        </select>}
        {form.scope === 'course' && <select className="form-select mb-2" name="courseId" value={form.courseId} onChange={handleChange}>
          <option value="">Choose a course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>
            {course.name} - {course.programCode.toUpperCase()} Year {course.year}{course.section ? ` Section ${course.section}` : ''}
          </option>)}
        </select>}
        <p className="small text-primary mb-3"><i className="bi bi-people me-1"></i>{recipients.length} students will receive this notice</p>

        <label className="small text-muted">Notice image (optional)</label>
        <input className="form-control mb-3" type="file" accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setImageFile(e.target.files[0] || null)} />

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="small text-muted">Due date (optional)</label>
            <input type="date" className="form-control" name="dueDate" value={form.dueDate} onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label className="small text-muted">Schedule for later (optional)</label>
            <input type="datetime-local" className="form-control" name="schedule" value={form.schedule} onChange={handleChange} />
          </div>
        </div>

        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" id="ack" name="needsAck" checked={form.needsAck} onChange={handleChange} />
          <label className="form-check-label" htmlFor="ack">Require acknowledgement ("I understand" button)</label>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={() => save('published')}>{form.schedule ? 'Schedule' : 'Publish now'}</button>
          <button className="btn btn-outline-secondary" onClick={() => save('draft')}>Save as draft</button>
        </div>
      </div>
    </div>
  );
}
