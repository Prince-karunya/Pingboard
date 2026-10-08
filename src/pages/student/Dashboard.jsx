import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import StatCard from '../../components/StatCard';
import NoticeCard from '../../components/NoticeCard';
import { fmtDate, sortNotices, todayKey, userCourses, visibleNotices } from '../../utils/helpers';

export default function Dashboard() {
  const { data, user } = useApp();
  const mine = visibleNotices(data, user);

  function isRead(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id);
  }
  function isAcked(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id && r.ackAt);
  }

  const unread = mine.filter((n) => !isRead(n));
  const pinned = sortNotices(mine).filter((n) => n.priority === 'urgent' || n.pinned).slice(0, 2);
  const deadlines = mine
    .filter((n) => n.dueDate && n.dueDate >= todayKey())
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const myCourseIds = userCourses(data, user).map((c) => c.id);
  const recent = data.materials
    .filter((m) => myCourseIds.includes(m.courseId) && m.visibility === 'published')
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, 4);

  return (
    <>
      <h4 className="mb-3">Welcome, {user.name.split(' ')[0]}</h4>

      <div className="row g-3 mb-4">
        <StatCard label="Unread notices" value={unread.length} icon="bi-envelope" color="primary" />
        <StatCard label="Upcoming deadlines" value={deadlines.length} icon="bi-calendar-event" color="warning" />
        <StatCard label="Total notices" value={mine.length} icon="bi-megaphone" color="success" />
        <StatCard label="New materials" value={recent.length} icon="bi-folder" color="info" />
      </div>

      {pinned.length > 0 && (
        <>
          <h6 className="text-danger">Urgent / pinned</h6>
          {pinned.map((n) => <NoticeCard key={n.id} notice={n} read={isRead(n)} acked={isAcked(n)} />)}
        </>
      )}

      <div className="row g-3 mt-1">
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6>Upcoming deadlines</h6>
            {deadlines.length === 0 && <p className="text-muted small mb-0">No deadlines.</p>}
            <ul className="list-unstyled mb-0">
              {deadlines.map((n) => (
                <li key={n.id} className="py-1 border-bottom">
                  <Link to={'/notices/' + n.id} className="text-decoration-none">{n.title}</Link>
                  <span className="float-end text-muted small">{fmtDate(n.dueDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 h-100">
            <h6>Recently added materials</h6>
            {recent.length === 0 && <p className="text-muted small mb-0">No materials yet.</p>}
            <ul className="list-unstyled mb-0">
              {recent.map((m) => (
                <li key={m.id} className="py-1 border-bottom">
                  <i className="bi bi-file-earmark-text me-2"></i>{m.title}
                  <span className="float-end text-muted small">{fmtDate(m.uploadedAt)}</span>
                </li>
              ))}
            </ul>
            <Link to="/student/materials" className="small mt-2">Open all materials</Link>
          </div>
        </div>
      </div>
    </>
  );
}
