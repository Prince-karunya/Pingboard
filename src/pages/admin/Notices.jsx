import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PriorityBadge from '../../components/PriorityBadge';
import { audienceText, cap, fmtDateTime, userName } from '../../utils/helpers';

// Admin moderation: see every notice, pin important ones, remove inappropriate ones
export default function Notices() {
  const { data, togglePin, deleteNotice } = useApp();
  const list = [...data.notices].sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt));

  function handleDelete(n) {
    if (window.confirm('Remove "' + n.title + '"?')) deleteNotice(n.id);
  }

  return (
    <>
      <h4 className="mb-3">All Notices (moderation)</h4>
      <div className="table-responsive">
        <table className="table bg-white align-middle">
          <thead><tr><th>Title</th><th>By</th><th>Audience</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {list.map((n) => {
              return (
                <tr key={n.id}>
                  <td>
                    {n.pinned && <i className="bi bi-pin-angle-fill text-danger me-1"></i>}
                    <Link to={'/notices/' + n.id} className="text-decoration-none">{n.title}</Link>{' '}
                    <PriorityBadge priority={n.priority} /> <span className="badge bg-secondary">{cap(n.category)}</span>
                  </td>
                  <td>{userName(data, n.createdBy)}</td>
                  <td className="small">{audienceText(n)}</td>
                  <td className="small">{n.status === 'draft' ? 'Draft' : fmtDateTime(n.publishAt)}</td>
                  <td className="text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => togglePin(n.id)}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(n)}>Remove</button>
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
