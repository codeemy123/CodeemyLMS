export function gradeQuestion(question, answer) {
  const type = question[3] || 'single';
  if (type === 'text')
    return (
      typeof answer === 'string' &&
      answer.trim().toLowerCase() === String(question[2]).trim().toLowerCase()
    );
  if (type === 'multiple')
    return (
      Array.isArray(answer) &&
      Array.isArray(question[2]) &&
      [...answer].sort().join(',') === [...question[2]].sort().join(',')
    );
  return answer === question[2];
}
export function gradeAssessment(questions, answers, passPercent = 60) {
  const total = questions.reduce((sum, q) => sum + (q[4] || 1), 0);
  const score = questions.reduce(
    (sum, q, i) => sum + (gradeQuestion(q, answers[i]) ? q[4] || 1 : 0),
    0,
  );
  return {
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    passed: total > 0 && (score / total) * 100 >= passPercent,
  };
}
