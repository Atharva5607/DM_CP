import { LuArrowDownToLine, LuArrowUpFromLine, LuZap } from 'react-icons/lu';
import { useNexus } from '../store/NexusContext';
import { HealthBar, LayerChip, StatusBadge } from './Badges';
import { layerColor, layerName, minutes, stateAtWave } from '../utils/graph';
import { iconFor } from '../viz/nodeIcons';

function Row({ label, children }) {
  return <div className="nx-row-kv"><span>{label}</span><span>{children}</span></div>;
}

function DepList({ title, icon: Icon, items, state, labelOf, field, onPick }) {
  return (
    <div>
      <h4 className="nx-subhead"><Icon /> {title}</h4>
      {items.length === 0 ? <p className="nx-muted">None</p> : (
        <ul className="nx-list">
          {items.map((d) => {
            const other = d[field];
            const st = state ? state[other] : null;
            return (
              <li key={d.id}>
                <button onClick={() => onPick(other)}>
                  <span className="nx-list-main"><span>{labelOf(other)}</span>{st && <StatusBadge status={st.status} />}</span>
                  <span className="nx-list-sub">{d.kind}, strength {Math.round(d.strength * 100)}%{d.delay_min ? `, buffer ${d.delay_min} min` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function NodePanel({ nodeId, onPick, readOnly }) {
  const { graph, simulation, runEvent, busy, resolved } = useNexus();
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const labelOf = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const sim = simulation ? simulation.nodes[nodeId] : null;
  const state = simulation ? stateAtWave(simulation, simulation.max_wave) : null;
  const metrics = graph.structure.node_metrics[nodeId];
  const providers = graph.dependencies.filter((d) => d.dependent === nodeId);
  const dependents = graph.dependencies.filter((d) => d.provider === nodeId);
  const color = layerColor(graph.layers, node.layer);
  const Icon = iconFor(node.type);
  const restored = resolved.includes(nodeId);

  return (
    <div className="nx-stack">
      <div className="nx-node-head">
        <span className="nx-node-icon" style={{ '--c': color }}><Icon /></span>
        <div>
          <h3>{node.label}</h3>
          <div className="nx-row wrap"><LayerChip layer={node.layer} label={layerName(graph.layers, node.layer)} color={color} /><LayerChip layer="" label={node.type} color="#4f567a" />
            {sim && <StatusBadge status={restored ? 'resolved' : sim.status} />}</div>
        </div>
      </div>

      {sim && (
        <div>
          <div className="nx-meter-label"><span>Health</span><span>{Math.round(sim.health * 100)}%</span></div>
          <HealthBar value={sim.health} />
        </div>
      )}

      <div className="nx-kv">
        <Row label="Criticality">{node.criticality} of 10</Row>
        {node.zone && <Row label="Zone">{node.zone}</Row>}
        {node.capacity != null && <Row label="Capacity">{node.capacity}</Row>}
        <Row label="Repair time">{minutes(node.repair_minutes)}</Row>
        {metrics && <Row label="Components that rely on it, directly or not">{metrics.blast_radius}</Row>}
        {metrics && <Row label="Bottleneck score">{metrics.betweenness.toFixed(3)}</Row>}
        {metrics?.articulation && <Row label="Structure">Articulation point</Row>}
        {sim?.affected && <Row label="Hit in wave">{sim.wave}, after {minutes(sim.arrival_min)}</Row>}
      </div>

      {sim?.path.length > 1 && (
        <div>
          <h4 className="nx-subhead">How the failure reached this component</h4>
          <ol className="nx-path">
            {sim.path.map((id) => <li key={id}><button onClick={() => onPick(id)}>{labelOf(id)}</button></li>)}
          </ol>
        </div>
      )}

      <DepList title="Depends on" icon={LuArrowDownToLine} items={providers} state={state} labelOf={labelOf} field="provider" onPick={onPick} />
      <DepList title="Supports" icon={LuArrowUpFromLine} items={dependents} state={state} labelOf={labelOf} field="dependent" onPick={onPick} />

      <button className="nx-btn block" disabled={busy || readOnly} title={readOnly ? 'Needs the backend' : undefined}
        onClick={() => runEvent({ type: 'node_failure', name: `${node.label} failure`, target_nodes: [node.id], target_edges: [], zone: null, severity: 1 })}>
        <LuZap /> Simulate failure of this component
      </button>
    </div>
  );
}
