export function renameWorkflow(w, page, before, after) {
  if (before === after) return w;
  const rekey = (map) => {
    const next = { ...map };
    if (before in next) {
      next[after] = { ...next[before], ...next[after] };
      delete next[before];
    }
    return next;
  };
  if (page === 'Batches')
    return {
      ...w,
      batches: rekey(w.batches),
      assessmentResults: w.assessmentResults.map((r) => ({
        ...r,
        batch: r.batch === before ? after : r.batch,
      })),
      announcements: Object.fromEntries(
        Object.entries(w.announcements).map(([title, a]) => [
          title,
          { ...a, audience: a.audience === before ? after : a.audience },
        ]),
      ),
    };
  if (page === 'Courses')
    return {
      ...w,
      courseContent: rekeyArray(w.courseContent, before, after),
      certificates: rekey(w.certificates),
      resources: w.resources.map((r) => ({ ...r, course: r.course === before ? after : r.course })),
      batches: Object.fromEntries(
        Object.entries(w.batches).map(([title, b]) => [
          title,
          { ...b, course: b.course === before ? after : b.course },
        ]),
      ),
      submissions: w.submissions.map((s) => ({
        ...s,
        course: s.course === before ? after : s.course,
      })),
      assessmentResults: w.assessmentResults.map((result) => ({
        ...result,
        course: result.course === before ? after : result.course,
      })),
      opportunities: Object.fromEntries(
        Object.entries(w.opportunities).map(([title, o]) => [
          title,
          { ...o, course: o.course === before ? after : o.course },
        ]),
      ),
    };
  if (['Assignments', 'Projects'].includes(page))
    return {
      ...w,
      submissions: w.submissions.map((s) =>
        s.kind === page && s.title === before ? { ...s, title: after } : s,
      ),
    };
  if (page === 'Assessments')
    return {
      ...w,
      assessmentConfigs: rekey(w.assessmentConfigs),
      assessmentResults: w.assessmentResults.map((r) =>
        r.title === before ? { ...r, title: after } : r,
      ),
    };
  if (page === 'Career')
    return {
      ...w,
      opportunities: rekey(w.opportunities),
      applications: w.applications.map((a) => (a.title === before ? { ...a, title: after } : a)),
    };
  if (page === 'Announcements') return { ...w, announcements: rekey(w.announcements) };
  if (page === 'Certificates') return { ...w, certificates: rekey(w.certificates) };
  return w;
}
function rekeyArray(map, before, after) {
  const next = { ...map };
  if (map[before]) next[after] = map[before];
  delete next[before];
  return next;
}
