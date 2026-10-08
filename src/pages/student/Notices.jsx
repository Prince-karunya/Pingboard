import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import NoticeCard from '../../components/NoticeCard';
import { CATEGORIES, cap, sortNotices, visibleNotices } from '../../utils/helpers';

export default function Notices() {
  const { data, user } = useApp();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  function isRead(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id);
  }
  function isAcked(n) {
    return data.reads.some((r) => r.noticeId === n.id && r.userId === user.id && r.ackAt);
  }

  let list = visibleNotices(data, user);
  if (tab === 'unread') list = list.filter((n) => !isRead(n));
  if (tab === 'acknowledged') list = list.filter((n) => isAcked(n));
  if (category) list = list.filter((n) => n.category === category);
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }
  list = sortNotices(list);

  return (
    <>
      <h4 className="mb-3">Notices</h4>

      <ul className="nav nav-pills mb-3">
        {['all', 'unread', 'acknowledged'].map((t) => (
          <li className="nav-item" key={t}>
            <button className={'nav-link' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{cap(t)}</button>
          </li>
        ))}
      </ul>

      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <input className="form-control" placeholder="Search notices..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 && <p className="text-muted">No notices found.</p>}
      {list.map((n) => <NoticeCard key={n.id} notice={n} read={isRead(n)} acked={isAcked(n)} />)}
    </>
  );
}
