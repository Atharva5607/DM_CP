import { useMemo } from 'react';
import { LuLightbulb } from 'react-icons/lu';
import { RiskGauge, StatusBar } from '../viz/charts';
import { keyFindings } from '../utils/insights';

const DRIVERS = [['loss', 'Service loss'], ['spread', 'Layers affected'], ['depth', 'Cascade depth'], ['structural', 'Structural damage']];

export default function OverviewPanel({ graph, simulation, analytics, comparison }) {
  const findings = useMemo(() => keyFindings(graph, simulation), [graph, simulation]);
  return (
    <div className="nx-stack">
      <div className="nx-gauge-wrap"><RiskGauge risk={simulation.risk} /></div>
      {comparison && <p className="nx-success">Mitigation lowered risk from {comparison.before} to {comparison.after}.</p>}
      <div><h4 className="nx-subhead">Component status</h4><StatusBar counts={simulation.counts} /></div>
      <div>
        <h4 className="nx-subhead"><LuLightbulb /> Key findings</h4>
        <ul className="nx-findings">{findings.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      <details className="nx-more">
        <summary>What drives the score</summary>
        <ul className="nx-drivers">
          {DRIVERS.map(([k, label]) => (
            <li key={k}><div><span>{label}</span><b>{Math.round(simulation.risk.components[k] * 100)}%</b></div>
              <span className="nx-track"><span style={{ width: `${simulation.risk.components[k] * 100}%` }} /></span></li>
          ))}
        </ul>
      </details>
    </div>
  );
}
