import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { todayKey, visibleNotices } from '../../utils/helpers';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const { data, user, addCalendarEvent, deleteCalendarEvent } = useApp();
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', eventDate: '' });
  const [message, setMessage] = useState('');

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = first.getDay();

  const events = visibleNotices(data, user).filter((n) => n.dueDate);
  const personalEvents = data.calendarEvents.filter((event) => event.userId === user.id);

  function keyFor(day) {
    return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  async function addWork(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate) {
      setMessage('Enter a task title and date.');
      return;
    }
    const added = await addCalendarEvent(form);
    if (added) {
      setForm({ title: '', description: '', eventDate: '' });
      setMessage('Calendar work added.');
    }
  }

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Calendar</h4>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset(offset - 1)}>&lt;</button>
          <b>{first.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</b>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset(offset + 1)}>&gt;</button>
        </div>
      </div>

      <form className="card p-3 mb-3" onSubmit={addWork}>
        <h6>Add personal work / reminder</h6>
        <div className="row g-2">
          <div className="col-md-4"><input required className="form-control" placeholder="Task or reminder" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Details (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="col-md-2"><input required type="date" className="form-control" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Add to calendar</button></div>
        </div>
        {message && <small className="text-muted mt-2">{message}</small>}
      </form>

      <div className="cal-grid mb-2">
        {DAY_NAMES.map((d) => <div className="cal-head" key={d}>{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={'e' + i}></div>;
          const key = keyFor(day);
          const todays = events.filter((n) => n.dueDate === key);
          const personal = personalEvents.filter((event) => event.eventDate === key);
          return (
            <div className={'cal-cell' + (key === todayKey() ? ' today' : '')} key={key}>
              <b>{day}</b>
              {todays.map((n) => (
                <Link key={n.id} to={'/notices/' + n.id} className="cal-event" title={n.title}>{n.title}</Link>
              ))}
              {personal.map((event) => (
                <div key={event.id} className="cal-event d-flex justify-content-between align-items-center gap-1" title={event.description || event.title}>
                  <span>{event.title}</span>
                  <button type="button" className="btn-close" aria-label={'Delete ' + event.title}
                    onClick={() => deleteCalendarEvent(event.id)} style={{ transform: 'scale(.65)' }} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
