import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import StatCard from '../../components/StatCard';
import { fmtDateTime, noticeStats, userCourses } from '../../utils/helpers';
import { MCA_COHORTS } from '../../utils/mcaCohorts';

export default function Dashboard() {
  const { data, user } = useApp();
  const courses = userCourses(data, user);
  const myNotices = data.notices
    .filter((n) => n.createdBy === user.id)
    .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt));
  const published = myNotices.filter((n) => n.status === 'published');
  const myMaterials = data.materials.filter((m) => m.uploadedBy === user.id);

  let avgRead = 0;
  if (published.length > 0) {
    const total = published.reduce((sum, n) => sum + noticeStats(data, n).percent, 0);
    avgRead = Math.round(total / published.length);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h4 className="mb-0">Welcome, {user.name}</h4>
        <div className="d-flex gap-2">
          <Link to="/faculty/notices/new" className="btn btn-primary"><i className="bi bi-plus-circle me-1"></i>New Notice</Link>
          <Link to="/faculty/materials/upload" className="btn btn-outline-primary"><i className="bi bi-upload me-1"></i>Upload Material</Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard label="My courses" value={courses.length} icon="bi-journal-text" />
        <StatCard label="Notices posted" value={published.length} icon="bi-megaphone" color="success" />
        <StatCard label="Average read rate" value={avgRead + '%'} icon="bi-eye" color="warning" />
        <StatCard label="Materials" value={myMaterials.length} icon="bi-folder" color="info" />
      </div>

      <div className="row g-3">
        <div className="col-md-5">
          <div className="card p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">My courses</h6>
              {courses.length > 0 && <span className="badge bg-light text-dark">{courses.length}</span>}
            </div>
            {courses.length === 0 ? (
              <p className="text-muted small mb-0">No courses are assigned yet. Contact the MCA administrator to get your courses added.</p>
            ) : (
              <div className="d-grid gap-2">
                {courses.map((course) => {
                  const cohort = MCA_COHORTS.find((item) => item.section === course.section);
                  const courseQuery = `?courseId=${course.id}`;
                  return (
                    <div key={course.id} className="border rounded p-2">
                      <div className="d-flex justify-content-between flex-wrap gap-1 mb-2">
                        <strong>{course.name}</strong>
                        <span className="small text-muted">{cohort?.label || `Year ${course.year}`}</span>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <Link to={`/faculty/notices/new${courseQuery}`} className="btn btn-sm btn-outline-primary">
                          <i className="bi bi-megaphone me-1" aria-hidden="true"></i>Post notice
                        </Link>
                        <Link to={`/faculty/materials/upload${courseQuery}`} className="btn btn-sm btn-outline-secondary">
                          <i className="bi bi-upload me-1" aria-hidden="true"></i>Share material
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="col-md-7">
          <div className="card p-3 h-100">
            <h6>Recent notices and read status</h6>
            {myNotices.length === 0 && <p className="text-muted small mb-0">You have not posted any notices.</p>}
            {myNotices.slice(0, 5).map((n) => {
              const s = noticeStats(data, n);
              return (
                <div key={n.id} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <Link to={'/faculty/notices/' + n.id + '/analytics'} className="text-decoration-none">{n.title}</Link>
                    <span className="small text-muted">{s.readUsers.length}/{s.students.length} read</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: s.percent + '%' }}></div></div>
                  <small className="text-muted">{n.status === 'draft' ? 'Draft' : fmtDateTime(n.publishAt)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
