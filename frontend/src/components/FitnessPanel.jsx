import { useEffect, useState } from 'react';

const DEFAULT_WORKOUT_MS = 60 * 1000; // shortened demo duration; real value comes from the server

export default function FitnessPanel({ workoutMinMs, onStart, onComplete }) {
  const duration = workoutMinMs || DEFAULT_WORKOUT_MS;
  const [startedAt, setStartedAt] = useState(null);
  const [remaining, setRemaining] = useState(0);

  function handleStart() {
    onStart();
    setStartedAt(Date.now());
    setRemaining(duration);
  }

  function handleComplete() {
    onComplete();
    setStartedAt(null);
  }

  useEffect(() => {
    if (!startedAt) return undefined;
    const interval = setInterval(() => {
      setRemaining(Math.max(0, duration - (Date.now() - startedAt)));
    }, 250);
    return () => clearInterval(interval);
  }, [startedAt, duration]);

  const ready = startedAt && remaining === 0;

  return (
    <div className="fitness-panel">
      <h2>Fitness Mode</h2>
      {!startedAt && (
        <button type="button" onClick={handleStart}>
          Start Workout
        </button>
      )}
      {startedAt && !ready && <p className="join-note">{Math.ceil(remaining / 1000)}s remaining…</p>}
      {ready && (
        <button type="button" onClick={handleComplete}>
          Claim Second Wind
        </button>
      )}
    </div>
  );
}
