import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBoxes, LuLayers, LuLink, LuNetwork, LuPlus, LuTrash2 } from 'react-icons/lu';
import { api } from '../services/api';
import { useNexus } from '../store/NexusContext';
import { useToast } from '../components/Toast';
import NetworkView from '../viz/NetworkView';
import EventPanel from '../components/EventPanel';
import { Segmented } from '../components/Controls';
import { DemoBanner, EmptyState, ErrorBanner, OfflineState, PageLoader } from '../components/Feedback';
import { sortLayers } from '../utils/graph';
import { LAYOUTS } from '../utils/layouts';

const KINDS = ['power', 'access', 'comm', 'service', 'command', 'control', 'facility'];
const TABS = [{ id: 'node', label: 'Node' }, { id: 'edge', label: 'Edge' }, { id: 'dep', label: 'Dependency' }, { id: 'event', label: 'Event' }];
const LAYOUT_ICONS = { layers: <LuLayers />, stack: <LuBoxes />, network: <LuNetwork /> };

function NodeSelect({ id, value, onChange, nodes, layers }) {
  return (
    <select id={id} className="nx-field" value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Choose a component</option>
      {layers.map((l) => (
        <optgroup key={l.id} label={l.name}>{nodes.filter((n) => n.layer === l.id).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</optgroup>
      ))}
    </select>
  );
}

export default function Builder() {
  const nx = useNexus();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('node');
  const [layout, setLayout] = useState('layers');
  const [node, setNode] = useState({ layer: 'power', label: '', type: 'generic', criticality: 5, zone: '', is_source: false });
  const [edge, setEdge] = useState({ source: '', target: '', weight: 1 });
  const [dep, setDep] = useState({ provider: '', dependent: '', kind: 'power', strength: 0.5, delay_min: 0 });
  const [selected, setSelected] = useState(null);
  const graph = nx.graph;
  const layers = useMemo(() => (graph ? sortLayers(graph.layers) : []), [graph]);

  if (nx.boot === 'loading') return <PageLoader />;
  if (nx.boot === 'offline') return <OfflineState onRetry={nx.bootstrap} onDemo={nx.enterDemo} message={nx.error} />;

  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const layerOfSource = graph.nodes.find((n) => n.id === edge.source)?.layer;

  // Clicking a node in the preview fills the next empty field of the active form.
  const onPick = (id) => {
    setSelected(id);
    if (!id) return;
    if (tab === 'edge') {
      if (!edge.source || edge.target) setEdge({ ...edge, source: id, target: '' });
      else if (graph.nodes.find((n) => n.id === id).layer === layerOfSource && id !== edge.source) setEdge({ ...edge, target: id });
    } else if (tab === 'dep') {
      if (!dep.provider || dep.dependent) setDep({ ...dep, provider: id, dependent: '' });
      else if (id !== dep.provider) setDep({ ...dep, dependent: id });
    }
  };

  const submitNode = (e) => {
    e.preventDefault();
    nx.edit(() => api.addNode({ ...node, criticality: Number(node.criticality), zone: node.zone || null })).then((ok) => { if (ok) { setNode({ ...node, label: '' }); toast.push('Node added.', 'ok'); } });
  };
  const submitEdge = (e) => {
    e.preventDefault();
    nx.edit(() => api.addEdge({ ...edge, weight: Number(edge.weight) })).then((ok) => { if (ok) { setEdge({ source: '', target: '', weight: 1 }); toast.push('Edge added.', 'ok'); } });
  };
  const submitDep = (e) => {
    e.preventDefault();
    nx.edit(() => api.addDependency({ ...dep, strength: Number(dep.strength), delay_min: Number(dep.delay_min) })).then((ok) => { if (ok) toast.push('Dependency added.', 'ok'); });
  };
  const runAndOpen = async (event) => {
    const sim = await nx.runEvent(event);
    if (sim) navigate('/dashboard');
  };

  const lists = [
    ['Nodes', graph.nodes, (n) => n.label, (n) => nx.edit(() => api.removeNode(n.id)), (n) => n.id],
    ['Edges', graph.edges, (e) => `${label(e.source)} to ${label(e.target)}`, (e) => nx.edit(() => api.removeEdge(e.id)), (e) => e.id],
    ['Dependencies', graph.dependencies, (d) => `${label(d.provider)} supports ${label(d.dependent)}`, (d) => nx.edit(() => api.removeDependency(d.id)), (d) => d.id],
  ];

  return (
    <div className="nx-dash">
      {nx.mode === 'demo' && <DemoBanner onRetry={nx.bootstrap} />}
      <div className="nx-dash-head">
        <div>
          <h1>Scenario builder</h1>
          <p>Start from a sample or the blank canvas, shape the infrastructure, then inject an event and open the dashboard.</p>
        </div>
        <div className="nx-row">
          <label htmlFor="b-scenario" className="nx-muted">Start from</label>
          <select id="b-scenario" className="nx-field fit" value={graph.scenario} onChange={(e) => nx.loadScenario(e.target.value)} disabled={nx.busy}>
            {nx.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <ErrorBanner message={nx.error} onDismiss={() => nx.setError(null)} />

      <div className="nx-builder">
        <aside className="nx-rail">
          <section className="nx-panel">
            <div className="nx-panel-body">
              <Segmented value={tab} onChange={setTab} options={TABS} label="Builder tools" size="fill" />
              <div className="nx-gap" />
              {tab === 'node' && (
                <form onSubmit={submitNode} className="nx-form">
                  <div><label className="nx-label" htmlFor="n-layer">Layer</label>
                    <select id="n-layer" className="nx-field" value={node.layer} onChange={(e) => setNode({ ...node, layer: e.target.value })}>{layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                  <div><label className="nx-label" htmlFor="n-label">Name</label>
                    <input id="n-label" className="nx-field" value={node.label} onChange={(e) => setNode({ ...node, label: e.target.value })} placeholder="North substation" required /></div>
                  <div className="nx-grid2">
                    <div><label className="nx-label" htmlFor="n-type">Type</label>
                      <input id="n-type" className="nx-field" list="node-types" value={node.type} onChange={(e) => setNode({ ...node, type: e.target.value })} />
                      <datalist id="node-types">{['junction', 'hospital', 'substation', 'tower', 'ambulance', 'control', 'supply', 'generic'].map((t) => <option key={t} value={t} />)}</datalist></div>
                    <div><label className="nx-label" htmlFor="n-zone">Zone</label>
                      <input id="n-zone" className="nx-field" value={node.zone} onChange={(e) => setNode({ ...node, zone: e.target.value })} placeholder="riverside" /></div>
                  </div>
                  <div><label className="nx-label" htmlFor="n-crit">Criticality <b>{node.criticality} of 10</b></label>
                    <input id="n-crit" type="range" min="1" max="10" value={node.criticality} onChange={(e) => setNode({ ...node, criticality: e.target.value })} className="nx-range" style={{ '--fill': `${((node.criticality - 1) / 9) * 100}%` }} /></div>
                  <label className="nx-check"><input type="checkbox" checked={node.is_source} onChange={(e) => setNode({ ...node, is_source: e.target.checked })} /> Feeds its layer (intake, core hub, control centre)</label>
                  <button className="nx-btn primary block" disabled={nx.busy}><LuPlus /> Add node</button>
                </form>
              )}
              {tab === 'edge' && (
                <form onSubmit={submitEdge} className="nx-form">
                  <p className="nx-hint">Edges join two components inside one layer. Click nodes in the preview to fill the fields.</p>
                  <div><label className="nx-label" htmlFor="e-src">From</label><NodeSelect id="e-src" value={edge.source} onChange={(v) => setEdge({ ...edge, source: v, target: '' })} nodes={graph.nodes} layers={layers} /></div>
                  <div><label className="nx-label" htmlFor="e-tgt">To</label>
                    <NodeSelect id="e-tgt" value={edge.target} onChange={(v) => setEdge({ ...edge, target: v })} nodes={graph.nodes.filter((n) => n.layer === layerOfSource && n.id !== edge.source)} layers={layers.filter((l) => l.id === layerOfSource)} /></div>
                  <div><label className="nx-label" htmlFor="e-w">Weight (minutes or cost)</label>
                    <input id="e-w" type="number" min="0.1" step="0.1" className="nx-field" value={edge.weight} onChange={(e) => setEdge({ ...edge, weight: e.target.value })} /></div>
                  <button className="nx-btn primary block" disabled={nx.busy || !edge.source || !edge.target}><LuPlus /> Add edge</button>
                </form>
              )}
              {tab === 'dep' && (
                <form onSubmit={submitDep} className="nx-form">
                  <p className="nx-hint">The dependent loses function when the provider fails. Providers of one kind for one dependent are redundant. Click nodes in the preview to fill the fields.</p>
                  <div><label className="nx-label" htmlFor="d-prov">Provider (what is relied on)</label><NodeSelect id="d-prov" value={dep.provider} onChange={(v) => setDep({ ...dep, provider: v })} nodes={graph.nodes} layers={layers} /></div>
                  <div><label className="nx-label" htmlFor="d-dep">Dependent (what relies on it)</label><NodeSelect id="d-dep" value={dep.dependent} onChange={(v) => setDep({ ...dep, dependent: v })} nodes={graph.nodes.filter((n) => n.id !== dep.provider)} layers={layers} /></div>
                  <div><label className="nx-label" htmlFor="d-kind">Kind</label>
                    <select id="d-kind" className="nx-field" value={dep.kind} onChange={(e) => setDep({ ...dep, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
                  <div><label className="nx-label" htmlFor="d-str">Strength <b>{Math.round(dep.strength * 100)}% lost if the provider is gone</b></label>
                    <input id="d-str" type="range" min="0.05" max="1" step="0.05" value={dep.strength} onChange={(e) => setDep({ ...dep, strength: e.target.value })} className="nx-range" style={{ '--fill': `${((dep.strength - 0.05) / 0.95) * 100}%` }} /></div>
                  <div><label className="nx-label" htmlFor="d-delay">Buffer before the loss is felt (minutes)</label>
                    <input id="d-delay" type="number" min="0" className="nx-field" value={dep.delay_min} onChange={(e) => setDep({ ...dep, delay_min: e.target.value })} /></div>
                  <button className="nx-btn primary block" disabled={nx.busy || !dep.provider || !dep.dependent}><LuLink /> Add dependency</button>
                </form>
              )}
              {tab === 'event' && (graph.nodes.length === 0
                ? <EmptyState icon={LuPlus} title="Add some components first">An event needs something to hit. Add nodes in the Node tab.</EmptyState>
                : <EventPanel graph={graph} busy={nx.busy} onRun={runAndOpen} compact readOnly={nx.mode === 'demo'} />)}
            </div>
          </section>
        </aside>

        <section className="nx-builder-main">
          <div className="nx-stage small">
            {graph.nodes.length === 0
              ? <EmptyState icon={LuPlus} title="This canvas is empty">Add a node on the left. The five layers are ready and waiting.</EmptyState>
              : <NetworkView graph={graph} simulation={null} layout={layout} selectedId={selected} onSelect={onPick} />}
            <div className="nx-stage-top"><Segmented value={layout} onChange={setLayout} label="Layout" size="sm" options={LAYOUTS.map((l) => ({ id: l.id, label: l.label, icon: LAYOUT_ICONS[l.id] }))} /></div>
          </div>
          <div className="nx-lists">
            {lists.map(([title, items, text, remove, key]) => (
              <section key={title} className="nx-card">
                <h3>{title} <span>{items.length}</span></h3>
                <ul>
                  {items.map((it) => (
                    <li key={key(it)}><span>{text(it)}</span><button aria-label={`Delete ${text(it)}`} onClick={() => remove(it)} disabled={nx.busy}><LuTrash2 /></button></li>
                  ))}
                  {items.length === 0 && <li className="empty">Nothing yet</li>}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
