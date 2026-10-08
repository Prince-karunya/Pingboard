import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PriorityBadge from '../../components/PriorityBadge';
import { audienceText, fmtDateTime, noticeStats } from '../../utils/helpers';

export default function MyNotices() {
  const { data, user, deleteNotice } = useApp();
  const list = data.notices
    .filter((n) => n.createdBy === user.id)
    .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt));

  function statusLabel(n) {
    if (n.status === 'draft') return <span className="badge bg-dark">Draft</span>;
    if (new Date(n.publishAt) > new Date()) return <span className="badge bg-info text-dark">Scheduled</span>;
    return <span className="badge bg-success">Published</span>;
  }

  function handleDelete(n) {
    if (window.confirm('Delete "' + n.title + '"?')) deleteNotice(n.id);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">My Notices</h4>
        <Link to="/faculty/notices/new" className="btn btn-primary">+ New Notice</Link>
      </div>

      {list.length === 0 && <p className="text-muted">You have not created any notices yet.</p>}

      <div className="table-responsive">
        <table className="table table-hover bg-white align-middle">
          <thead>
            <tr><th>Title</th><th>Audience</th><th>Date</th><th>Status</th><th>Read</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((n) => {
              const s = noticeStats(data, n);
              return (
                <tr key={n.id}>
                  <td><Link to={'/notices/' + n.id} className="text-decoration-none">{n.title}</Link> <PriorityBadge priority={n.priority} /></td>
                  <td className="small">{audienceText(n)}</td>
                  <td className="small">{fmtDateTime(n.publishAt)}</td>
                  <td>{statusLabel(n)}</td>
                  <td>{s.readUsers.length}/{s.students.length} ({s.percent}%)</td>
                  <td className="text-nowrap">
                    <Link to={'/faculty/notices/' + n.id + '/analytics'} className="btn btn-sm btn-outline-primary me-1">Receipts</Link>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(n)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
