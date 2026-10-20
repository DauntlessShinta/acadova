export function scoreAiPractice(questions, answers) {
  if (!questions.length || answers.length !== questions.length || answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= questions[i].options.length)) return null;
  const correct = answers.filter((answer, index) => answer === questions[index].correctIndex).length;
  return { correct, total: questions.length, score: Math.round(correct * 100 / questions.length), creditsAwarded: 0 };
}
export function cardPosition(index, delta, length) { return Math.max(0, Math.min(length - 1, index + delta)); }

// Shuffle indices only; validated source content and answer keys are never rewritten.
export function shuffledCardOrder(length, random = Math.random) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
export function matchingModuleMaterial(source, type, count) {
  return source?.matches?.find(row => row.type === type && row.count === count && row.questionCount === count) || null;
}
