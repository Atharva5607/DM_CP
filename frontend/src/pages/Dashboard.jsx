import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LuActivity, LuBoxes, LuChartBar, LuCrosshair, LuEye, LuGitBranch, LuLayers, LuMaximize, LuMinimize, LuMousePointerClick, LuPanelLeftClose, LuPanelLeftOpen, LuPanelRightClose, LuPanelRightOpen,
  LuNetwork, LuPlay, LuShieldAlert, LuSparkles, LuZap,
} from 'react-icons/lu';
import { useNexus } from '../store/NexusContext';
import { usePageCommands } from '../store/PaletteContext';
import { useToast } from '../components/Toast';
import NetworkView from '../viz/NetworkView';
import { ArrivalTimeline, BarList, DependencyMatrix, ImpactFlow, LayerRadar, WaveBars } from '../viz/charts';
import EventPanel from '../components/EventPanel';
import OverviewPanel from '../components/OverviewPanel';
import RecommendationsPanel from '../components/RecommendationsPanel';
import TracePanel from '../components/TracePanel';
import NodePanel from '../components/NodePanel';
import ReplayBar from '../components/ReplayBar';
import { Panel, Segmented, Switch } from '../components/Controls';
import { DemoBanner, EmptyState, ErrorBanner, OfflineState, PageLoader } from '../components/Feedback';
import { STATUS, eventBody, layerColor, layerName, sortLayers } from '../utils/graph';
import { LAYOUTS } from '../utils/layouts';
import { prefersReducedMotion, useTween } from '../hooks/useTween';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LuActivity /> },
  { id: 'actions', label: 'Actions', icon: <LuSparkles /> },
  { id: 'trace', label: 'Trace', icon: <LuGitBranch /> },
  { id: 'node', label: 'Detail', icon: <LuMousePointerClick /> },
];
const GROUPS = [
  { id: 'impact', n: 'A', title: 'Impact', lede: 'How far the failure reached and where it flowed.' },
  { id: 'timing', n: 'B', title: 'Timing', lede: 'How the cascade unfolded, wave by wave and minute by minute.' },
  { id: 'structure', n: 'C', title: 'Structure', lede: 'Where the network is fragile before anything fails.' },
];
const NARR = [
  { t: 'Inject', d: 'Choose what fails, then scroll.' },
  { t: 'Cascade', d: 'Scroll to step the failure through each wave.' },
  { t: 'Diagnose', d: 'Risk, drivers and ranked actions.' },
];
function Num({ value, dec = 0 }) {
  return <>{useTween(value, 900).toFixed(dec)}</>;
}
const LAYOUT_ICONS = { layers: <LuLayers />, stack: <LuBoxes />, network: <LuNetwork /> };

