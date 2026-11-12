import { ApiError, uuid, roleAllowed, text } from './api.js';
import { requireCourse } from './data-access.js';
import { approvedReopen, assessmentAttemptWindow } from './assessment-reopens.js';

export function assessmentDeadline(attempt, assessment) {
  return new Date(
    Math.min(
      new Date(attempt.started_at).getTime() + assessment.duration_minutes * 60000,
      assessment.end_at ? new Date(assessment.end_at).getTime() : Infinity,
    ),
  );
}
export function scoreChoice(question, selected) {
  const correct = question.question_options
    .filter((o) => o.is_correct)
    .map((o) => o.id)
    .sort();
  const answer = [...new Set(selected)].sort();
  return correct.length > 0 &&
    correct.length === answer.length &&
    correct.every((id, i) => id === answer[i])
    ? Number(question.marks)
    : 0;
}
export async function requireAssessment(db, actor, id) {
  const assessment = await db.assessments.findUnique({
    where: { id: uuid(id) },
    include: { questions: { include: { question_options: true }, orderBy: { sort_order: 'asc' } } },
  });
  if (!assessment?.course_id) throw new ApiError(404, 'Assessment not found.');
  await requireCourse(db, actor, assessment.course_id);
  if (actor.role === 'STUDENT') {
    if (assessment.status !== 'PUBLISHED') throw new ApiError(404, 'Assessment is not published.');
    if (
      assessment.batch_id &&
      !(await db.batch_members.findUnique({
        where: { batch_id_student_id: { batch_id: assessment.batch_id, student_id: actor.id } },
      }))
    )
      throw new ApiError(404, 'Assessment not assigned to your batch.');
  } else if (
    actor.role === 'MENTOR' &&
    assessment.batch_id &&
    !(await db.batches.findFirst({ where: { id: assessment.batch_id, mentor_id: actor.id } }))
  )
    throw new ApiError(404, 'Assessment not assigned.');
  return assessment;
}
export function publicQuestions(assessment) {
  return assessment.questions.map(({ question_options, ...q }) => ({
    ...q,
    question_options: question_options.map(({ is_correct, ...o }) => o),
  }));
}
export async function finishAttempt(tx, actor, id, body = {}, system = false) {
  const attempt = await tx.assessment_attempts.findUnique({ where: { id: uuid(id) } });
  if (!attempt || attempt.student_id !== actor.id) throw new ApiError(404, 'Attempt not found.');
  let assessment = system
    ? await tx.assessments.findUnique({
        where: { id: attempt.assessment_id },
        include: { questions: { include: { question_options: true } } },
      })
    : await requireAssessment(tx, actor, attempt.assessment_id);
  assessment = await assessmentAttemptWindow(tx, attempt, assessment);
  if (attempt.status !== 'IN_PROGRESS')
    return { attempt, deadline: assessmentDeadline(attempt, assessment) };
  const expired = new Date() >= assessmentDeadline(attempt, assessment);
  if (!expired && body.answers !== undefined) {
    if (!Array.isArray(body.answers) || body.answers.length > assessment.questions.length)
      throw new ApiError(400, 'Invalid answers.');
    const seen = new Set();
    for (const item of body.answers) {
      const question = assessment.questions.find((q) => q.id === item.questionId);
      if (!question || seen.has(question.id)) throw new ApiError(400, 'Invalid question.');
      seen.add(question.id);
      const selected = item.selectedOptionIds ?? [];
      if (
        !Array.isArray(selected) ||
        new Set(selected).size !== selected.length ||
        selected.some((id) => !question.question_options.some((o) => o.id === id)) ||
        (question.question_type !== 'MULTIPLE_SELECT' && selected.length > 1)
      )
        throw new ApiError(400, 'Invalid selected options.');
      const data = {
        selected_option_ids: selected,
        answer_text: text(item.answerText || '', 10000, false),
        updated_at: new Date(),
      };
      await tx.answers.upsert({
        where: { attempt_id_question_id: { attempt_id: attempt.id, question_id: question.id } },
        create: { attempt_id: attempt.id, question_id: question.id, ...data },
        update: data,
      });
    }
  }
  if (expired || body.submit === true) {
    const saved = await tx.answers.findMany({ where: { attempt_id: attempt.id } });
    let score = 0,
      manual = false;
    for (const q of assessment.questions) {
      const answer = saved.find((a) => a.question_id === q.id);
      const written = ['SHORT_ANSWER', 'LONG_ANSWER'].includes(q.question_type);
      if (written && answer?.answer_text) manual = true;
      const marks = written ? null : scoreChoice(q, answer?.selected_option_ids || []);
      score += marks || 0;
      if (answer)
        await tx.answers.update({
          where: { id: answer.id },
          data: { marks_awarded: marks, is_correct: written ? null : marks === Number(q.marks) },
        });
    }
    const final = await tx.assessment_attempts.update({
      where: { id: attempt.id },
      data: { submitted_at: new Date(), score, status: manual ? 'SUBMITTED' : 'EVALUATED' },
    });
    await tx.audit_logs.create({
      data: {
        user_id: actor.id,
        action: 'ASSESSMENT_FINISHED',
        entity_type: 'assessment_attempts',
        entity_id: attempt.id,
        details: {
          reason: expired ? 'timeout' : text(body.reason || 'submitted', 100),
          manualReview: manual,
        },
      },
    });
    await tx.notifications.create({
      data: {
        user_id: actor.id,
        title: 'Assessment submitted',
        message: manual ? 'Your written answers are awaiting evaluation.' : `Your score: ${score}`,
        type: 'ASSESSMENT',
        reference_id: assessment.id,
      },
    });
    const closedReason = expired ? 'timeout' : body.reason;
    if (
      [
        'hidden',
        'fullscreen',
        'focus',
        'resize',
        'navigation',
        'page_exit',
        'reentry',
        'timeout',
      ].includes(closedReason)
    ) {
      const admins = await tx.users.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      if (admins.length)
        await tx.notifications.createMany({
          data: admins.map((a) => ({
            user_id: a.id,
            title: 'Assessment attempt closed',
            message: `${actor.full_name || 'Student'}: ${assessment.title}. Reason: ${closedReason}.`,
            type: 'ASSESSMENT_REOPEN',
            reference_id: assessment.id,
          })),
        });
    }
    return { attempt: final, deadline: assessmentDeadline(attempt, assessment) };
  }
  return { attempt, deadline: assessmentDeadline(attempt, assessment) };
}
export async function finalizeExpiredAssessments(db) {
  const attempts =
    await db.$queryRaw`SELECT a.id, a.student_id FROM assessment_attempts a JOIN assessments s ON s.id=a.assessment_id WHERE a.status='IN_PROGRESS' AND (a.started_at + make_interval(mins => s.duration_minutes) <= now() OR COALESCE((SELECT (details->>'closeAt')::timestamptz FROM audit_logs WHERE action='ASSESSMENT_REOPEN_STARTED' AND entity_id=a.id ORDER BY created_at DESC LIMIT 1),s.end_at) <= now()) ORDER BY a.started_at LIMIT 500`;
  let finalized = 0;
  for (const candidate of attempts) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assessment_attempts WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      const result = await finishAttempt(
        tx,
        { id: candidate.student_id, role: 'STUDENT' },
        candidate.id,
        {},
        true,
      );
      if (result.attempt.status !== 'IN_PROGRESS') finalized++;
    });
  }
  return finalized;
}

