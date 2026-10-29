import { useEffect, useMemo, useState } from 'react';
import { LuCrosshair, LuFlaskConical, LuHospital, LuPlay, LuRadioTower, LuTrafficCone, LuWaves, LuX, LuZap } from 'react-icons/lu';
import { EVENT_TYPES } from '../utils/graph';

const ICONS = { road_block: LuTrafficCone, power_failure: LuZap, tower_outage: LuRadioTower, flood: LuWaves, hospital_overload: LuHospital, node_failure: LuCrosshair };
const blank = { type: 'power_failure', name: '', nodes: [], edges: [], zone: '', severity: 1 };
const fromPreset = (e) => ({ type: e.type, name: e.name, nodes: e.target_nodes, edges: e.target_edges, zone: e.zone || '', severity: e.severity });

export default function EventPanel({ graph, busy, onRun, compact = false, readOnly = false }) {
  const presets = graph.events;
  const [form, setForm] = useState(presets[0] ? fromPreset(presets[0]) : blank);
  useEffect(() => setForm(graph.events[0] ? fromPreset(graph.events[0]) : blank), [graph.scenario]); // eslint-disable-line

  const def = EVENT_TYPES.find((t) => t.id === form.type);
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const zones = useMemo(() => [...new Set(graph.nodes.map((n) => n.zone).filter(Boolean))], [graph.nodes]);
  const nodeOptions = graph.nodes.filter((n) => !def.layer || n.layer === def.layer);
  const edgeOptions = graph.edges.filter((e) => e.layer === 'traffic');
  const hasTarget = def.target === 'zone' ? !!form.zone : def.target === 'edge' ? form.edges.length > 0 : form.nodes.length > 0;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const chips = def.target === 'edge' ? form.edges : form.nodes;
  const key = def.target === 'edge' ? 'edges' : 'nodes';

  const submit = (e) => {
    e.preventDefault();
    onRun({
      type: form.type, name: form.name || def.label,
      target_nodes: def.target === 'node' ? form.nodes : [], target_edges: def.target === 'edge' ? form.edges : [],
      zone: def.target === 'zone' ? form.zone : null, severity: Number(form.severity),
    });
  };

  return (
    <form onSubmit={submit} className="nx-form">
      {presets.length > 0 && !compact && (
        <div>
          <span className="nx-label">Scenario events</span>
          <div className="nx-pills">
            {presets.map((p) => <button type="button" key={p.id} className="nx-pill" onClick={() => setForm(fromPreset(p))}><LuFlaskConical />{p.name}</button>)}
          </div>
        </div>
      )}

      <div>
        <span className="nx-label" id="ev-type-label">Event type</span>
        <div className="nx-types" role="radiogroup" aria-labelledby="ev-type-label">
          {EVENT_TYPES.map((t) => {
            const I = ICONS[t.id];
            return (
              <button type="button" role="radio" aria-checked={form.type === t.id} key={t.id} className={form.type === t.id ? 'is-on' : ''}
                onClick={() => set({ type: t.id, nodes: [], edges: [], zone: '' })}>
                <I /><span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {def.target === 'zone' ? (
        <div>
          <label className="nx-label" htmlFor="ev-zone">Flooded zone</label>
          <select id="ev-zone" className="nx-field" value={form.zone} onChange={(e) => set({ zone: e.target.value })}>
            <option value="">Choose a zone</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className="nx-label" htmlFor="ev-target">{def.target === 'edge' ? 'Blocked roads' : 'Affected components'}</label>
          <select id="ev-target" className="nx-field" value="" onChange={(e) => e.target.value && !chips.includes(e.target.value) && set({ [key]: [...chips, e.target.value] })}>
            <option value="">{chips.length ? 'Add another' : 'Choose a target'}</option>
            {def.target === 'edge'
              ? edgeOptions.map((e) => <option key={e.id} value={e.id}>{label(e.source)} to {label(e.target)}</option>)
              : nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          {chips.length > 0 && (
            <ul className="nx-tags">
              {chips.map((id) => {
                const edge = graph.edges.find((e) => e.id === id);
                return (
                  <li key={id}>{edge ? `${label(edge.source)} to ${label(edge.target)}` : label(id)}
                    <button type="button" aria-label={`Remove ${id}`} onClick={() => set({ [key]: chips.filter((c) => c !== id) })}><LuX /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <label className="nx-label" htmlFor="ev-sev">Severity <b>{Math.round(form.severity * 100)}%</b></label>
        <input id="ev-sev" type="range" min="0.1" max="1" step="0.05" value={form.severity} onChange={(e) => set({ severity: e.target.value })} className="nx-range" style={{ '--fill': `${((form.severity - 0.1) / 0.9) * 100}%` }} />
      </div>

      <button className="nx-btn primary block" disabled={busy || !hasTarget}><LuPlay /> {busy ? 'Analysing' : 'Run cascade analysis'}</button>
      {!hasTarget && <p className="nx-hint">Pick at least one target to run the analysis.</p>}
      {readOnly && <p className="nx-hint">Snapshot mode: only the built-in scenario events can be replayed.</p>}
    </form>
  );
}
