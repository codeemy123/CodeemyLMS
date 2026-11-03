export function studentBatches(workflows, student = 'Kavin Raj') {
  return Object.entries(workflows.batches).filter(([, b]) => b.students.includes(student));
}

export function batchLeaderboard(workflows, batchName, assessment, student = 'Kavin Raj') {
  const batch = workflows.batches[batchName];
  if (!batch?.students.includes(student)) return [];
  const best = new Map();
  for (const result of workflows.assessmentResults) {
    if (
      result.batch !== batchName ||
      result.course !== batch.course ||
      result.title !== assessment ||
      !batch.students.includes(result.student) ||
      (result.reason && !['submitted', 'timeout'].includes(result.reason)) ||
      !Number.isFinite(result.score) ||
      !Number.isFinite(result.total) ||
      result.total <= 0 ||
      result.score < 0 ||
      result.score > result.total
    )
      continue;
    const previous = best.get(result.student);
    if (!previous || result.score / result.total > previous.score / previous.total)
      best.set(result.student, result);
  }
  let rank = 0;
  let lastScore = null;
  return [...best.values()]
    .sort((a, b) => b.score / b.total - a.score / a.total || a.student.localeCompare(b.student))
    .map((result, index) => {
      const ratio = result.score / result.total;
      if (ratio !== lastScore) rank = index + 1;
      lastScore = ratio;
      return { ...result, rank, percent: Math.round(ratio * 100) };
    });
}
