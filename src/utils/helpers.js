export const CATEGORIES = ['general', 'exam', 'assignment', 'event', 'placement', 'holiday'];
export const PRIORITIES = ['normal', 'important', 'urgent'];

export function cap(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function userName(data, id) {
  const u = data.users.find((x) => x.id === id);
  if (u) return u.name;
  const issuer = data.issuers?.find((entry) => entry.id === id);
  return issuer ? issuer.name : 'Unknown';
}

export function issuerName(data, id) {
  const name = userName(data, id);
  return name === 'Unknown' ? 'Department staff' : name;
}

// A notice is visible only if it is published and its publish time has arrived
export function isPublished(n) {
  return n.status === 'published' && new Date(n.publishAt) <= new Date();
}

// Empty department / year / section means "everyone"
export function inAudience(n, u) {
  if (n.department && n.department !== u.department) return false;
  if (n.year && n.year !== u.year) return false;
  if (n.section && n.section !== u.section) return false;
  return true;
}

export function audienceText(n) {
  const dept = n.department || 'All departments';
  const year = n.year ? 'Year ' + n.year : 'All years';
  const sec = n.section ? 'Section ' + n.section : 'All sections';
  return dept + ' / ' + year + ' / ' + sec;
}

export function visibleNotices(data, user) {
  return data.notices.filter((n) => isPublished(n) && inAudience(n, user));
}

export function sortNotices(list) {
  const rank = { urgent: 0, important: 1, normal: 2 };
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return new Date(b.publishAt) - new Date(a.publishAt);
  });
}

export function audienceStudents(data, n) {
  return data.users.filter((u) => u.role === 'student' && u.active && inAudience(n, u));
}

export function noticeStats(data, n) {
  const students = audienceStudents(data, n);
  const reads = data.reads.filter((r) => r.noticeId === n.id);
  const readIds = reads.map((r) => r.userId);
  const readUsers = students.filter((s) => readIds.includes(s.id));
  const unreadUsers = students.filter((s) => !readIds.includes(s.id));
  const ackCount = reads.filter((r) => r.ackAt).length;
  const percent = students.length ? Math.round((readUsers.length * 100) / students.length) : 0;
  return { students, reads, readUsers, unreadUsers, ackCount, percent };
}

export function userCourses(data, user) {
  if (user.role === 'faculty') return data.courses.filter((c) => c.facultyId === user.id);
  if (user.role === 'admin') return data.courses;
  return data.courses.filter((c) => c.department === user.department && c.year === user.year && c.section === user.section);
}

export function downloadCSV(filename, rows) {
  const text = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
