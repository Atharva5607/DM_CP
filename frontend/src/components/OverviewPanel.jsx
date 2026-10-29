import { useMemo } from 'react';
import { LuLightbulb } from 'react-icons/lu';
import { RiskGauge, StatusBar } from '../viz/charts';
import { Stat } from './Controls';
import { keyFindings } from '../utils/insights';
import { minutes } from '../utils/graph';
import { useTween } from '../hooks/useTween';

const DRIVERS = [['loss', 'Service loss'], ['spread', 'Layers affected'], ['depth', 'Cascade depth'], ['structural', 'Structural damage']];

function Count({ value }) {
  return <>{Math.round(useTween(value, 800))}</>;
}

export default function OverviewPanel({ graph, simulation, analytics, comparison }) {
  const findings = useMemo(() => keyFindings(graph, simulation), [graph, simulation]);
  const cascade = analytics && analytics.simulation && analytics.simulation.cascade;
  const layersHit = Object.values(simulation.layers).filter((l) => l.affected > 0).length;
  return (
    <div className="nx-stack">
      <div className="nx-gauge-wrap"><RiskGauge risk={simulation.risk} /></div>
      {comparison && <p className="nx-success">Mitigation lowered risk from {comparison.before} to {comparison.after}.</p>}
      <div className="nx-stats">
        <Stat label="Components hit" value={<Count value={simulation.affected_nodes.length} />} hint={`of ${graph.nodes.length}`} />
        <Stat label="Layers hit" value={<Count value={layersHit} />} hint={`of ${graph.layers.length}`} />
        <Stat label="Cascade waves" value={<Count value={simulation.max_wave} />} />
        <Stat label="Slowest arrival" value={cascade ? minutes(cascade.longest_cascade.minutes) : 'n/a'} />
      </div>
      <div><h4 className="nx-subhead">Component status</h4><StatusBar counts={simulation.counts} /></div>
      <div>
        <h4 className="nx-subhead"><LuLightbulb /> Key findings</h4>
        <ul className="nx-findings">{findings.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      <div>
        <h4 className="nx-subhead">What drives the score</h4>
        <ul className="nx-drivers">
          {DRIVERS.map(([k, label]) => (
            <li key={k}><div><span>{label}</span><b>{Math.round(simulation.risk.components[k] * 100)}%</b></div>
              <span className="nx-track"><span style={{ width: `${simulation.risk.components[k] * 100}%` }} /></span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
