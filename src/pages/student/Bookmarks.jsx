import { useApp } from '../../context/AppContext';
import NoticeCard from '../../components/NoticeCard';
import { openMaterial } from './Materials';

export default function Bookmarks() {
  const { data, user, recordView, getMaterialUrl, toggleBookmark } = useApp();
  const mine = data.bookmarks.filter((b) => b.userId === user.id);
  const notices = mine.filter((b) => b.type === 'notice').map((b) => data.notices.find((n) => n.id === b.itemId)).filter(Boolean);
  const materials = mine.filter((b) => b.type === 'material').map((b) => data.materials.find((m) => m.id === b.itemId)).filter(Boolean);

  function isRead(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id);
  }
  function isAcked(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id && r.ackAt);
  }

  return (
    <>
      <h4 className="mb-3">Bookmarks</h4>
      {notices.length === 0 && materials.length === 0 && <p className="text-muted">Nothing saved yet.</p>}

      {notices.length > 0 && <h6>Saved notices</h6>}
      {notices.map((n) => <NoticeCard key={n.id} notice={n} read={isRead(n)} acked={isAcked(n)} />)}

      {materials.length > 0 && <h6 className="mt-3">Saved materials</h6>}
      <ul className="list-group">
        {materials.map((m) => (
          <li className="list-group-item d-flex justify-content-between align-items-center" key={m.id}>
            <span><i className="bi bi-file-earmark-text me-2"></i>{m.title}</span>
            <span className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => openMaterial(m, recordView, getMaterialUrl)}>Open</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => toggleBookmark('material', m.id)}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
