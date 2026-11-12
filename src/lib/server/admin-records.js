import { randomUUID } from 'node:crypto';
import { adminResources } from '../../config/admin-resources.js';
import { ApiError, text, uuid, choice, roleAllowed } from './api.js';
import { validObjectSignature } from './r2.js';
export function resourceConfig(entity) {
  const config = Object.hasOwn(adminResources, entity) && adminResources[entity];
  if (!config) throw new ApiError(404, 'Unknown editable resource.');
  return config;
}
export function validateAdminFields(entity, body, creating = false) {
  const config = resourceConfig(entity),
    data = {};
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ApiError(400, 'Invalid form data.');
  const allowed = new Set(config.fields.map((f) => f.name));
  for (const key of Object.keys(body))
    if (!allowed.has(key)) throw new ApiError(400, 'This field cannot be edited: ' + key);
  for (const field of config.fields) {
    let value = body[field.name];
    if (value === undefined) {
      if (!creating) continue;
      if (field.required) throw new ApiError(400, field.label + ' is required.');
      if (field.default !== undefined) value = field.default;
      else continue;
    }
    if (value === '' || value === null) {
      if (field.required) throw new ApiError(400, field.label + ' is required.');
      if (field.type === 'select')
        throw new ApiError(400, 'Select a valid ' + field.label.toLowerCase() + '.');
      if (field.type === 'checkbox') value = false;
      else if (field.type === 'number') value = field.default ?? 0;
      else {
        data[field.name] = null;
        continue;
      }
    }
    if (field.type === 'reference') data[field.name] = uuid(value);
    else if (field.type === 'select') data[field.name] = choice(value, field.options);
    else if (field.type === 'number') {
      if (!['number', 'string'].includes(typeof value))
        throw new ApiError(400, 'Invalid numeric value.');
      const number = Number(value);
      if (
        !Number.isFinite(number) ||
        number < (field.min ?? 0) ||
        number > (field.max ?? 100000) ||
        (['sort_order', 'duration_minutes'].includes(field.name) && !Number.isInteger(number))
      )
        throw new ApiError(400, 'Invalid ' + field.label.toLowerCase() + '.');
      data[field.name] = number;
    } else if (field.type === 'checkbox') {
      if (typeof value !== 'boolean') throw new ApiError(400, 'Invalid checkbox value.');
      data[field.name] = value;
    } else if (['date', 'datetime-local'].includes(field.type)) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new ApiError(400, 'Invalid date.');
      data[field.name] = date;
    } else if (field.type === 'url') {
      const raw = text(value, 3000);
      let url;
      try {
        url = new URL(raw, 'http://stored-file.local');
      } catch {
        throw new ApiError(400, 'Enter a valid HTTPS URL or uploaded file.');
      }
      if (raw.startsWith('/api/storage/object?') && url.origin === 'http://stored-file.local') {
        if (!validObjectSignature(url.searchParams.get('key'), url.searchParams.get('signature')))
          throw new ApiError(400, 'Invalid stored file link.');
        data[field.name] = url.pathname + url.search;
      } else {
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new ApiError(400, 'Use an HTTPS URL or uploaded file.');
        data[field.name] = url.href;
      }
    } else
      data[field.name] = text(
        value,
        field.max ?? (field.type === 'textarea' ? 20000 : 255),
        !!field.required,
      );
  }
  return data;
}
async function validateReferences(tx, entity, data) {
  const config = resourceConfig(entity);
  for (const field of config.fields.filter((f) => f.type === 'reference')) {
    const id = data[field.name];
    if (!id) continue;
    const model = {
      mentors: 'users',
      students: 'users',
      courses: 'courses',
      batches: 'batches',
      modules: 'course_modules',
      assessments: 'assessments',
      questions: 'questions',
    }[field.source];
    const where = {
      id,
      ...(field.source === 'mentors'
        ? { role: 'MENTOR', status: 'ACTIVE' }
        : field.source === 'students'
          ? { role: 'STUDENT' }
          : {}),
    };
    if (!(await tx[model].findFirst({ where })))
      throw new ApiError(400, 'Select a valid ' + field.label.toLowerCase() + '.');
  }
  if (
    data.course_id &&
    data.batch_id &&
    !(await tx.batches.findFirst({ where: { id: data.batch_id, course_id: data.course_id } }))
  )
    throw new ApiError(400, 'The batch must belong to the selected course.');
  if (data.end_at && data.start_at && data.end_at <= data.start_at)
    throw new ApiError(400, 'End time must be after start time.');
  if (data.end_date && data.start_date && data.end_date < data.start_date)
    throw new ApiError(400, 'End date must follow the start date.');
  if (entity === 'assessments' && Number(data.passing_marks) > Number(data.total_marks))
    throw new ApiError(400, 'Passing marks cannot exceed total marks.');
  if (
    entity === 'certificates' &&
    !(await tx.enrollments.findFirst({
      where: { student_id: data.student_id, course_id: data.course_id },
    })) &&
    !(await tx.batch_members.findFirst({
      where: { student_id: data.student_id, batches: { course_id: data.course_id } },
    }))
  )
    throw new ApiError(400, 'The student must be enrolled in this course.');
}
async function publishAnnouncement(tx, actor, announcement) {
  let where = { status: 'ACTIVE', id: { not: actor.id } };
  if (announcement.batch_id) {
    where = {
      ...where,
      OR: [
        { batch_members: { some: { batch_id: announcement.batch_id } } },
        { batches: { some: { id: announcement.batch_id } } },
      ],
    };
  } else if (announcement.course_id) {
    where = {
      ...where,
      OR: [
        {
          enrollments: {
            some: { course_id: announcement.course_id, status: { in: ['ACTIVE', 'COMPLETED'] } },
          },
        },
        { batch_members: { some: { batches: { course_id: announcement.course_id } } } },
        { courses: { some: { id: announcement.course_id } } },
        { batches: { some: { course_id: announcement.course_id } } },
      ],
    };
  }
  const people = await tx.users.findMany({ where, select: { id: true } });
  await tx.notifications.deleteMany({
    where: { type: 'ANNOUNCEMENT', reference_id: announcement.id },
  });
  if (people.length)
    await tx.notifications.createMany({
      data: people.map((user) => ({
        user_id: user.id,
        title: announcement.title,
        message: announcement.message,
        type: 'ANNOUNCEMENT',
        reference_id: announcement.id,
      })),
    });
}
export async function saveAdminRecord(db, actor, entity, id, body) {
  roleAllowed(actor, ['ADMIN']);
  const config = resourceConfig(entity);
  if (!id && entity === 'people')
    throw new ApiError(400, 'Use registration approval to activate new users.');
  if (id) uuid(id);
  const changes = validateAdminFields(entity, body, !id);
  return db.$transaction(
    async (tx) => {
      if (id)
        await tx.$queryRawUnsafe(
          'SELECT id FROM "' + config.model + '" WHERE id=$1::uuid FOR UPDATE',
          id,
        );
      const existing = id ? await tx[config.model].findUnique({ where: { id } }) : null;
      if (id && !existing) throw new ApiError(404, 'Record not found.');
      if (id && entity === 'careers' && existing.resource_type !== 'CAREER')
        throw new ApiError(404, 'Career opportunity not found.');
      if (entity === 'people') {
        if (existing.role === 'ADMIN')
          throw new ApiError(403, 'Admin identities cannot be modified here.');
        if (changes.status === 'ACTIVE') {
          const registration = await tx.audit_logs.findFirst({
            where: { entity_id: id, action: 'REGISTRATION_REQUESTED' },
          });
          if (
            registration &&
            !(await tx.audit_logs.findFirst({
              where: { entity_id: id, action: 'REGISTRATION_APPROVED' },
            }))
          )
            throw new ApiError(409, 'Review this registration in Account Approvals first.');
        }
      }
      const combined = { ...existing, ...changes };
      if (
        id &&
        entity === 'batches' &&
        changes.course_id &&
        changes.course_id !== existing.course_id
      ) {
        if (
          (await tx.batch_members.count({ where: { batch_id: id } })) ||
          (await tx.class_sessions.count({ where: { batch_id: id } })) ||
          (await tx.assignments.count({ where: { batch_id: id } })) ||
          (await tx.assessments.count({ where: { batch_id: id } }))
        )
          throw new ApiError(
            409,
            'This batch already has academic records. Create a new batch for another course.',
          );
      }
      if (
        id &&
        entity === 'assignments' &&
        ['course_id', 'batch_id', 'total_marks'].some(
          (key) => key in changes && String(changes[key]) !== String(existing[key]),
        ) &&
        (await tx.assignment_submissions.count({ where: { assignment_id: id } }))
      )
        throw new ApiError(409, 'Submissions exist. Preserve the course, batch and total marks.');
      if (entity === 'questions') {
        for (const assessmentId of [
          ...new Set([combined.assessment_id, existing?.assessment_id].filter(Boolean)),
        ]) {
          await tx.$queryRawUnsafe(
            'SELECT id FROM assessments WHERE id=$1::uuid FOR UPDATE',
            assessmentId,
          );
          if (await tx.assessment_attempts.count({ where: { assessment_id: assessmentId } }))
            throw new ApiError(409, 'Assessment attempts exist. Questions are locked.');
        }
      }

      await validateReferences(tx, entity, combined);
      if (
        entity === 'assessments' &&
        id &&
        (await tx.assessment_attempts.count({ where: { assessment_id: id } }))
      )
        throw new ApiError(
          409,
          'Assessment attempts already exist. Preserve this assessment and create a new one.',
        );
      if (
        entity === 'questions' &&
        (await tx.assessment_attempts.count({ where: { assessment_id: combined.assessment_id } }))
      )
        throw new ApiError(409, 'Assessment attempts already exist. Questions are locked.');
      if (entity === 'options') {
        const question = await tx.questions.findUnique({ where: { id: combined.question_id } });
        if (
          await tx.assessment_attempts.count({ where: { assessment_id: question.assessment_id } })
        )
          throw new ApiError(409, 'Assessment attempts exist. Answer options are locked.');
      }
      if (
        id &&
        [
          'courses',
          'batches',
          'assignments',
          'projects',
          'assessments',
          'people',
          'lessons',
        ].includes(entity)
      )
        changes.updated_at = new Date();
      if (!id) {
        if (entity === 'courses')
          changes.slug =
            String(changes.title)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-') +
            '-' +
            randomUUID().slice(0, 8);
        if (['assignments', 'announcements'].includes(entity)) changes.created_by = actor.id;
        if (entity === 'announcements') changes.published_at = new Date();
        if (['resources', 'careers'].includes(entity)) changes.uploaded_by = actor.id;
        if (entity === 'careers') changes.resource_type = 'CAREER';
      }
      const record = id
        ? await tx[config.model].update({ where: { id }, data: changes })
        : await tx[config.model].create({ data: changes });
      if (entity === 'announcements') await publishAnnouncement(tx, actor, record);
      await tx.audit_logs.create({
        data: {
          user_id: actor.id,
          entity_type: entity,
          entity_id: record.id,
          action: id ? 'ADMIN_RECORD_UPDATED' : 'ADMIN_RECORD_CREATED',
          details: {
            fields: Object.keys(changes),
            label: record.title || record.name || record.full_name || config.label,
          },
        },
      });
      return { record };
    },
    { timeout: 30000 },
  );
}
export async function removeAdminRecord(db, actor, entity, id) {
  roleAllowed(actor, ['ADMIN']);
  const config = resourceConfig(entity);
  uuid(id);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM "' + config.model + '" WHERE id=$1::uuid FOR UPDATE',
        id,
      );
      const record = await tx[config.model].findUnique({ where: { id } });
      if (!record) throw new ApiError(404, 'Record not found.');
      if (entity === 'careers' && record.resource_type !== 'CAREER')
        throw new ApiError(404, 'Career opportunity not found.');
      if (entity === 'people') {
        if (record.role === 'ADMIN')
          throw new ApiError(403, 'Admin identities cannot be removed here.');
        await tx.users.update({
          where: { id },
          data: { status: 'INACTIVE', updated_at: new Date() },
        });
        await tx.audit_logs.create({
          data: {
            user_id: actor.id,
            entity_id: id,
            entity_type: entity,
            action: 'ADMIN_ACCESS_REMOVED',
            details: { label: record.full_name },
          },
        });
        return { removed: true, mode: 'deactivated' };
      }
      const dependencies = {
        courses: [
          ['batches', 'course_id'],
          ['enrollments', 'course_id'],
          ['course_modules', 'course_id'],
          ['assignments', 'course_id'],
          ['assessments', 'course_id'],
          ['projects', 'course_id'],
          ['resources', 'course_id'],
          ['certificates', 'course_id'],
          ['announcements', 'course_id'],
        ],
        batches: [
          ['batch_members', 'batch_id'],
          ['class_sessions', 'batch_id'],
          ['assignments', 'batch_id'],
          ['assessments', 'batch_id'],
          ['announcements', 'batch_id'],
        ],
        classes: [['attendance', 'session_id']],
        assignments: [['assignment_submissions', 'assignment_id']],
        projects: [['project_submissions', 'project_id']],
        modules: [['lessons', 'module_id']],
        lessons: [['lesson_progress', 'lesson_id']],
        assessments: [['assessment_attempts', 'assessment_id']],
        questions: [['answers', 'question_id']],
      };
      for (const [model, column] of dependencies[entity] || [])
        if (await tx[model].count({ where: { [column]: id } }))
          throw new ApiError(
            409,
            'Linked ' +
              model.replaceAll('_', ' ') +
              ' exist. Preserve their history; remove the links first or change this record status.',
          );
      if (
        entity === 'questions' &&
        (await tx.assessment_attempts.count({ where: { assessment_id: record.assessment_id } }))
      )
        throw new ApiError(409, 'Assessment attempts exist. Questions are locked.');
      if (entity === 'options') {
        const question = await tx.questions.findUnique({ where: { id: record.question_id } });
        if (
          await tx.assessment_attempts.count({ where: { assessment_id: question.assessment_id } })
        )
          throw new ApiError(409, 'Assessment attempts exist. Answer options are locked.');
      }
      await tx.notifications.deleteMany({
        where: { reference_id: id, type: { in: ['ANNOUNCEMENT', 'CLASS'] } },
      });
      await tx[config.model].delete({ where: { id } });
      await tx.audit_logs.create({
        data: {
          user_id: actor.id,
          entity_id: id,
          entity_type: entity,
          action: 'ADMIN_RECORD_REMOVED',
          details: { label: record.title || record.name || config.label },
        },
      });
      return { removed: true, mode: 'deleted' };
    },
    { timeout: 30000 },
  );
}
