import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { cap, fmtDateTime, issuerName } from '../utils/helpers';
import PriorityBadge from './PriorityBadge';

export default function NoticeCard({ notice, read, acked }) {
  const { data, getNoticeImageUrl } = useApp();
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => {
    let active = true;
    if (notice.imagePath) getNoticeImageUrl(notice).then((url) => { if (active && url) setImageUrl(url); });
    return () => { active = false; };
  }, [notice.id, notice.imagePath]);
  return (
    <div className={'notice-card ' + notice.priority + (read ? '' : ' unread')}>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <h6 className="mb-1">
          {notice.pinned && <i className="bi bi-pin-angle-fill text-danger me-1"></i>}
          {notice.title}
        </h6>
        <div className="d-flex gap-1">
          {!read && <span className="badge bg-success">NEW</span>}
          {notice.needsAck && !acked && <span className="badge bg-dark">Ack required</span>}
          <PriorityBadge priority={notice.priority} />
          <span className="badge bg-secondary">{cap(notice.category)}</span>
        </div>
      </div>
      <p className="text-muted small mb-2">
        {issuerName(data, notice.createdBy)} &middot; {fmtDateTime(notice.publishAt)}
      </p>
      <p className="mb-2">{notice.body.length > 140 ? notice.body.slice(0, 140) + '...' : notice.body}</p>
      {imageUrl && <img src={imageUrl} alt={`Image attached to ${notice.title}`} className="img-fluid rounded mb-2" style={{ maxHeight: 320 }} />}
      <Link to={'/notices/' + notice.id} className="btn btn-sm btn-primary">Read</Link>
    </div>
  );
}
