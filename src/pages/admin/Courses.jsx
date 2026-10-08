import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { userName } from '../../utils/helpers';
import { MCA_COHORTS, MCA_DEPARTMENT } from '../../utils/mcaCohorts';

export default function Courses() {
  const { data, addCourse, deleteCourse } = useApp();
  const facultyList = data.users.filter((u) => u.role === 'faculty' && u.active);
  const [error, setError] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [form, setForm] = useState({
    name: '', courseCode: '', facultyId: facultyList.length ? facultyList[0].id : '',
    year: '1', section: 'AMCA',
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleAdd(e) {
    e.preventDefault();
    const cohort = MCA_COHORTS.find((item) => item.section === form.section);
    if (!form.name.trim() || !form.courseCode.trim() || !form.facultyId || !cohort) {
      setError('Course name, subject code, cohort, and faculty are required.');
      return;
    }
    const added = await addCourse({
      ...form, name: form.name.trim(), courseCode: form.courseCode.trim(),
      department: MCA_DEPARTMENT, programCode: 'mca', year: cohort.year,
      section: cohort.section, facultyId: Number(form.facultyId),
    });
    if (!added) return;
    setForm({ ...form, name: '' });
    setError('');
  }

  async function handleDelete(c) {
    if (window.confirm('Delete course "' + c.name + '" and its materials?')) await deleteCourse(c.id);
  }
  const cohorts = [...new Set(data.courses.map((course) => course.section))];
  const filteredCourses = data.courses.filter((course) =>
    (!cohortFilter || course.section === cohortFilter));

  return (
    <>
      <h4 className="mb-3">Courses</h4>

      <form onSubmit={handleAdd} className="card p-3 mb-3">
        <h6>Add course</h6>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <div className="row g-2">
          <div className="col-md-2"><input className="form-control" name="name" placeholder="Subject name" value={form.name} onChange={handleChange} /></div>
          <div className="col-md-2"><input className="form-control" name="courseCode" placeholder="Subject code" value={form.courseCode} onChange={handleChange} /></div>
          <div className="col-md-3">
            <select className="form-select" name="facultyId" value={form.facultyId} onChange={handleChange}>
              {facultyList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" name="section" value={form.section} onChange={(event) => {
              const cohort = MCA_COHORTS.find((item) => item.section === event.target.value);
              setForm({ ...form, section: event.target.value, year: cohort?.year || '' });
            }}>
              {MCA_COHORTS.map((cohort) => <option key={cohort.section} value={cohort.section}>{cohort.label}</option>)}
            </select>
          </div>
          <div className="col-auto"><button className="btn btn-primary">Add</button></div>
        </div>
      </form>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <select className="form-select" value={cohortFilter} onChange={(event) => setCohortFilter(event.target.value)}>
            <option value="">All MCA cohorts</option>
            {MCA_COHORTS.filter((cohort) => cohorts.includes(cohort.section))
              .map((cohort) => <option key={cohort.section} value={cohort.section}>{cohort.label}</option>)}
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table bg-white align-middle">
          <thead><tr><th>Subject</th><th>Faculty</th><th>Department</th><th>Year</th><th>Section</th><th></th></tr></thead>
          <tbody>
            {filteredCourses.map((c) => (
              <tr key={c.id}>
                <td>{c.name} <span className="text-muted small">({c.courseCode})</span></td>
                <td>{userName(data, c.facultyId)}</td>
                <td>{MCA_DEPARTMENT}</td>
                <td>{c.year}</td>
                <td>{c.section || 'All sections'}</td>
                <td><button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(c)}>Delete</button></td>
              </tr>
            ))}
            {filteredCourses.length === 0 && <tr><td colSpan="6" className="text-center text-muted">No courses match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
