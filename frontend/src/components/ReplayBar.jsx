import { useEffect, useState } from 'react';
import { LuPause, LuPlay, LuRotateCcw, LuSkipBack, LuSkipForward } from 'react-icons/lu';

/** Wave scrubber. `wave === null` means the final state. Each tick shows how many components that wave hit. */
export default function ReplayBar({ simulation, wave, onChange, autoplayKey }) {
  const [playing, setPlaying] = useState(false);
  const max = simulation.max_wave;
  const current = wave == null ? max : wave;
  // Tick number = components whose health changed in that wave (later waves often deepen damage rather than reach new nodes).
  const counts = Array.from({ length: max + 1 }, (_, w) => new Set(simulation.history.filter((s) => s.wave === w).map((s) => s.target)).size);

  useEffect(() => { setPlaying(false); }, [simulation.id]);
  useEffect(() => {
    if (!autoplayKey) return;
    onChange(0);
    setPlaying(true);
  }, [autoplayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => {
      if (current >= max) { setPlaying(false); onChange(null); } else onChange(current + 1);
    }, 1100);
    return () => clearTimeout(t);
  }, [playing, current, max, onChange]);

  const play = () => {
    if (playing) { setPlaying(false); return; }
    if (current >= max) onChange(0);
    setPlaying(true);
  };
  const step = (d) => { setPlaying(false); onChange(Math.min(Math.max(current + d, 0), max)); };
  return (
    <div className="nx-replay">
      <button className="nx-icon-btn" onClick={() => step(-1)} aria-label="Previous wave" disabled={current <= 0}><LuSkipBack /></button>
      <button className="nx-btn primary small" onClick={play} aria-label={playing ? 'Pause replay' : 'Replay the cascade'}>{playing ? <LuPause /> : <LuPlay />}{playing ? 'Pause' : 'Replay'}</button>
      <button className="nx-icon-btn" onClick={() => step(1)} aria-label="Next wave" disabled={current >= max}><LuSkipForward /></button>
      <div className="nx-ticks" role="group" aria-label="Cascade waves">
        <span className="nx-ticks-line"><span style={{ width: `${max ? (current / max) * 100 : 100}%` }} /></span>
        {counts.map((c, w) => (
          <button key={w} className={`${w <= current ? 'is-past' : ''}${w === current ? ' is-now' : ''}`} style={{ left: `${max ? (w / max) * 100 : 0}%` }}
            onClick={() => { setPlaying(false); onChange(w); }} aria-label={`Wave ${w}, ${c} components changed`} aria-pressed={w === current}>
            <b>{c}</b><span>{w === 0 ? 'Impact' : `Wave ${w}`}</span>
          </button>
        ))}
      </div>
      <button className="nx-icon-btn" onClick={() => { setPlaying(false); onChange(null); }} aria-label="Show final state"><LuRotateCcw /></button>
    </div>
  );
}
