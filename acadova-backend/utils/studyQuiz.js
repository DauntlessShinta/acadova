function invalid(message, field = 'questions') { throw Object.assign(new Error(message), { status: 400, fields: { [field]: message } }); }
function text(value, max, field) {
  if (typeof value !== 'string' || value.length > max) invalid(`Use text of at most ${max} characters.`, field);
  return value.trim();
}
function studyContent(body, complete = false) {
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !['title', 'subject', 'description', 'questions'].includes(key))) invalid('Unexpected study-set field.', 'title');
  const result = { title: text(body.title, 120, 'title'), subject: text(body.subject, 80, 'subject'), description: text(body.description ?? '', 1000, 'description') };
  if (!Array.isArray(body.questions) || body.questions.length > 50) invalid('Use at most 50 questions.');
  result.questions = body.questions.map((question, index) => {
    const field = `questions.${index}`;
    if (!question || Object.keys(question).some(key => !['prompt', 'options', 'correctIndex', 'explanation'].includes(key))) invalid('Unexpected question field.', field);
    if (!Array.isArray(question.options) || question.options.length > 5) invalid('Use at most five options.', field);
    const clean = { prompt: text(question.prompt, 300, `${field}.prompt`), options: question.options.map((option, i) => text(option, 300, `${field}.options.${i}`)),
      correctIndex: question.correctIndex ?? null, explanation: text(question.explanation ?? '', 1000, `${field}.explanation`) };
    if (clean.correctIndex !== null && (!Number.isInteger(clean.correctIndex) || clean.correctIndex < 0 || clean.correctIndex >= clean.options.length)) invalid('Choose a valid correct answer.', `${field}.correctIndex`);
    if (complete && (!clean.prompt || clean.options.length < 2 || clean.options.some(option => !option) || clean.correctIndex === null
      || new Set(clean.options.map(option => option.normalize('NFKC').toLowerCase())).size !== clean.options.length)) invalid('Each question needs a prompt, two to five distinct nonempty options and one correct answer.', field);
    return clean;
  });
  if (complete && !result.title) invalid('Add a title before starting or publishing.', 'title');
  if (complete && !result.subject) invalid('Add a subject before starting or publishing.', 'subject');
  if (complete && !result.questions.length) invalid('Add at least one complete question.');
  return result;
}
function gradeStudy(snapshot, answers) {
  if (!Array.isArray(answers) || answers.length !== snapshot.questions.length || answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= snapshot.questions[i].options.length)) invalid('Answer every question with one valid option.', 'answers');
  const correct = answers.filter((answer, i) => answer === snapshot.questions[i].correctIndex).length;
  return { correct, total: snapshot.questions.length, score: Math.round(correct * 100 / snapshot.questions.length) };
}
const contentOf = row => ({ title: row.title, subject: row.subject, description: row.description, questions: row.questions.map(q => ({ prompt: q.prompt, options: [...q.options], correctIndex: q.correctIndex, explanation: q.explanation })) });
module.exports = { studyContent, gradeStudy, contentOf };
