import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { audienceText, cap, fmtDate, fmtDateTime, inAudience, isPublished, issuerName } from '../utils/helpers';
import PriorityBadge from '../components/PriorityBadge';

export default function NoticeDetail() {
  const { id } = useParams();
  const noticeId = Number(id);
  const navigate = useNavigate();
  const { data, user, markRead, acknowledge, toggleBookmark, getNoticeImageUrl } = useApp();
  const notice = data.notices.find((n) => n.id === noticeId);
  const [imageUrl, setImageUrl] = useState('');

  // Opening the notice records the read receipt (students only)
  useEffect(() => {
    if (user.role === 'student' && notice) markRead(noticeId);
  }, [noticeId]);

  useEffect(() => {
    let active = true;
    if (notice?.imagePath) getNoticeImageUrl(notice).then((url) => { if (active && url) setImageUrl(url); });
    return () => { active = false; };
  }, [notice?.id, notice?.imagePath]);

  if (!notice) return <p>Notice not found.</p>;
  if (user.role === 'student' && !(isPublished(notice) && inAudience(notice, user))) {
    return <p>You do not have access to this notice.</p>;
  }

  const myRead = data.reads.find((r) => r.noticeId === noticeId && r.userId === user.id);
  const bookmarked = data.bookmarks.some((b) => b.userId === user.id && b.type === 'notice' && b.itemId === noticeId);
  const canSeeAnalytics = user.role === 'admin' || notice.createdBy === user.id;

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-link px-0 mb-2" onClick={() => navigate(-1)}>&larr; Back</button>
      <div className="card p-4">
        <div className="d-flex gap-2 mb-2 flex-wrap">
          <PriorityBadge priority={notice.priority} />
          <span className="badge bg-secondary">{cap(notice.category)}</span>
          {notice.status === 'draft' && <span className="badge bg-dark">Draft</span>}
        </div>
        <h4>{notice.title}</h4>
        <p className="text-muted small">
          Posted by {issuerName(data, notice.createdBy)} on {fmtDateTime(notice.publishAt)}<br />
          Audience: {audienceText(notice)}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{notice.body}</p>
        {imageUrl && <a href={imageUrl} target="_blank" rel="noreferrer">
          <img src={imageUrl} alt={`Image attached to ${notice.title}`} className="img-fluid rounded mb-3" />
        </a>}
        {notice.dueDate && (
          <div className="alert alert-warning py-2"><i className="bi bi-calendar-event me-2"></i>Due date: <b>{fmtDate(notice.dueDate)}</b></div>
        )}

        <div className="d-flex gap-2 flex-wrap mt-2">
          {user.role === 'student' && notice.needsAck && (
            myRead && myRead.ackAt ? (
              <span className="badge bg-success p-2"><i className="bi bi-check2-circle me-1"></i>You acknowledged this notice</span>
            ) : (
              <button className="btn btn-success" onClick={() => acknowledge(noticeId)}>I understand</button>
            )
          )}
          {user.role === 'student' && (
            <button className="btn btn-outline-primary" onClick={() => toggleBookmark('notice', noticeId)}>
              <i className={'bi me-1 ' + (bookmarked ? 'bi-bookmark-fill' : 'bi-bookmark')}></i>{bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
          )}
          {canSeeAnalytics && user.role === 'faculty' && (
            <Link to={'/faculty/notices/' + noticeId + '/analytics'} className="btn btn-outline-primary">View read receipts</Link>
          )}
        </div>
      </div>
    </div>
  );
}
