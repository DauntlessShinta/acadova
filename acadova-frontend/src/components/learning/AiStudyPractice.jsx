import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Copy, Eye, Maximize2, Minimize2, RotateCcw, Shuffle } from 'lucide-react';
import { cardPosition, scoreAiPractice, shuffledCardOrder } from '../../utils/aiStudyPractice';
import { SourceEvidence } from './StrictStudyPreview';

function Source({ number, format }) { return number ? <p className="form-hint">Source {format === 'pptx' ? 'slide' : 'page'} {number}</p> : <p className="form-hint">Source reference unavailable. Check the original material.</p>; }
export default function AiStudyPractice({ item, onComplete }) {
  const authored = item.origin === 'manual';
  const sourceFormat = item.ai?.sourceFormat;
  const cards = item.flashcards || []; const questions = item.questions || [];
  const section = useRef(null); const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState(() => cards.map((_, index) => index));
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
  const q = questions[question]; const currentCard = cards[order[card]];
  useEffect(() => { const changed = () => setExpanded(document.fullscreenElement === section.current); document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed); }, []);
  const fullscreen = async () => { try { if (document.fullscreenElement === section.current) await document.exitFullscreen(); else if (section.current?.requestFullscreen) await section.current.requestFullscreen(); else setExpanded(value => !value); } catch { setExpanded(value => !value); } };

  return <>
    <nav className="ai-material-nav" aria-label="Study sections">
      {cards.length > 0 && <a href="#ai-card-heading"><Copy size={19} aria-hidden="true"/> Flashcards <span>({cards.length})</span></a>}
      {questions.length > 0 && <a href="#ai-quiz-heading"><CircleHelp size={19} aria-hidden="true"/> Practice Quiz <span>({questions.length})</span></a>}
    </nav>
    <div className="ai-practice-grid">
    {cards.length > 0 && <section ref={section} className={`card ai-flashcards${expanded ? ' is-expanded' : ''}`} aria-labelledby="ai-card-heading">
      <header className="ai-practice-heading"><span className="ai-practice-icon"><Copy size={22} aria-hidden="true"/></span><div><h2 id="ai-card-heading" tabIndex={-1}>Flashcards</h2><p>{authored ? 'Review your authored flashcards. Click a card to flip.' : 'Review your source material. Click a card to flip.'}</p></div></header>
      <div className="ai-card-position"><span role="status" aria-live="polite">Card {card + 1} of {cards.length}</span><span>{flipped ? 'Answer' : 'Question'}</span></div>
      <progress className="ai-study-progress" aria-label="Flashcard progress" value={card + 1} max={cards.length}/>
      <div className="ai-card-stage">
        <div className="ai-card-stack">
          <button type="button" className="ai-flashcard" aria-label={`${flipped ? 'Answer' : 'Question'}: ${flipped ? currentCard.back : currentCard.front}. Flip card`} aria-pressed={flipped} onClick={() => setFlipped(value => !value)} onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
          }}><span className="ai-card-face-label">{flipped ? <Check size={15} aria-hidden="true"/> : <Copy size={15} aria-hidden="true"/>}{flipped ? 'Answer' : authored ? 'Personal practice' : 'Source practice'}</span><span className="ai-card-text">{flipped ? currentCard.back : currentCard.front}</span><span className="ai-card-reveal"><Eye size={17} aria-hidden="true"/>{flipped ? 'Click to see question' : 'Click to reveal answer'}</span></button>
        </div>
        <button className="ai-card-arrow ai-card-prev" disabled={card === 0} onClick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true"/><span className="sr-only">Previous card</span></button>
        <button className="ai-card-arrow ai-card-next" disabled={card === cards.length - 1} onClick={() => move(1)}><ArrowRight size={19} aria-hidden="true"/><span className="sr-only">Next card</span></button>
      </div>
      <p className="ai-keyboard-hint">Enter / Space to flip <span aria-hidden="true">/</span> Arrow keys to move</p>
      <SourceEvidence item={currentCard} format={sourceFormat} />
      <footer className="ai-study-toolbar"><button className="btn btn-secondary" onClick={() => { setOrder(shuffledCardOrder(cards.length)); setCard(0); setFlipped(false); }}><Shuffle size={17} aria-hidden="true"/>Shuffle cards</button><button className="btn btn-ghost" onClick={() => { setCard(0); setFlipped(false); }}><RotateCcw size={16} aria-hidden="true"/>Restart cards</button><button className="btn btn-secondary" onClick={fullscreen} aria-pressed={expanded}>{expanded ? <Minimize2 size={17} aria-hidden="true"/> : <Maximize2 size={17} aria-hidden="true"/>}{expanded ? 'Exit expanded cards' : 'Expand cards'}</button></footer>
    </section>}
    {questions.length > 0 && <section className="card ai-quiz" aria-labelledby="ai-quiz-heading">
      <header className="ai-practice-heading"><span className="ai-practice-icon ai-quiz-icon"><CircleHelp size={22} aria-hidden="true"/></span><div><h2 id="ai-quiz-heading" tabIndex={-1}>Practice Quiz</h2><p>Check your understanding, one question at a time.</p></div></header>
      <progress className="ai-study-progress" aria-label="Quiz progress" value={answers.filter(value => value !== null).length} max={questions.length}/>
      {score ? <div className="ai-quiz-result"><span className="ai-result-icon"><Check size={25} aria-hidden="true"/></span><h3>Practice complete</h3><p className="ai-score" role="status">{score.score}% <span>{score.correct}/{score.total} correct</span></p><p>{onComplete ? 'Private practice result saved.' : 'Preview practice only. Save the set to keep future results.'}</p><button className="btn btn-primary" onClick={reset}><RotateCcw size={17} aria-hidden="true"/>Retry practice quiz</button><details className="ai-answer-review"><summary>Review all answers</summary>{questions.map((entry, index) => <article key={index}><h3>Question {index + 1}</h3><p>{entry.prompt}</p><p>Your answer: {entry.options[answers[index]]}</p><p>Correct answer: {entry.options[entry.correctIndex]}</p><SourceEvidence item={entry} format={sourceFormat}/></article>)}</details></div> : <div className="ai-question-card">
        <fieldset disabled={working}><legend><span className="ai-question-position">Question {question + 1} of {questions.length}</span><span className="ai-question-prompt">{q.prompt}</span></legend>
          {q.options.map((option, index) => <label className={`ai-answer${checked && index === q.correctIndex ? ' is-correct' : ''}${checked && answers[question] === index && index !== q.correctIndex ? ' is-incorrect' : ''}`} key={index}><input type="radio" name={`ai-answer-${question}`} checked={answers[question] === index} disabled={checked} onChange={() => setAnswers(current => current.map((value, i) => i === question ? index : value))} /><span className="ai-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span>{checked && index === q.correctIndex && <Check className="ai-option-check" size={17} aria-hidden="true"/>}</label>)}
        </fieldset>
        {checked && <div className="ai-feedback" role="status"><strong>{answers[question] === q.correctIndex ? 'Correct.' : 'Review this answer.'}</strong><p>Correct answer: {q.options[q.correctIndex]}</p><p>{q.explanation}</p><Source number={q.sourceRef} format={sourceFormat} /></div>}
        {checked && <SourceEvidence item={q} format={sourceFormat} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="ai-actions ai-quiz-actions">{!checked ? <button className="btn btn-primary" disabled={answers[question] === null} onClick={() => setChecked(true)}>Submit Answer<ArrowRight size={17} aria-hidden="true"/></button> : question < questions.length - 1 ? <button className="btn btn-primary" onClick={() => { setQuestion(value => value + 1); setChecked(false); }}>Next question<ArrowRight size={17} aria-hidden="true"/></button> : <button className="btn btn-primary" disabled={working} onClick={finish}>{working ? 'Saving practice...' : error ? 'Retry saving result' : 'Finish practice quiz'}<ArrowRight size={17} aria-hidden="true"/></button>}<button className="btn btn-ghost" disabled={working} onClick={reset}>Restart quiz</button></div>
      </div>}
      <p className="ai-practice-disclaimer">AI-generated practice / Zero credits. This does not affect official assessments or learning progress.</p>
    </section>}
    </div>
  </>;
}
