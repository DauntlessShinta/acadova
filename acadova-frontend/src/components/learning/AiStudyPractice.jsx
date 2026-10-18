import { useState } from 'react';
import { cardPosition, scoreAiPractice } from '../../utils/aiStudyPractice';
import { SourceEvidence } from './StrictStudyPreview';

function Source({ number, format }) { return number ? <p className="form-hint">Source {format === 'pptx' ? 'slide' : 'page'} {number}</p> : <p className="form-hint">Source reference unavailable. Check the original material.</p>; }
export default function AiStudyPractice({ item, onComplete }) {
  const cards = item.flashcards || []; const questions = item.questions || [];
  const [card, setCard] = useState(0); const [flipped, setFlipped] = useState(false);
  const [question, setQuestion] = useState(0); const [answers, setAnswers] = useState(Array(questions.length).fill(null));
  const [checked, setChecked] = useState(false); const [score, setScore] = useState(null); const [working, setWorking] = useState(false); const [error, setError] = useState('');
  const move = delta => { setCard(index => cardPosition(index, delta, cards.length)); setFlipped(false); };
  const finish = async () => {
    if (working) return; setWorking(true); setError('');
    try { const result = onComplete ? await onComplete(answers) : scoreAiPractice(questions, answers); setScore(result); }
    catch (failure) { setError(failure.message || 'Practice result could not be saved. Your answers are retained.'); }
    finally { setWorking(false); }
  };
  const reset = () => { setQuestion(0); setAnswers(Array(questions.length).fill(null)); setChecked(false); setScore(null); setError(''); };
  const q = questions[question];
  return <div className="ai-practice-grid">
    {cards.length > 0 && <section className="card ai-flashcards" aria-labelledby="ai-card-heading">
      <h2 id="ai-card-heading">Flashcards</h2><p className="form-hint">Click the card or press Enter / Space to flip. Use the arrow keys to move.</p>
      <p role="status" aria-live="polite">Card {card + 1} of {cards.length} · {flipped ? 'Answer' : 'Question'}</p>
      <button type="button" className="ai-flashcard" aria-label={`${flipped ? 'Answer' : 'Question'}: ${flipped ? cards[card].back : cards[card].front}. Flip card`} aria-pressed={flipped} onClick={() => setFlipped(value => !value)} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
      }}>{flipped ? cards[card].back : cards[card].front}</button>
      <Source number={cards[card].sourceRef} format={item.ai.sourceFormat} />
      <SourceEvidence item={cards[card]} format={item.ai.sourceFormat} />
      <div className="ai-actions"><button className="btn btn-secondary" disabled={card === 0} onClick={() => move(-1)}>Previous card</button><button className="btn btn-secondary" disabled={card === cards.length - 1} onClick={() => move(1)}>Next card</button><button className="btn btn-ghost" onClick={() => { setCard(0); setFlipped(false); }}>Restart cards</button></div>
    </section>}
    {questions.length > 0 && <section className="card ai-quiz" aria-labelledby="ai-quiz-heading">
      <h2 id="ai-quiz-heading">AI-generated practice quiz</h2><p className="form-hint">Zero credits. This practice does not affect official assessments or learning progress.</p>
      {score ? <><p className="ai-score" role="status">{score.score}% · {score.correct}/{score.total} correct</p><p>{onComplete ? 'Private practice result saved.' : 'Preview practice only. Save the set to keep future results.'}</p><button className="btn btn-primary" onClick={reset}>Retry practice quiz</button></> : <>
        <fieldset disabled={working}><legend>Question {question + 1} of {questions.length}: {q.prompt}</legend>
          {q.options.map((option, index) => <label className="ai-answer" key={index}><input type="radio" name={`ai-answer-${question}`} checked={answers[question] === index} disabled={checked} onChange={() => setAnswers(current => current.map((value, i) => i === question ? index : value))} /> <span>{option}</span></label>)}
        </fieldset>
        {checked && <div className="ai-feedback" role="status"><strong>{answers[question] === q.correctIndex ? 'Correct.' : 'Review this answer.'}</strong><p>Correct answer: {q.options[q.correctIndex]}</p><p>{q.explanation}</p><Source number={q.sourceRef} format={item.ai.sourceFormat} /></div>}
        {checked && <SourceEvidence item={q} format={item.ai.sourceFormat} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="ai-actions">{!checked ? <button className="btn btn-primary" disabled={answers[question] === null} onClick={() => setChecked(true)}>Check answer</button> : question < questions.length - 1 ? <button className="btn btn-primary" onClick={() => { setQuestion(value => value + 1); setChecked(false); }}>Next question</button> : <button className="btn btn-primary" disabled={working} onClick={finish}>{working ? 'Saving practice...' : error ? 'Retry saving result' : 'Finish practice quiz'}</button>}<button className="btn btn-ghost" disabled={working} onClick={reset}>Restart quiz</button></div>
      </>}
    </section>}
  </div>;
}
