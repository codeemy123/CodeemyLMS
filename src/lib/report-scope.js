// Frontend demo filtering; real server authorization is still required.
export function reportScope(role, workflows, catalog, records) {
  if (role === 'Admin') return { workflows, records };
  const batches = Object.entries(workflows.batches).filter(([, batch]) =>
    role === 'Mentor' ? batch.mentor === 'Arjun Kumar' : batch.students.includes('Kavin Raj'),
  );
  function academic(item, kind) {
    if (role === 'Student') return item.student === 'Kavin Raj';
    const course = item.course || catalog[kind]?.find((row) => row[0] === item.title)?.[1];
    return Boolean(
      course &&
      batches.some(([, batch]) => batch.course === course && batch.students.includes(item.student)),
    );
  }
  const scopedRecords = Object.fromEntries(
    Object.entries(records).flatMap(([key, value]) => {
      if (!key.startsWith('attendance:')) return [[key, value]];
      const match =
        role === 'Mentor'
          ? batches.find(([name, batch]) => key.startsWith(`attendance:${batch.course}:${name}:`))
          : null;
      if (role === 'Mentor' && !match) return [];
      return [
        [
          key,
          Object.fromEntries(
            Object.entries(value).filter(([name]) =>
              role === 'Student' ? name === 'Kavin Raj' : match[1].students.includes(name),
            ),
          ),
        ],
      ];
    }),
  );
  return {
    records: scopedRecords,
    workflows: {
      ...workflows,
      batches: Object.fromEntries(batches),
      submissions: workflows.submissions.filter((item) => academic(item, item.kind)),
      assessmentResults: workflows.assessmentResults.filter((item) =>
        academic(item, 'Assessments'),
      ),
      certificates: Object.fromEntries(
        Object.entries(workflows.certificates).filter(([course, certificate]) =>
          role === 'Student'
            ? certificate.name === 'Kavin Raj'
            : batches.some(
                ([, batch]) => batch.course === course && batch.students.includes(certificate.name),
              ),
        ),
      ),
      applications:
        role === 'Student'
          ? workflows.applications.filter((item) => item.student === 'Kavin Raj')
          : [],
    },
  };
}
