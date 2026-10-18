export function scoreAiPractice(questions, answers) {
  if (!questions.length || answers.length !== questions.length || answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= questions[i].options.length)) return null;
  const correct = answers.filter((answer, index) => answer === questions[index].correctIndex).length;
  return { correct, total: questions.length, score: Math.round(correct * 100 / questions.length), creditsAwarded: 0 };
}
export function cardPosition(index, delta, length) { return Math.max(0, Math.min(length - 1, index + delta)); }