export async function startAttempt(tx, actor, id, options = {}) {
  roleAllowed(actor, ['STUDENT']);
  // Lock the student row so concurrent tabs cannot create two attempts.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
  const assessmentId = uuid(id);
  await tx.$queryRaw`SELECT id FROM assessments WHERE id = ${assessmentId}::uuid FOR UPDATE`;
  let assessment = await requireAssessment(tx, actor, id);
  const prior = await tx.assessment_attempts.findFirst({
    where: { assessment_id: assessment.id, student_id: actor.id },
    orderBy: { started_at: 'desc' },
  });
  let reopen;
  if (prior && (prior.status === 'IN_PROGRESS' || options.reopen !== true)) {
    await tx.$queryRaw`SELECT id FROM assessment_attempts WHERE id = ${prior.id}::uuid FOR UPDATE`;
    const result = await finishAttempt(
      tx,
      actor,
      prior.id,
      prior.status === 'IN_PROGRESS' ? { submit: true, reason: 'reentry' } : {},
    );
    return {
      ...result,
      questions: publicQuestions(assessment),
      answers: await tx.answers.findMany({
        where: { attempt_id: prior.id },
        select: { question_id: true, answer_text: true, selected_option_ids: true },
      }),
      serverTime: new Date(),
    };
  }
  if (prior) {
    reopen = await approvedReopen(tx, actor, prior);
    assessment = {
      ...assessment,
      start_at: new Date(reopen.details.openAt),
      end_at: new Date(reopen.details.closeAt),
    };
  }
  const now = new Date();
  if (
    (assessment.start_at && now < assessment.start_at) ||
    (assessment.end_at && now >= assessment.end_at)
  )
    throw new ApiError(409, 'Assessment is outside its scheduled time.');
  if (
    !assessment.questions.length ||
    !Number.isInteger(assessment.duration_minutes) ||
    assessment.duration_minutes < 1
  )
    throw new ApiError(409, 'Assessment is not ready.');
  const total = assessment.questions.reduce((sum, q) => sum + Number(q.marks), 0);
  if (Math.abs(total - Number(assessment.total_marks)) > 0.001)
    throw new ApiError(
      409,
      'Question marks must match the assessment total before students can start.',
    );
  for (const question of assessment.questions) {
    if (['SHORT_ANSWER', 'LONG_ANSWER'].includes(question.question_type)) continue;
    const correct = question.question_options.filter((o) => o.is_correct).length;
    if (
      question.question_options.length < 2 ||
      !correct ||
      (question.question_type !== 'MULTIPLE_SELECT' && correct !== 1)
    )
      throw new ApiError(409, 'Complete the answer options before students can start.');
  }
  const attempt = await tx.assessment_attempts.create({
    data: { assessment_id: assessment.id, student_id: actor.id, started_at: now, created_at: now },
  });
  if (reopen) {
    await tx.audit_logs.create({
      data: {
        user_id: actor.id,
        action: 'ASSESSMENT_REOPEN_USED',
        entity_type: 'assessment_reopen',
        entity_id: reopen.id,
        details: { attemptId: attempt.id },
      },
    });
    await tx.audit_logs.create({
      data: {
        user_id: actor.id,
        action: 'ASSESSMENT_REOPEN_STARTED',
        entity_type: 'assessment_attempts',
        entity_id: attempt.id,
        details: {
          grantId: reopen.id,
          openAt: reopen.details.openAt,
          closeAt: reopen.details.closeAt,
        },
      },
    });
  }
  return {
    attempt,
    deadline: assessmentDeadline(attempt, assessment),
    questions: publicQuestions(assessment),
    answers: [],
    serverTime: now,
  };
}
