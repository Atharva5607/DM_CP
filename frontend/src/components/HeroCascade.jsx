import { useEffect, useMemo, useState } from 'react';
import NetworkView from '../viz/NetworkView';
import { loadDemo, demoGraph } from '../demo';
import { prefersReducedMotion } from '../hooks/useTween';

/** The real stack view driven by the baked demo snapshot: the power outage replays on a loop. */
export default function HeroCascade() {
  const [demo, setDemo] = useState(null);
  const [wave, setWave] = useState(0);
  useEffect(() => { loadDemo().then(setDemo); }, []);

  const sim = demo ? demo.byScenario['power-outage'].simulation : null;
  const graph = useMemo(() => (demo ? demoGraph(demo, 'power-outage') : null), [demo]);

  useEffect(() => {
    if (!sim) return undefined;
    if (prefersReducedMotion()) { setWave(sim.max_wave); return undefined; }
    const t = setTimeout(() => setWave((w) => (w >= sim.max_wave + 2 ? 0 : w + 1)), wave === 0 ? 1500 : 1400);
    return () => clearTimeout(t);
  }, [sim, wave]);

  if (!demo) return <div className="nx-hero-skeleton" aria-hidden="true" />;
  const w = Math.min(wave, sim.max_wave);
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const hit = sim.waves.find((x) => x.wave === w);
  const names = sim.history.filter((s) => s.wave === w).map((s) => label(s.target));
  const caption = w === 0 ? `Impact: ${names.join(' and ')}` : `Wave ${w}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`;
  return (
    <figure className="nx-hero-stage">
      <NetworkView graph={graph} simulation={sim} wave={wave > sim.max_wave ? null : wave} layout="stack" interactive={false} showControls={false} fitKey="hero" />
      <figcaption>
        <span className="nx-hero-wave">{w === 0 ? 'Substation fails' : `Wave ${w}`}</span>
        <span>{caption}{hit ? ` · ${hit.nodes} component${hit.nodes === 1 ? '' : 's'}` : ''}</span>
      </figcaption>
    </figure>
  );
}
