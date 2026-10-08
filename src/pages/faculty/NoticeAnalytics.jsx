import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { downloadCSV, fmtDateTime, noticeStats } from '../../utils/helpers';

export default function NoticeAnalytics() {
  const { id } = useParams();
  const { data } = useApp();
  const [tab, setTab] = useState('unread');
  const [message, setMessage] = useState('');

  const notice = data.notices.find((n) => n.id === Number(id));
  if (!notice) return <p>Notice not found.</p>;

  const s = noticeStats(data, notice);

  function readInfo(userId) {
    return s.reads.find((r) => r.userId === userId);
  }

  function remind() {
    // Demo only. With the backend this triggers push notifications / email.
    setMessage('Reminder sent to ' + s.unreadUsers.length + ' students.');
  }

  function exportCSV() {
    const rows = [['Name', 'Email', 'Section', 'Status', 'Read at', 'Acknowledged at']];
    s.students.forEach((st) => {
      const r = readInfo(st.id);
      rows.push([st.name, st.email, st.section, r ? 'Read' : 'Unread', r ? fmtDateTime(r.readAt) : '', r && r.ackAt ? fmtDateTime(r.ackAt) : '']);
    });
    downloadCSV('notice_' + notice.id + '_receipts.csv', rows);
  }

  const shown = tab === 'read' ? s.readUsers : s.unreadUsers;

  return (
    <div style={{ maxWidth: 800 }}>
      <Link to="/faculty/notices" className="small">&larr; My notices</Link>
      <h4 className="mt-2">{notice.title}</h4>

      <div className="card p-3 mb-3">
        <div className="d-flex justify-content-between">
          <b>{s.readUsers.length} of {s.students.length} students read this ({s.percent}%)</b>
          {notice.needsAck && <span className="text-muted small">{s.ackCount} acknowledged</span>}
        </div>
        <div className="bar-track mt-2"><div className="bar-fill" style={{ width: s.percent + '%' }}></div></div>
      </div>

      {message && <div className="alert alert-success py-2">{message}</div>}

      <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <ul className="nav nav-pills">
          <li className="nav-item"><button className={'nav-link' + (tab === 'unread' ? ' active' : '')} onClick={() => setTab('unread')}>Unread ({s.unreadUsers.length})</button></li>
          <li className="nav-item"><button className={'nav-link' + (tab === 'read' ? ' active' : '')} onClick={() => setTab('read')}>Read ({s.readUsers.length})</button></li>
        </ul>
        <div className="d-flex gap-2">
          <button className="btn btn-warning btn-sm" onClick={remind} disabled={s.unreadUsers.length === 0}>Remind unread</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <table className="table bg-white">
        <thead><tr><th>Name</th><th>Section</th><th>{tab === 'read' ? 'Read at' : 'Status'}</th>{tab === 'read' && notice.needsAck && <th>Acknowledged</th>}</tr></thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan="4" className="text-muted">No students here.</td></tr>}
          {shown.map((st) => {
            const r = readInfo(st.id);
            return (
              <tr key={st.id}>
                <td>{st.name}</td>
                <td>{st.section}</td>
                <td>{tab === 'read' ? fmtDateTime(r.readAt) : 'Not read yet'}</td>
                {tab === 'read' && notice.needsAck && <td>{r.ackAt ? 'Yes' : 'No'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
