import { ApiError, text, uuid, numeric, roleAllowed } from './api.js';
import { courseScope, requireCourse, evaluateSubmission } from './data-access.js';

export async function workflowRead(db, actor, kind) {
  const courses = await db.courses.findMany({ where: courseScope(actor), select: { id: true } });
  const ids = courses.map((c) => c.id);
  const mentorRoster =
    actor.role === 'MENTOR'
      ? await db.batch_members.findMany({
          where: { batches: { mentor_id: actor.id, course_id: { in: ids } } },
          select: { student_id: true, batches: { select: { course_id: true } } },
        })
      : [];
  const mentorMembers = new Set(mentorRoster.map((m) => m.student_id + ':' + m.batches.course_id));
  const scoped = actor.role === 'ADMIN' ? {} : { course_id: { in: ids } };
  if (kind === 'performance') {
    roleAllowed(actor, ['ADMIN', 'MENTOR']);
    const records = await db.$queryRaw`
      SELECT bm.id, u.full_name AS title, b.name AS batch,
        (SELECT count(*)::int FROM lessons l JOIN course_modules m ON m.id=l.module_id WHERE m.course_id=b.course_id AND l.is_published=true) AS lessons,
        (SELECT count(*)::int FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN course_modules m ON m.id=l.module_id WHERE p.student_id=bm.student_id AND p.is_completed=true AND l.is_published=true AND m.course_id=b.course_id) AS completed,
        (SELECT round(100.0*count(*) FILTER (WHERE a.status IN ('PRESENT','LATE'))/NULLIF(count(*),0))::int FROM attendance a JOIN class_sessions s ON s.id=a.session_id WHERE a.student_id=bm.student_id AND s.batch_id=b.id) AS attendance,
        ((SELECT count(*) FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=bm.student_id AND a.course_id=b.course_id AND (a.batch_id IS NULL OR a.batch_id=b.id) AND s.marks_awarded IS NOT NULL) +
        (SELECT count(*) FROM project_submissions s JOIN projects p ON p.id=s.project_id WHERE s.student_id=bm.student_id AND p.course_id=b.course_id AND s.marks_awarded IS NOT NULL))::int AS evaluated
      FROM batch_members bm JOIN batches b ON b.id=bm.batch_id JOIN users u ON u.id=bm.student_id
      WHERE (${actor.role}='ADMIN' OR b.mentor_id=${actor.id}::uuid) ORDER BY b.name,u.full_name
    `;
    return { records };
  }
  if (kind === 'materials')
    return {
      records: await db.resources.findMany({
        where: { ...scoped, NOT: { resource_type: 'CAREER' } },
        orderBy: { created_at: 'desc' },
      }),
    };
  if (kind === 'announcements') {
    const batches = await db.batches.findMany({
      where:
        actor.role === 'ADMIN'
          ? {}
          : actor.role === 'MENTOR'
            ? { mentor_id: actor.id }
            : { batch_members: { some: { student_id: actor.id } } },
      select: { id: true },
    });
    return {
      records: await db.announcements.findMany({
        where:
          actor.role === 'ADMIN'
            ? {}
            : {
                published_at: { lte: new Date() },
                AND: [
                  { OR: [{ course_id: null }, { course_id: { in: ids } }] },
                  { OR: [{ batch_id: null }, { batch_id: { in: batches.map((b) => b.id) } }] },
                ],
              },
        orderBy: { published_at: 'desc' },
      }),
    };
  }
  if (kind === 'projects') {
    const records = await db.projects.findMany({
      where: scoped,
      include: {
        project_submissions: {
          where:
            actor.role === 'STUDENT'
              ? { student_id: actor.id }
              : actor.role === 'MENTOR'
                ? {
                    users: {
                      batch_members: {
                        some: { batches: { mentor_id: actor.id, course_id: { in: ids } } },
                      },
                    },
                  }
                : {},
          include: { users: { select: { full_name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    if (actor.role === 'MENTOR')
      for (const record of records)
        record.project_submissions = record.project_submissions.filter((s) =>
          mentorMembers.has(s.student_id + ':' + record.course_id),
        );
    return { records };
  }
  if (kind === 'progress') {
    const rows = await db.lessons.findMany({
      where: { is_published: true, course_modules: { course_id: { in: ids } } },
      include: {
        course_modules: { select: { title: true, course_id: true } },
        lesson_progress: {
          where:
            actor.role === 'STUDENT'
              ? { student_id: actor.id }
              : { users: { batch_members: { some: { batches: { mentor_id: actor.id } } } } },
        },
      },
      orderBy: { sort_order: 'asc' },
    });
    if (actor.role === 'MENTOR')
      for (const row of rows)
        row.lesson_progress = row.lesson_progress.filter((p) =>
          mentorMembers.has(p.student_id + ':' + row.course_modules.course_id),
        );
    return { records: rows };
  }
  if (kind === 'queries') {
    // Educators see only queries explicitly addressed to them; no shared-student leakage.
    const where = actor.role === 'STUDENT' ? { student_id: actor.id } : {};
    if (actor.role === 'MENTOR') {
      const links = await db.audit_logs.findMany({
        where: { action: 'QUERY_ROUTED', details: { path: ['mentorId'], equals: actor.id } },
        select: { entity_id: true },
      });
      where.id = { in: links.map((l) => l.entity_id).filter(Boolean) };
    }
    return {
      records: await db.student_queries.findMany({
        where,
        include: {
          users: { select: { full_name: true } },
          query_replies: {
            include: { users: { select: { full_name: true } } },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { updated_at: 'desc' },
      }),
      courses: await db.courses.findMany({
        where: courseScope(actor),
        select: { id: true, title: true },
      }),
      batches:
        actor.role === 'STUDENT'
          ? await db.batches.findMany({
              where: { batch_members: { some: { student_id: actor.id } } },
              select: { id: true, name: true, course_id: true },
            })
          : [],
    };
  }
  throw new ApiError(404, 'Workflow not found.');
}

export async function workflowWrite(db, actor, kind, body) {
  if (kind === 'progress') {
    roleAllowed(actor, ['STUDENT']);
    const lesson = await db.lessons.findFirst({
      where: { id: uuid(body.id), is_published: true },
      include: { course_modules: true },
    });
    if (!lesson) throw new ApiError(404, 'Lesson not found.');
    await requireCourse(db, actor, lesson.course_modules.course_id);
    if (body.completed !== undefined && typeof body.completed !== 'boolean')
      throw new ApiError(400, 'Invalid completion.');
    const data = {
      updated_at: new Date(),
      ...(body.completed !== undefined
        ? { is_completed: body.completed, completed_at: body.completed ? new Date() : null }
        : {}),
      ...(body.position !== undefined
        ? { last_position_seconds: Math.floor(numeric(body.position, 0, 864000)) }
        : {}),
    };
    return {
      progress: await db.lesson_progress.upsert({
        where: { student_id_lesson_id: { student_id: actor.id, lesson_id: lesson.id } },
        create: { student_id: actor.id, lesson_id: lesson.id, ...data },
        update: data,
      }),
    };
  }
  if (kind === 'projects') {
    if (body.action === 'evaluate')
      return {
        submission: await evaluateSubmission(
          db,
          actor,
          'project',
          uuid(body.id),
          numeric(body.marks),
          text(body.feedback || '', 10000, false),
        ),
      };
    roleAllowed(actor, ['STUDENT']);
    const project = await db.projects.findUnique({ where: { id: uuid(body.id) } });
    if (!project?.course_id) throw new ApiError(404, 'Project not found.');
    await requireCourse(db, actor, project.course_id);
    if (project.due_date && project.due_date < new Date())
      throw new ApiError(409, 'The project deadline has passed.');
    function link(value) {
      if (!value) return null;
      const url = new URL(text(value, 2000));
      if (url.protocol !== 'https:') throw new ApiError(400, 'Use an HTTPS link.');
      return url.href;
    }
    const data = {
      description: text(body.description || '', 20000, false),
      repository_url: link(body.repositoryUrl),
      live_url: link(body.liveUrl),
    };
    return {
      submission: await db.project_submissions.create({
        data: { project_id: project.id, student_id: actor.id, ...data },
      }),
    };
  }
  if (kind === 'queries') {
    if (body.action === 'reply') {
      const allowed = await workflowRead(db, actor, 'queries');
      const query = allowed.records.find((q) => q.id === uuid(body.id));
      if (!query) throw new ApiError(404, 'Query not found.');
      const reply = await db.query_replies.create({
        data: { query_id: query.id, sender_id: actor.id, message: text(body.message, 10000) },
      });
      await db.student_queries.update({
        where: { id: query.id },
        data: {
          updated_at: new Date(),
          status: body.resolve && actor.role !== 'STUDENT' ? 'RESOLVED' : 'IN_PROGRESS',
        },
      });
      const route = await db.audit_logs.findFirst({
        where: { entity_id: query.id, action: 'QUERY_ROUTED' },
      });
      const recipient = actor.role === 'STUDENT' ? route?.details?.mentorId : query.student_id;
      if (recipient && recipient !== actor.id)
        await db.notifications.create({
          data: {
            user_id: recipient,
            title: 'Query reply',
            message: query.subject,
            type: 'QUERY',
            reference_id: query.id,
          },
        });
      return { reply };
    }
    roleAllowed(actor, ['STUDENT']);
    const course = await requireCourse(db, actor, uuid(body.courseId));
    const memberships = await db.batch_members.findMany({
      where: {
        student_id: actor.id,
        ...(body.batchId ? { batch_id: uuid(body.batchId) } : {}),
        batches: { course_id: course.id },
      },
      include: { batches: true },
    });
    if (body.batchId && !memberships.length)
      throw new ApiError(400, 'Choose your assigned batch for this course.');
    if (memberships.length > 1) throw new ApiError(409, 'Choose the batch for this query.');
    const membership = memberships[0];
    const mentorId = membership?.batches.mentor_id || course.mentor_id;
    if (!mentorId) throw new ApiError(409, 'Your course needs an assigned mentor.');
    const query = await db.student_queries.create({
      data: {
        student_id: actor.id,
        subject: text(body.subject),
        message: text(body.message, 10000),
      },
    });
    await db.audit_logs.create({
      data: {
        user_id: actor.id,
        action: 'QUERY_ROUTED',
        entity_type: 'student_queries',
        entity_id: query.id,
        details: { courseId: course.id, mentorId, batchId: membership?.batch_id || null },
      },
    });
    await db.notifications.create({
      data: {
        user_id: mentorId,
        title: 'New student query',
        message: query.subject,
        type: 'QUERY',
        reference_id: query.id,
      },
    });
    return { query };
  }
  throw new ApiError(404, 'Workflow not found.');
}