function Card({ fig, title, sub, children, span = 6 }) {
  return (
    <section className="nx-card insight nx-reveal" style={{ '--span': span, '--d': `${(Number(fig) % 2) * 110}ms` }}>
      <header><span className="nx-fig">Fig. {fig}</span><h3>{title}</h3>{sub && <p>{sub}</p>}</header>
      <div>{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const nx = useNexus();
  const toast = useToast();
  const [params] = useSearchParams();
  const [wave, setWave] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [showDeps, setShowDeps] = useState(true);
  const [tab, setTab] = useState('overview');
  const [layout, setLayout] = useState('layers');
  const [focus, setFocus] = useState(null);
  const [full, setFull] = useState(false);
  const [railL, setRailL] = useState(true);
  const [railR, setRailR] = useState(true);
  const [chap, setChap] = useState('impact');
  const [cp, setCp] = useState(0); // console chapter: 0 inject, 1 cascade, 2 diagnose
  const consoleRef = useRef(null);
  const live = useRef({ sim: null, full: false, wave: undefined, ch: 0 });
  live.current.sim = nx.simulation;
  live.current.full = full;
  const started = useRef(false);

  // First visit: load the requested scenario and run its preset event so the cascade shows immediately.
  useEffect(() => {
    if (nx.boot !== 'ready' || started.current) return;
    started.current = true;
    (async () => {
      const wanted = params.get('scenario');
      let g = nx.graph;
      if (wanted && wanted !== g.scenario && nx.scenarios.some((s) => s.id === wanted)) g = await nx.loadScenario(wanted);
      if (g && g.events.length && !nx.simulation) nx.runEvent(eventBody(g.events[0]));
    })();
  }, [nx.boot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!nx.simulation || nx.simulation.mitigations.length) setWave(null); }, [nx.simulation && nx.simulation.id]); // eslint-disable-line
  useEffect(() => { if (selected) setTab('node'); }, [selected]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Scroll choreography: figures reveal as they enter, and a hairline tracks page progress.
  useEffect(() => {
    if (nx.boot !== 'ready') return undefined;
    const root = document.querySelector('.nx-dash');
    if (!root) return undefined;
    root.classList.add('is-armed');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    root.querySelectorAll('.nx-reveal').forEach((el) => io.observe(el));
    const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setChap(e.target.dataset.id); }), { rootMargin: '-35% 0px -60% 0px' });
    root.querySelectorAll('.nx-group-head').forEach((el) => spy.observe(el));
    const bar = root.querySelector('.nx-bar');
    const ro = new ResizeObserver(() => root.style.setProperty('--bar-h', `${bar.offsetHeight}px`));
    ro.observe(bar);
    let raf = 0;
    // Inside the pinned console the page scroll is the cascade clock: the wave advances as you scroll.
    const scrub = (userScrolled) => {
      const c = consoleRef.current, st = live.current;
      if (!c || st.full || window.innerWidth <= 1000) return;
      const r = c.getBoundingClientRect(), pinTop = bar.getBoundingClientRect().bottom;
      const p = Math.min(1, Math.max(0, (pinTop - r.top) / Math.max(1, r.height - (window.innerHeight - pinTop))));
      c.style.setProperty('--cp', String(p));
      const ch = p < 0.2 ? 0 : p < 0.78 ? 1 : 2;
      if (ch !== st.ch) { st.ch = ch; setCp(ch); }
      const sim = st.sim;
      if (!userScrolled || !sim || sim.mitigations.length) return;
      const w = ch === 2 ? null : ch === 0 ? 0 : Math.min(sim.max_wave, Math.floor(((p - 0.2) / 0.58) * (sim.max_wave + 1)));
      if (w !== st.wave) { st.wave = w; setWave(w); }
    };
    const onScroll = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        root.style.setProperty('--p', String(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)));
        scrub(Boolean(e && e.type === 'scroll'));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); spy.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); root.classList.remove('is-armed'); };
  }, [nx.boot]);

  // Touch and pointer feedback: stage spotlight, magnetic buttons, tilting figures, tap ripples.
  useEffect(() => {
    if (nx.boot !== 'ready' || prefersReducedMotion()) return undefined;
    const root = document.querySelector('.nx-dash');
    if (!root) return undefined;
    let raf = 0;
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      const { clientX: x, clientY: y, target } = e;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const stage = target.closest('.nx-stage'), btn = target.closest('.nx-btn, .nx-icon-btn'), card = target.closest('.nx-card.insight');
        if (stage) { const r = stage.getBoundingClientRect(); stage.style.setProperty('--mx', `${x - r.left}px`); stage.style.setProperty('--my', `${y - r.top}px`); }
        if (btn) { const r = btn.getBoundingClientRect(); btn.style.setProperty('--tx', `${(x - r.left - r.width / 2) * 0.07}px`); btn.style.setProperty('--ty', `${(y - r.top - r.height / 2) * 0.07}px`); }
        if (card) {
          const r = card.getBoundingClientRect(), u = (x - r.left) / r.width, v = (y - r.top) / r.height;
          card.style.setProperty('--ry', `${(u - 0.5) * 5}deg`); card.style.setProperty('--rx', `${(0.5 - v) * 4}deg`);
          card.style.setProperty('--sx', `${u * 100}%`); card.style.setProperty('--sy', `${v * 100}%`);
        }
      });
    };
    const onOut = (e) => {
      const el = e.target.closest('.nx-btn, .nx-icon-btn, .nx-card.insight');
      if (!el || el.contains(e.relatedTarget)) return;
      ['--tx', '--ty'].forEach((k) => el.style.setProperty(k, '0px'));
      ['--rx', '--ry'].forEach((k) => el.style.setProperty(k, '0deg'));
    };
    const onDown = (e) => {
      const el = e.target.closest('.nx-btn, .nx-icon-btn, .nx-seg button, .nx-types button, .nx-pill');
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, ring = document.createElement('span');
      ring.className = 'nx-tap';
      ring.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      ring.addEventListener('animationend', () => ring.remove());
      el.appendChild(ring);
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerout', onOut);
    root.addEventListener('pointerdown', onDown, { passive: true });
    return () => { cancelAnimationFrame(raf); root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerout', onOut); root.removeEventListener('pointerdown', onDown); };
  }, [nx.boot]);

  const { graph, simulation, mode } = nx;
  const readOnly = mode === 'demo';
  const layers = graph ? sortLayers(graph.layers) : [];

  const run = async (event) => {
    setSelected(null);
    const sim = await nx.runEvent(event);
    if (sim) toast.push(`Cascade computed: risk ${sim.risk.score}, ${sim.affected_nodes.length} components affected.`, 'ok');
    return sim;
  };
  const switchScenario = async (id) => {
    setSelected(null);
    const g = await nx.loadScenario(id);
    if (g && g.events.length && mode !== 'demo') nx.runEvent(eventBody(g.events[0]));
  };
  const apply = async (m) => {
    const out = await nx.mitigate(m);
    if (out) toast.push(`Risk lowered from ${out.before_risk} to ${out.after_risk}.`, 'ok');
  };
  const pick = (id) => { setSelected(id); setFocus({ id, n: Date.now() }); };

  const commands = useMemo(() => {
    if (!graph) return [];
    const c = [];
    graph.events.forEach((e) => c.push({ id: `run-${e.id}`, group: 'Simulation', label: `Run: ${e.name}`, hint: e.type.replace('_', ' '), icon: <LuPlay />, run: () => run(eventBody(e)) }));
    nx.scenarios.filter((s) => s.id !== 'blank').forEach((s) => c.push({ id: `sc-${s.id}`, group: 'Scenario', label: `Switch to ${s.name}`, icon: <LuZap />, run: () => switchScenario(s.id) }));
    LAYOUTS.forEach((l) => c.push({ id: `view-${l.id}`, group: 'View', label: `View: ${l.label}`, icon: LAYOUT_ICONS[l.id], run: () => setLayout(l.id) }));
    c.push({ id: 'deps', group: 'View', label: showDeps ? 'Hide dependencies' : 'Show dependencies', icon: <LuEye />, run: () => setShowDeps((v) => !v) });
    c.push({ id: 'full', group: 'View', label: full ? 'Exit focus mode' : 'Focus mode', icon: <LuMaximize />, run: () => setFull((v) => !v) });
    TABS.slice(0, 3).forEach((t) => c.push({ id: `tab-${t.id}`, group: 'Panels', label: `Open ${t.label}`, icon: t.icon, run: () => setTab(t.id) }));
    graph.nodes.forEach((n) => c.push({ id: `n-${n.id}`, group: 'Components', label: n.label, hint: layerName(graph.layers, n.layer), icon: <LuCrosshair />, run: () => pick(n.id) }));
    return c;
  }, [graph, nx.scenarios, showDeps, full]); // eslint-disable-line react-hooks/exhaustive-deps
  usePageCommands(commands);

  if (nx.boot === 'loading') return <PageLoader />;
  if (nx.boot === 'offline') return <OfflineState onRetry={nx.bootstrap} onDemo={nx.enterDemo} message={nx.error} />;

  const toggleLayer = (id) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  const scenarioTabs = nx.scenarios.filter((s) => s.id !== 'blank' || graph.scenario === 'blank').map((s) => ({ id: s.id, label: s.name }));
  const ev = simulation && simulation.event;
  const autoplayKey = simulation && simulation.mitigations.length === 0 ? simulation.id : null;

  return (
    <div className="nx-dash">
      <div className="nx-progress" aria-hidden="true" />
      {readOnly && <DemoBanner onRetry={nx.bootstrap} />}
      <header className="nx-bar">
        <div className="nx-bar-title">
          <h1>Dependency dashboard</h1>
          <span>{graph.nodes.length} components · {graph.edges.length} links · {graph.dependencies.length} dependencies</span>
        </div>
        <Segmented value={graph.scenario} onChange={switchScenario} options={scenarioTabs} label="Scenario" variant="tabs" />
        {simulation && (
          <dl className="nx-readouts" aria-label="Simulation readouts">
            <div className={`is-${simulation.risk.level}`}><dt>Risk</dt><dd><Num value={simulation.risk.score} dec={1} /><small>{simulation.risk.level}</small></dd></div>
            <div><dt>Affected</dt><dd><Num value={simulation.affected_nodes.length} /><small>of {graph.nodes.length}</small></dd></div>
            <div><dt>Layers hit</dt><dd><Num value={Object.values(simulation.layers).filter((l) => l.affected > 0).length} /><small>of {graph.layers.length}</small></dd></div>
            <div><dt>Waves</dt><dd><Num value={simulation.max_wave} /></dd></div>
            <div><dt>Slowest</dt><dd><Num value={Math.max(0, ...simulation.history.map((h) => h.time_min))} /><small>min</small></dd></div>
          </dl>
        )}
      </header>
      <ErrorBanner message={nx.error} onDismiss={() => nx.setError(null)} />

      <section className={`nx-console${full ? ' is-full' : ''}${railL ? ' has-l' : ''}${railR ? ' has-r' : ''}`} ref={consoleRef} data-chapter={cp} aria-label="Simulation console">
        <div className="nx-pin">
          <section className="nx-stage has-bar" aria-label="Graph view">
            <NetworkView graph={graph} simulation={simulation} wave={wave} layout={layout} hiddenLayers={hidden} showDeps={showDeps}
              selectedId={selected} resolved={nx.resolved} onSelect={setSelected} focus={focus} fitKey={full ? 'full' : 'normal'} />
            <div className="nx-stage-top">
              <button className="nx-icon-btn glass" onClick={() => setRailL(!railL)} aria-label={railL ? 'Hide controls' : 'Show controls'} title={railL ? 'Hide controls' : 'Show controls'}>{railL ? <LuPanelLeftClose /> : <LuPanelLeftOpen />}</button>
              <Segmented value={layout} onChange={setLayout} label="Layout" size="sm"
                options={LAYOUTS.map((l) => ({ id: l.id, label: l.label, icon: LAYOUT_ICONS[l.id] }))} />
              {ev && (
                <div className="nx-event-chip" title={ev.name}>
                  <LuZap /><b>{ev.name || ev.type}</b>
                  <span>severity {Math.round(ev.severity * 100)}%</span>
                </div>
              )}
              <span className="nx-spacer" />
              <button className="nx-icon-btn glass" onClick={() => setRailR(!railR)} aria-label={railR ? 'Hide inspector' : 'Show inspector'} title={railR ? 'Hide inspector' : 'Show inspector'}>{railR ? <LuPanelRightClose /> : <LuPanelRightOpen />}</button>
              <button className="nx-icon-btn glass" onClick={() => setFull(!full)} aria-label={full ? 'Exit focus mode' : 'Focus mode'} title="Focus mode">{full ? <LuMinimize /> : <LuMaximize />}</button>
            </div>
            <ul className="nx-key" aria-label="Legend">
              {['safe', 'warning', 'critical', 'failed', 'isolated', 'resolved'].map((k) => <li key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].label}</li>)}
            </ul>
            {simulation ? (
              <div className="nx-stage-bottom"><ReplayBar simulation={simulation} wave={wave} onChange={setWave} autoplayKey={autoplayKey} /></div>
            ) : (
              <div className="nx-stage-bottom"><p className="nx-hint-pill">Choose an event on the left to watch the failure spread.</p></div>
            )}
          </section>
          <aside className={`nx-dock left${railL ? '' : ' is-hidden'}`} aria-label="Controls">
            <Panel title="Inject an event" icon={<LuZap />}>
              <EventPanel graph={graph} busy={nx.busy} onRun={run} readOnly={readOnly} />
            </Panel>
            <Panel title="Layers" icon={<LuLayers />}>
              <ul className="nx-layer-list">
                {layers.map((l) => (
                  <li key={l.id}>
                    <label className={hidden.includes(l.id) ? 'is-off' : ''}>
                      <input type="checkbox" checked={!hidden.includes(l.id)} onChange={() => toggleLayer(l.id)} />
                      <i style={{ background: l.color }} />{l.name}
                      {simulation && <em>{simulation.layers[l.id].affected}/{simulation.layers[l.id].total}</em>}
                    </label>
                  </li>
                ))}
              </ul>
              <Switch checked={showDeps} onChange={setShowDeps}>Show cross-layer dependencies</Switch>
            </Panel>
          </aside>
          <aside className={`nx-dock right${railR ? '' : ' is-hidden'}${cp === 0 && !selected ? ' is-asleep' : ''}`} aria-label="Inspector" data-wait="Awaiting the cascade. Keep scrolling.">
            <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))} label="Inspector" size="fill" />
            <div className="nx-rail-scroll">
              {tab === 'overview' && (simulation
                ? <OverviewPanel graph={graph} simulation={simulation} analytics={nx.analytics} comparison={nx.comparison} />
                : <EmptyState icon={LuActivity} title="Nothing simulated yet">Run an event to see the risk score, what drives it, and plain-language findings.</EmptyState>)}
              {tab === 'actions' && <RecommendationsPanel recs={nx.recs} graph={graph} busy={nx.busy} onApply={apply} comparison={nx.comparison} onPick={pick} />}
              {tab === 'trace' && <TracePanel graph={graph} simulation={simulation} wave={wave} onPick={pick} />}
              {tab === 'node' && (selected
                ? <NodePanel nodeId={selected} onPick={pick} readOnly={readOnly} />
                : <EmptyState icon={LuMousePointerClick} title="Select a component">Click a node, or press Ctrl K and search for one. You will see what it relies on, what relies on it, and how the failure reached it.</EmptyState>)}
            </div>
          </aside>
          <ol className="nx-narr" aria-hidden="true">
            {NARR.map((n, i) => <li key={n.t} className={cp === i ? 'is-on' : ''}><b>0{i + 1}</b><span>{n.t}</span><em>{n.d}</em></li>)}
          </ol>
        </div>
      </section>

      <nav className="nx-subnav" aria-label="Analysis sections">
        <span>Analysis</span>
        {GROUPS.map((g) => (
          <a key={g.id} href={`#g-${g.id}`} className={chap === g.id ? 'is-on' : ''}
            onClick={(e) => { e.preventDefault(); document.getElementById(`g-${g.id}`).scrollIntoView({ behavior: 'smooth' }); }}><b>{g.n}</b>{g.title}</a>
        ))}
      </nav>
      <div className="nx-insights">
        <header className="nx-group-head" id="g-impact" data-id="impact"><span>A</span><h2>Impact</h2><p>How far the failure reached and where it flowed.</p></header>
        <Card fig="01" span={4} title="Layer health" sub="Average health of each layer after the event. The dashed outline is full health.">
          {simulation ? <LayerRadar key={simulation.id} layers={graph.layers} summary={simulation.layers} /> : <EmptyState icon={LuChartBar} title="No analysis yet" />}
        </Card>
        <Card fig="02" span={8} title="Where the failure flowed" sub="Health lost along dependency links, from the layer that failed to the layer that felt it.">
          {simulation ? <ImpactFlow graph={graph} sim={simulation} /> : <EmptyState icon={LuChartBar} title="No analysis yet" />}
        </Card>
        <header className="nx-group-head" id="g-timing" data-id="timing"><span>B</span><h2>Timing</h2><p>How the cascade unfolded, wave by wave and minute by minute.</p></header>
        <Card fig="03" span={4} title="Cascade waves" sub="Components first affected in each wave, coloured by final status.">
          {simulation ? <WaveBars sim={simulation} /> : <EmptyState icon={LuChartBar} title="No analysis yet" />}
        </Card>
        <Card fig="04" span={8} title="When each component is hit" sub="Arrival time in minutes. Batteries and backup stock delay the effect along each dependency. Click a row to inspect it.">
          {simulation ? <ArrivalTimeline graph={graph} sim={simulation} onSelect={pick} selectedId={selected} /> : <EmptyState icon={LuChartBar} title="No analysis yet" />}
        </Card>
        <header className="nx-group-head" id="g-structure" data-id="structure"><span>C</span><h2>Structure</h2><p>Where the network is fragile before anything fails.</p></header>
        <Card fig="05" span={5} title="Dependency matrix" sub="How many dependency links join each pair of layers. Red marks the links that carried the failure.">
          <DependencyMatrix graph={graph} sim={simulation} />
        </Card>
        <Card fig="06" span={7} title="Single points of failure" sub="Every component failed on its own, ranked by the risk it causes. Click to inspect.">
          {nx.vulnerability ? (
            <BarList max={100} selectedId={selected} onPick={pick}
              items={nx.vulnerability.worst.map((w) => ({ id: w.node, label: w.label, sub: `${layerName(graph.layers, w.layer)} · ${w.affected} affected`, value: w.risk, color: layerColor(graph.layers, w.layer) }))} />
          ) : (
            <EmptyState icon={LuShieldAlert} title="Find the weakest links"
              action={<button className="nx-btn primary" disabled={nx.busy} onClick={nx.loadVulnerability}>Screen every component</button>}>
              Fails each of the {graph.nodes.length} components alone, runs the full cascade, and ranks the results.
            </EmptyState>
          )}
        </Card>
        <Card fig="07" span={12} title="Network structure" sub="Per layer: components, independent cycles (redundancy), bridges and articulation points (single points of failure).">
          <div className="nx-table-wrap">
            <table className="nx-table">
              <thead><tr><th>Layer</th><th>Nodes</th><th>Edges</th><th>Components</th><th>Independent cycles</th><th>Bridges</th><th>Articulation points</th><th>Backbone cost</th></tr></thead>
              <tbody>
                {layers.map((l) => {
                  const s = graph.structure.layers[l.id];
                  return (
                    <tr key={l.id}><td><i className="nx-dot-sq" style={{ background: l.color }} />{l.name}</td><td>{s.nodes}</td><td>{s.edges}</td><td>{s.components}</td><td>{s.independent_cycles}</td><td>{s.bridges.length}</td><td>{s.articulation_points.join(', ') || 'none'}</td><td>{s.mst_cost}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {graph.structure.dependency_cycles.length > 0 && <p className="nx-warn-line">Circular dependencies: {graph.structure.dependency_cycles.map((c) => c.join(' to ')).join('; ')}</p>}
        </Card>
      </div>
    </div>
  );
}
