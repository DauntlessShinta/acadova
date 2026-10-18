export default function LearningProgress({ progress, label = 'Learning progress' }) {
  if (!progress) return null;
  return <div className="learning-progress">
    <p>{label}: <strong>{progress.percent == null ? 'No published curriculum' : `${progress.percent}%`}</strong></p>
    {progress.percent != null && <progress aria-label={label} value={progress.completedRequirements} max={progress.totalRequirements} />}
    {progress.totalRequirements > 0 && <p className="form-hint">{progress.completedRequirements} of {progress.totalRequirements} requirements completed</p>}
  </div>;
}
