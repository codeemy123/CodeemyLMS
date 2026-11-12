import { authenticated } from '@/lib/server/auth';
import { jsonBody, uuid, numeric, roleAllowed, ApiError } from '@/lib/server/api';
import { requireAssessment } from '@/lib/server/assessment-workflows';
export const GET = authenticated(async (_request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const attempt = await db.assessment_attempts.findUnique({
    where: { id: uuid((await context.params).id) },
    include: { answers: true },
  });
  if (!attempt) throw new ApiError(404, 'Attempt not found.');
  const assessment = await requireAssessment(db, actor, attempt.assessment_id);
  if (
    actor.role === 'MENTOR' &&
    !(await db.batch_members.findFirst({
      where: {
        student_id: attempt.student_id,
        batches: {
          mentor_id: actor.id,
          course_id: assessment.course_id,
          ...(assessment.batch_id ? { id: assessment.batch_id } : {}),
        },
      },
    }))
  )
    throw new ApiError(403, 'Student not assigned.');
  return { attempt, questions: assessment.questions };
});
export const POST = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const body = await jsonBody(request),
    id = uuid((await context.params).id);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM assessment_attempts WHERE id = ${id}::uuid FOR UPDATE`;
    const attempt = await tx.assessment_attempts.findUnique({
      where: { id },
      include: { answers: true },
    });
    if (!attempt || attempt.status === 'IN_PROGRESS')
      throw new ApiError(409, 'Submit the attempt before evaluation.');
    const assessment = await requireAssessment(tx, actor, attempt.assessment_id);
    if (
      actor.role === 'MENTOR' &&
      !(await tx.batch_members.findFirst({
        where: {
          student_id: attempt.student_id,
          batches: {
            mentor_id: actor.id,
            course_id: assessment.course_id,
            ...(assessment.batch_id ? { id: assessment.batch_id } : {}),
          },
        },
      }))
    )
      throw new ApiError(403, 'Student not assigned.');
    const written = assessment.questions.filter((q) =>
      ['SHORT_ANSWER', 'LONG_ANSWER'].includes(q.question_type),
    );
    if (
      !Array.isArray(body.marks) ||
      body.marks.length !== written.length ||
      new Set(body.marks.map((m) => m.questionId)).size !== written.length
    )
      throw new ApiError(400, 'Evaluate every written question once.');
    for (const mark of body.marks) {
      const question = written.find((q) => q.id === mark.questionId);
      if (!question) throw new ApiError(400, 'Invalid written question.');
      const score = numeric(mark.score, 0, Number(question.marks));
      await tx.answers.upsert({
        where: { attempt_id_question_id: { attempt_id: id, question_id: question.id } },
        create: {
          attempt_id: id,
          question_id: question.id,
          selected_option_ids: [],
          marks_awarded: score,
        },
        update: { marks_awarded: score },
      });
    }
    const answers = await tx.answers.findMany({ where: { attempt_id: id } });
    const score = answers.reduce((sum, a) => sum + Number(a.marks_awarded || 0), 0);
    await tx.assessment_attempts.update({ where: { id }, data: { score, status: 'EVALUATED' } });
    await tx.audit_logs.create({
      data: {
        user_id: actor.id,
        action: 'ASSESSMENT_EVALUATED',
        entity_type: 'assessment_attempts',
        entity_id: id,
        details: { score },
      },
    });
    await tx.notifications.create({
      data: {
        user_id: attempt.student_id,
        title: 'Assessment evaluated',
        message: `${assessment.title}: ${score}`,
        type: 'ASSESSMENT',
        reference_id: assessment.id,
      },
    });
    return { score };
  });
});
