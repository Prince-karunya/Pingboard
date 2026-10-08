import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AppContext = createContext();
const emptyData = () => ({
  users: [], issuers: [], courses: [], notices: [], reads: [], materials: [], views: [], bookmarks: [],
  calendarEvents: [], notifications: [],
});

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

function isMissingSchemaObject(error, objectName) {
  return (error?.code === 'PGRST204' || error?.code === 'PGRST205'
    || /schema cache|does not exist|could not find/i.test(error?.message || ''))
    && (error?.message || '').includes(objectName);
}

async function loadNoticeIssuers() {
  const result = await supabase.from('notice_issuers').select('id, name');
  if (isMissingSchemaObject(result.error, 'notice_issuers')) {
    console.warn('Notice issuer names are unavailable until the latest database migration is applied.');
    return { data: [], error: null };
  }
  return result;
}

async function loadNotifications(userId) {
  const result = await supabase.from('notifications')
    .select('id, event_type, title, body, notice_id, material_id, issued_by, created_at, read_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (!isMissingSchemaObject(result.error, 'issued_by')) return result;

  console.warn('Notification issuer details are unavailable until the latest database migration is applied.');
  return supabase.from('notifications')
    .select('id, event_type, title, body, notice_id, material_id, created_at, read_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
}

function userFacingError(error) {
  const message = error?.message || '';
  const technicalError = error?.code
    || error?.details
    || error?.hint
    || /schema cache|postgres|postgrest|supabase|violates|constraint|relation .* does not exist|permission denied|failed to fetch/i.test(message);
  return technicalError ? 'Something went wrong. Please try again. If the problem continues, contact your administrator.' : message || 'The request could not be completed.';
}

function mapUser(row) {
  return {
    id: row.id, authUserId: row.auth_user_id, name: row.name, email: row.email || '',
    role: row.role?.toLowerCase(), active: row.active, rollNo: row.roll_no || '',
    programCode: row.program_code || '', department: row.department || row.faculty_department || '',
    year: row.year || '', section: row.section || '', isHod: Boolean(row.is_hod),
  };
}

function mapCourse(row) {
  return {
    id: row.id, name: row.name, courseCode: row.course_code, facultyId: row.faculty_id,
    programCode: row.program_code, department: row.department || row.program_code.toUpperCase(),
    year: row.year, section: row.section || '',
  };
}

function mapNotice(row) {
  return {
    id: row.id, title: row.title, body: row.body, category: row.category, priority: row.priority,
    department: row.department || '', year: row.year || '', section: row.section || '',
    courseId: row.course_id, imagePath: row.image_path || '', dueDate: row.due_date || '',
    needsAck: row.needs_ack, status: row.status, publishAt: row.publish_at,
    createdBy: row.created_by, pinned: row.pinned,
  };
}

function mapMaterial(row) {
  return {
    id: row.id, courseId: row.course_id, unit: row.unit, title: row.title, description: row.description || '',
    type: row.type, fileName: row.file_name || '', link: row.link || '', storagePath: row.storage_path || '',
    visibility: row.visibility, uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at, version: row.version,
  };
}

function mapData(rows) {
  const detailById = new Map();
  for (const student of rows.students) detailById.set(student.user_id, student);
  const mergedUsers = new Map();
  for (const row of [rows.profile, ...rows.users].filter(Boolean)) {
    mergedUsers.set(row.id, mapUser({ ...row, ...detailById.get(row.id) }));
  }
  for (const row of rows.directory) {
    const existing = mergedUsers.get(row.id);
    mergedUsers.set(row.id, mapUser({ ...existing, ...row, ...detailById.get(row.id) }));
  }
  return {
    users: [...mergedUsers.values()],
    issuers: rows.issuers.map((row) => ({ id: row.id, name: row.name })),
    courses: rows.courses.map(mapCourse),
    notices: rows.notices.map(mapNotice),
    reads: rows.reads.map((row) => ({ noticeId: row.notice_id, userId: row.user_id, readAt: row.read_at, ackAt: row.ack_at })),
    materials: rows.materials.map(mapMaterial),
    views: rows.views.map((row) => ({ materialId: row.material_id, userId: row.user_id, viewedAt: row.viewed_at })),
    bookmarks: rows.bookmarks.map((row) => ({ userId: row.user_id, type: row.item_type, itemId: row.item_id })),
    calendarEvents: rows.calendarEvents.map((row) => ({
      id: row.id, userId: row.user_id, title: row.title, description: row.description || '', eventDate: row.event_date,
    })),
    notifications: rows.notifications.map((row) => ({
      id: row.id, type: row.event_type, title: row.title, body: row.body, noticeId: row.notice_id,
      materialId: row.material_id, issuedBy: row.issued_by, createdAt: row.created_at, readAt: row.read_at,
    })),
  };
}

async function loadData(profile) {
  const isStudent = profile.role === 'student';
  const canViewUserDirectory = profile.role === 'admin' || profile.role === 'faculty';
  const emptyResult = { data: [], error: null };
  const results = await Promise.all([
    supabase.from('account_directory')
      .select('id, name, role, active, roll_no, program_code, department, year, section, is_hod, faculty_department'),
    loadNoticeIssuers(),
    canViewUserDirectory
      ? supabase.from('users').select('id, auth_user_id, name, email, role, active, roll_no, department, year, section')
      : Promise.resolve(emptyResult),
    isStudent
      ? supabase.from('students').select('user_id, roll_no, program_code, department, year, section')
        .eq('user_id', profile.id)
      : Promise.resolve(emptyResult),
    supabase.from('courses').select('id, name, course_code, faculty_id, program_code, department, year, section'),
    supabase.from('notices')
      .select('id, title, body, category, priority, department, year, section, course_id, image_path, due_date, needs_ack, status, publish_at, created_by, pinned'),
    (isStudent
      ? supabase.from('read_receipts').select('notice_id, user_id, read_at, ack_at').eq('user_id', profile.id)
      : supabase.from('read_receipts').select('notice_id, user_id, read_at, ack_at')),
    supabase.from('materials')
      .select('id, course_id, unit, title, description, type, file_name, link, storage_path, visibility, uploaded_by, uploaded_at, version'),
    profile.role === 'faculty'
      ? supabase.from('material_views').select('material_id, user_id, viewed_at')
      : Promise.resolve(emptyResult),
    isStudent
      ? supabase.from('bookmarks').select('user_id, item_type, item_id').eq('user_id', profile.id)
      : Promise.resolve(emptyResult),
    isStudent
      ? supabase.from('calendar_events').select('id, user_id, title, description, event_date').eq('user_id', profile.id)
      : Promise.resolve(emptyResult),
    isStudent
      ? loadNotifications(profile.id)
      : Promise.resolve(emptyResult),
  ]);
  const [directory, issuers, users, students, courses, notices, reads, materials, views, bookmarks, calendarEvents, notifications] =
    results.map(unwrap);
  return mapData({
    directory, issuers, users, students, profile, courses, notices, reads, materials, views, bookmarks, calendarEvents, notifications,
  });
}

function toNoticeRow(fields, createdBy, imagePath) {
  return {
    title: fields.title, body: fields.body, category: fields.category, priority: fields.priority,
    department: fields.department || null, year: fields.year || null, section: fields.section || null,
    course_id: fields.courseId || null, image_path: imagePath || null,
    due_date: fields.dueDate || null, needs_ack: Boolean(fields.needsAck), status: fields.status,
    publish_at: fields.publishAt, created_by: createdBy,
  };
}

export function AppProvider({ children }) {
  const [data, setData] = useState(emptyData);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);

  async function refreshSession(session) {
    if (!session) {
      setUser(null);
      setData(emptyData());
      setReady(true);
      return;
    }
    const profile = unwrap(await supabase.from('users')
      .select('id, auth_user_id, name, email, role, active, roll_no, department, year, section')
      .eq('auth_user_id', session.user.id).eq('active', true).maybeSingle());
    if (!profile) {
      await supabase.auth.signOut();
      setUser(null);
      setData(emptyData());
      setError('This account is inactive or not provisioned. Contact your administrator.');
      setReady(true);
      return;
    }
    const nextData = await loadData(profile);
    const currentUser = nextData.users.find((item) => item.id === profile.id);
    if (!currentUser) throw new Error('Your account details could not be loaded.');
    setData(nextData);
    setUser(currentUser);
    setError('');
    setReady(true);
    return currentUser;
  }

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null);
        setData(emptyData());
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (sessionError) throw sessionError;
      return refreshSession(sessionData.session);
    }).catch((loadError) => {
      if (mounted) {
        console.error('Unable to restore PingBoard session:', loadError);
        setError(userFacingError(loadError));
        setReady(true);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new;
        setData((previous) => ({
          ...previous,
          notifications: [{ id: row.id, type: row.event_type, title: row.title, body: row.body,
            noticeId: row.notice_id, materialId: row.material_id, issuedBy: row.issued_by,
            createdAt: row.created_at, readAt: row.read_at },
          ...previous.notifications],
        }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function run(action) {
    setPendingRequests((count) => count + 1);
    try {
      const result = await action();
      setError('');
      return result;
    } catch (actionError) {
      console.error('PingBoard request failed:', actionError);
      setError(userFacingError(actionError));
      return null;
    } finally {
      setPendingRequests((count) => Math.max(0, count - 1));
    }
  }

  async function finishLogin(session) {
    const result = await supabase.auth.setSession(session);
    if (result.error) throw result.error;
    return refreshSession(result.data.session);
  }

  async function login(username, password, role) {
    setError('');
    return run(async () => {
      if (role === 'student') {
        const result = unwrap(await supabase.functions.invoke('student-login', {
          body: { rollNo: username.trim(), password },
        }));
        await finishLogin(result.session);
        return true;
      }

      const result = await supabase.auth.signInWithPassword({ email: username.trim(), password });
      if (result.error) throw result.error;
      const signedInUser = await refreshSession(result.data.session);
      if (signedInUser.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`This account is not registered as ${role}.`);
      }
      return true;
    });
  }

  async function logout() {
    return run(async () => {
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      setUser(null);
      setData(emptyData());
      return true;
    });
  }

  async function updateUser(id, changes) {
    return run(async () => {
      const result = unwrap(await supabase.functions.invoke('manage-users', {
        body: { action: 'update', userId: id, changes },
      }));
      setData((previous) => ({
        ...previous,
        users: previous.users.map((entry) => entry.id === id ? mapUser({ ...entry, ...result }) : entry),
      }));
      return true;
    });
  }

  async function addUsers(users) {
    return run(async () => {
      const rows = unwrap(await supabase.functions.invoke('manage-users', { body: { action: 'create', users } }));
      const profiles = rows.map(mapUser);
      setData((previous) => ({ ...previous, users: [...previous.users, ...profiles] }));
      return profiles;
    });
  }

  async function removeUser(id) {
    return run(async () => {
      unwrap(await supabase.functions.invoke('manage-users', { body: { action: 'delete', userId: id } }));
      setData((previous) => ({ ...previous, users: previous.users.filter((entry) => entry.id !== id) }));
      return true;
    });
  }

  async function getHodStudents() {
    return run(async () => unwrap(await supabase.rpc('get_hod_students')));
  }

  async function manageStudents(action, payload) {
    return run(async () => {
      const result = await supabase.functions.invoke('manage-students', {
        body: { action, ...payload },
      });
      if (result.error) {
        if (result.error.context instanceof Response) {
          let responseBody;
          try {
            responseBody = await result.error.context.clone().json();
          } catch {
            throw result.error;
          }
          if (typeof responseBody?.error === 'string') throw new Error(responseBody.error);
        }
        throw result.error;
      }
      setData(await loadData(user));
      return result.data;
    });
  }

  async function changePassword(currentPassword, newPassword) {
    return run(async () => {
      const reauth = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reauth.error) throw reauth.error;
      unwrap(await supabase.auth.updateUser({ password: newPassword }));
      return true;
    });
  }

  async function createNotice(fields) {
    return run(async () => {
      let imagePath = '';
      if (fields.imageFile) {
        const safeName = fields.imageFile.name.replace(/[^\w.-]/g, '_');
        imagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        unwrap(await supabase.storage.from('notice-images').upload(imagePath, fields.imageFile));
      }
      try {
        const row = unwrap(await supabase.from('notices')
          .insert(toNoticeRow(fields, user.id, imagePath)).select('*').single());
        const notice = mapNotice(row);
        setData((previous) => ({ ...previous, notices: [...previous.notices, notice] }));
        return notice;
      } catch (insertError) {
        if (imagePath) {
          const cleanup = await supabase.storage.from('notice-images').remove([imagePath]);
          if (cleanup.error) throw new Error(`${insertError.message} Image cleanup failed: ${cleanup.error.message}`);
        }
        throw insertError;
      }
    });
  }

  async function getNoticeImageUrl(notice) {
    return run(async () => {
      if (!notice.imagePath) return '';
      const result = await supabase.storage.from('notice-images').createSignedUrl(notice.imagePath, 300);
      return unwrap(result).signedUrl;
    });
  }

  async function deleteNotice(id) {
    return run(async () => {
      const notice = data.notices.find((item) => item.id === id);
      unwrap(await supabase.from('notices').delete().eq('id', id));
      setData((previous) => ({
        ...previous, notices: previous.notices.filter((item) => item.id !== id),
        reads: previous.reads.filter((receipt) => receipt.noticeId !== id),
        notifications: previous.notifications.filter((item) => item.noticeId !== id),
        bookmarks: previous.bookmarks.filter((item) => !(item.type === 'notice' && item.itemId === id)),
      }));
      if (notice?.imagePath) unwrap(await supabase.storage.from('notice-images').remove([notice.imagePath]));
      return true;
    });
  }

  async function togglePin(id) {
    return run(async () => {
      const notice = data.notices.find((item) => item.id === id);
      if (!notice) throw new Error('Notice not found.');
      unwrap(await supabase.from('notices').update({ pinned: !notice.pinned }).eq('id', id));
      setData((previous) => ({ ...previous, notices: previous.notices.map((item) => item.id === id ? { ...item, pinned: !notice.pinned } : item) }));
      return true;
    });
  }

  async function markRead(noticeId) {
    if (data.reads.some((receipt) => receipt.noticeId === noticeId && receipt.userId === user.id)) return true;
    return run(async () => {
      const row = unwrap(await supabase.from('read_receipts').upsert({
        notice_id: noticeId, user_id: user.id, read_at: new Date().toISOString(),
      }, { onConflict: 'notice_id,user_id', ignoreDuplicates: true }).select('*').maybeSingle());
      if (row) setData((previous) => ({ ...previous, reads: [...previous.reads, { noticeId, userId: user.id, readAt: row.read_at, ackAt: row.ack_at }] }));
      return true;
    });
  }

  async function acknowledge(noticeId) {
    return run(async () => {
      const timestamp = new Date().toISOString();
      const receipt = data.reads.find((item) => item.noticeId === noticeId && item.userId === user.id);
      const row = receipt
        ? unwrap(await supabase.from('read_receipts').update({ ack_at: timestamp })
          .eq('notice_id', noticeId).eq('user_id', user.id).select('*').single())
        : unwrap(await supabase.from('read_receipts').upsert({
          notice_id: noticeId, user_id: user.id, read_at: timestamp, ack_at: timestamp,
        }, { onConflict: 'notice_id,user_id' }).select('*').single());
      setData((previous) => ({
        ...previous, reads: [...previous.reads.filter((item) => !(item.noticeId === noticeId && item.userId === user.id)),
          { noticeId, userId: user.id, readAt: row.read_at, ackAt: row.ack_at }],
      }));
      return true;
    });
  }

  async function addMaterial(fields) {
    return run(async () => {
      const course = data.courses.find((item) => item.id === fields.courseId);
      if (!course) throw new Error('Course not found.');
      let storagePath = '';
      if (fields.file) {
        const safeName = fields.file.name.replace(/[^\w.-]/g, '_');
        storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        unwrap(await supabase.storage.from('materials').upload(storagePath, fields.file));
      }
      try {
        const row = unwrap(await supabase.from('materials').insert({
          course_id: fields.courseId, program_code: course.programCode, unit: fields.unit,
          title: fields.title, description: fields.description || null, type: fields.type,
          file_name: fields.fileName || null, link: fields.link || null, storage_path: storagePath || null,
          visibility: fields.visibility, uploaded_by: user.id,
        }).select('*').single());
        const material = mapMaterial(row);
        setData((previous) => ({ ...previous, materials: [...previous.materials, material] }));
        return material;
      } catch (insertError) {
        if (storagePath) {
          const cleanup = await supabase.storage.from('materials').remove([storagePath]);
          if (cleanup.error) throw new Error(`${insertError.message} File cleanup failed: ${cleanup.error.message}`);
        }
        throw insertError;
      }
    });
  }

  async function updateMaterial(id, changes) {
    return run(async () => {
      const material = data.materials.find((item) => item.id === id);
      if (!material) throw new Error('Material not found.');
      const patch = {};
      if (changes.visibility !== undefined) patch.visibility = changes.visibility;
      if (changes.file) {
        const safeName = changes.file.name.replace(/[^\w.-]/g, '_');
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        unwrap(await supabase.storage.from('materials').upload(path, changes.file));
        patch.storage_path = path;
        patch.file_name = changes.file.name;
        patch.version = material.version + 1;
        patch.uploaded_at = new Date().toISOString();
      }
      const row = unwrap(await supabase.from('materials').update(patch).eq('id', id).select('*').single());
      setData((previous) => ({ ...previous, materials: previous.materials.map((item) => item.id === id ? mapMaterial(row) : item) }));
      if (changes.file && material.storagePath) unwrap(await supabase.storage.from('materials').remove([material.storagePath]));
      return true;
    });
  }

  async function deleteMaterial(id) {
    return run(async () => {
      const material = data.materials.find((item) => item.id === id);
      if (!material) throw new Error('Material not found.');
      unwrap(await supabase.from('materials').delete().eq('id', id));
      setData((previous) => ({
        ...previous, materials: previous.materials.filter((item) => item.id !== id),
        views: previous.views.filter((item) => item.materialId !== id),
        bookmarks: previous.bookmarks.filter((item) => !(item.type === 'material' && item.itemId === id)),
        notifications: previous.notifications.filter((item) => item.materialId !== id),
      }));
      if (material.storagePath) unwrap(await supabase.storage.from('materials').remove([material.storagePath]));
      return true;
    });
  }

  async function recordView(materialId) {
    return run(async () => {
      const row = unwrap(await supabase.from('material_views').insert({ material_id: materialId, user_id: user.id }).select('*').single());
      setData((previous) => ({ ...previous, views: [...previous.views, { materialId, userId: user.id, viewedAt: row.viewed_at }] }));
      return true;
    });
  }

  async function getMaterialUrl(material) {
    return run(async () => {
      if (material.type === 'link') return material.link;
      if (!material.storagePath) throw new Error('This material has no uploaded file.');
      const result = await supabase.storage.from('materials')
        .createSignedUrl(material.storagePath, 60, { download: material.fileName });
      return unwrap(result).signedUrl;
    });
  }

  async function toggleBookmark(type, itemId) {
    return run(async () => {
      const exists = data.bookmarks.some((item) => item.userId === user.id && item.type === type && item.itemId === itemId);
      if (exists) {
        unwrap(await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('item_type', type).eq('item_id', itemId));
        setData((previous) => ({ ...previous, bookmarks: previous.bookmarks.filter((item) => !(item.userId === user.id && item.type === type && item.itemId === itemId)) }));
      } else {
        const row = unwrap(await supabase.from('bookmarks').insert({ user_id: user.id, item_type: type, item_id: itemId }).select('*').single());
        setData((previous) => ({ ...previous, bookmarks: [...previous.bookmarks, { userId: row.user_id, type: row.item_type, itemId: row.item_id }] }));
      }
      return true;
    });
  }

  async function addCourse(course) {
    return run(async () => {
      const row = unwrap(await supabase.from('courses').insert({
        name: course.name, course_code: course.courseCode, faculty_id: course.facultyId,
        program_code: course.programCode.toLowerCase(), department: course.department || course.programCode.toUpperCase(),
        year: course.year, section: course.section || null,
      }).select('*').single());
      const mapped = mapCourse(row);
      setData((previous) => ({ ...previous, courses: [...previous.courses, mapped] }));
      return mapped;
    });
  }

  async function deleteCourse(id) {
    return run(async () => {
      const rows = unwrap(await supabase.from('materials').select('id, storage_path').eq('course_id', id));
      unwrap(await supabase.from('courses').delete().eq('id', id));
      const materialIds = rows.map((row) => row.id);
      setData((previous) => ({
        ...previous, courses: previous.courses.filter((item) => item.id !== id),
        materials: previous.materials.filter((item) => item.courseId !== id),
        views: previous.views.filter((item) => !materialIds.includes(item.materialId)),
        bookmarks: previous.bookmarks.filter((item) => !(item.type === 'material' && materialIds.includes(item.itemId))),
      }));
      const paths = rows.map((row) => row.storage_path).filter(Boolean);
      if (paths.length) unwrap(await supabase.storage.from('materials').remove(paths));
      return true;
    });
  }

  async function addCalendarEvent(fields) {
    return run(async () => {
      const row = unwrap(await supabase.from('calendar_events').insert({
        user_id: user.id, title: fields.title.trim(), description: fields.description || null, event_date: fields.eventDate,
      }).select('*').single());
      const event = { id: row.id, userId: row.user_id, title: row.title, description: row.description || '', eventDate: row.event_date };
      setData((previous) => ({ ...previous, calendarEvents: [...previous.calendarEvents, event] }));
      return event;
    });
  }

  async function deleteCalendarEvent(id) {
    return run(async () => {
      unwrap(await supabase.from('calendar_events').delete().eq('id', id));
      setData((previous) => ({ ...previous, calendarEvents: previous.calendarEvents.filter((item) => item.id !== id) }));
      return true;
    });
  }

  async function markNotificationRead(id) {
    return run(async () => {
      const timestamp = new Date().toISOString();
      unwrap(await supabase.from('notifications').update({ read_at: timestamp }).eq('id', id));
      setData((previous) => ({
        ...previous,
        notifications: previous.notifications.map((item) => item.id === id ? { ...item, readAt: timestamp } : item),
      }));
      return true;
    });
  }

  async function exportCourseStudents(courseId, year) {
    return run(async () => unwrap(await supabase.rpc('get_course_student_emails', {
      p_course_id: courseId, p_year: year,
    })));
  }

  const value = {
    data, user, ready, error, setError, pendingRequests, isHod: Boolean(user?.isHod),
    login, logout, updateUser, removeUser, addUsers, changePassword,
    getHodStudents, manageStudents,
    createNotice, getNoticeImageUrl, deleteNotice, togglePin, markRead, acknowledge,
    addMaterial, updateMaterial, deleteMaterial, recordView, getMaterialUrl, toggleBookmark,
    addCourse, deleteCourse, addCalendarEvent, deleteCalendarEvent,
    markNotificationRead, exportCourseStudents,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
