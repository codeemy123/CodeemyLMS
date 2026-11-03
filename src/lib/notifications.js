export function queryAssignedToMentor(query, workflows, mentor = 'Arjun Kumar') {
  const batches = Object.values(workflows.batches).filter((b) =>
    b.students.includes(query.student),
  );
  // Older demo threads had no course. Infer only when there is one possible course.
  const courses = [...new Set(batches.map((b) => b.course))];
  const course = query.course || (courses.length === 1 ? courses[0] : null);
  return Boolean(course && batches.some((b) => b.course === course && b.mentor === mentor));
}

export function workspaceNotifications(role, workflows, catalog = {}, viewer = {}) {
  if (!['Student', 'Mentor', 'Admin'].includes(role)) return [];
  const student = viewer.student || 'Kavin Raj';
  const mentor = viewer.mentor || 'Arjun Kumar';
  const identity =
    role === 'Student' ? student : role === 'Mentor' ? mentor : viewer.admin || 'Academy Admin';
  const batches = Object.values(workflows.batches);
  const studentHasCourse = (course) =>
    Boolean(course && batches.some((b) => b.course === course && b.students.includes(student)));
  const submissionCourse = (submission) =>
    submission.course || catalog[submission.kind]?.find((row) => row[0] === submission.title)?.[1];
  const items = [];
  for (const [title, item] of Object.entries(workflows.announcements)) {
    const batch = workflows.batches[item.audience],
      last = item.history?.at(-1);
    const own = last?.actorName ? last.actorName === identity : last?.author === role;
    const visible =
      role === 'Student'
        ? item.audience === 'All students' || batch?.students.includes(student)
        : role === 'Mentor'
          ? item.audience === 'All mentors' || batch?.mentor === mentor
          : item.audience === 'All admins';
    if (item.status === 'Published' && visible && !own)
      items.push({
        id: `announcement:${JSON.stringify([title, item.audience, item.body, item.history?.length || 0, last?.date])}`,
        title,
        description: item.body,
        page: 'Notifications',
      });
  }
  for (const submission of workflows.submissions) {
    const course = submissionCourse(submission),
      evaluations = workflows.evaluations[submission.id] || [];
    if (
      role === 'Student' &&
      submission.student === student &&
      studentHasCourse(course) &&
      evaluations.length
    ) {
      const evaluation = evaluations.at(-1);
      items.push({
        id: `evaluation:${submission.id}:${evaluations.length}:${evaluation.date}`,
        title: `Feedback: ${submission.title}`,
        description: evaluation.feedback,
        page: submission.kind,
        detail: { title: submission.title },
      });
    }
    if (
      role === 'Mentor' &&
      course &&
      batches.some(
        (b) =>
          b.mentor === mentor && b.course === course && b.students.includes(submission.student),
      ) &&
      !evaluations.length
    )
      items.push({
        id: `submission:${submission.id}`,
        title: `New submission: ${submission.title}`,
        description: `${submission.student} · Revision ${submission.revision}`,
        page: submission.kind,
        detail: { title: submission.title },
      });
  }
  for (const query of workflows.queries) {
    const latest = query.replies.at(-1);
    const replyMentor = latest && queryAssignedToMentor(query, workflows, latest.author);
    const visible =
      role === 'Student'
        ? query.student === student && latest && latest.author !== student && replyMentor
        : role === 'Mentor' &&
          queryAssignedToMentor(query, workflows, mentor) &&
          query.status !== 'Resolved' &&
          (!latest || latest.author === query.student);
    if (visible)
      items.push({
        id: `query:${query.id}:${query.replies.length}`,
        title: query.title,
        description: latest?.message || query.message,
        page: role === 'Student' ? 'Mentor' : 'Feedback',
      });
  }
  for (const application of workflows.applications) {
    const history = application.history || [],
      latest = history.at(-1);
    if (role === 'Admin') {
      const withdrawn =
        application.status === 'Withdrawn' &&
        (!latest?.actorRole || latest.actorRole === 'Student');
      items.push({
        id: withdrawn
          ? `application-withdrawn:${application.id}:${history.length}`
          : `application:${application.id}`,
        title: `${withdrawn ? 'Application withdrawn' : 'New application'}: ${application.title}`,
        description: application.student,
        page: 'Career',
        detail: { title: application.title },
      });
    }
    if (
      role === 'Student' &&
      application.student === student &&
      latest &&
      latest.status !== 'Withdrawn' &&
      latest.actorRole !== 'Student'
    )
      items.push({
        id: `application-status:${application.id}:${history.length}:${latest.date}:${latest.status}`,
        title: `Application ${latest.status}: ${application.title}`,
        description: latest.status,
        page: 'Career',
        detail: { title: application.title },
      });
  }
  if (role === 'Student')
    for (const [title, certificate] of Object.entries(workflows.certificates)) {
      const latest = certificate.events.at(-1);
      if (certificate.name === student && latest)
        items.push({
          id: `certificate:${certificate.number}:${certificate.events.length}`,
          title: `Certificate ${latest.action}: ${title}`,
          description: certificate.number,
          page: 'Certificates',
          detail: { title },
        });
    }
  return items;
}
