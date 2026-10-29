import { LuGitBranch } from 'react-icons/lu';
import { EmptyState } from './Feedback';
import { minutes } from '../utils/graph';

/** Propagation log: the recorded history of the cascade, grouped by wave. */
export default function TracePanel({ graph, simulation, wave, onPick }) {
  if (!simulation) return <EmptyState icon={LuGitBranch} title="No propagation yet">Run an event to see how it travels through the dependency links.</EmptyState>;
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const byWave = {};
  simulation.history.forEach((s) => (byWave[s.wave] = [...(byWave[s.wave] || []), s]));
  const viaText = (s) => (s.via === 'event' ? 'hit by the event' : s.via === 'isolation' ? 'cut off from its layer' : s.via === 'layer-connectivity' ? `stranded after ${s.source ? label(s.source) : 'a failure'}` : `${s.kind} dependency on ${label(s.source)}`);
  const current = wave == null ? simulation.max_wave : wave;
  return (
    <div className="nx-stack">
      <p className="nx-muted">{simulation.propagation_links.length} dependency links carried the failure across components.</p>
      {Object.entries(byWave).map(([w, steps]) => (
        <section key={w} className={`nx-wave${Number(w) === current ? ' is-now' : ''}${Number(w) > current ? ' is-future' : ''}`}>
          <h4 className="nx-subhead">{w === '0' ? 'Initial impact' : `Wave ${w}`}</h4>
          <ul className="nx-list">
            {steps.map((s, i) => (
              <li key={i}>
                <button onClick={() => onPick(s.target)}>
                  <span className="nx-list-main"><span>{label(s.target)}</span><span className="nx-delta">{Math.round(s.health_before * 100)}% to {Math.round(s.health_after * 100)}%</span></span>
                  <span className="nx-list-sub">{viaText(s)}{s.time_min ? `, felt after ${minutes(s.time_min)}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
