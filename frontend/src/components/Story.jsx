import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import HeroCascade from './HeroCascade';
import { loadDemo, demoGraph } from '../demo';
import { prefersReducedMotion } from '../hooks/useTween';

const SCENARIOS = [
  ['road-blockage', 'Road blockage'],
  ['power-outage', 'Power outage'],
  ['flood', 'Riverside flood'],
  ['comm-failure', 'Communication failure'],
];

// start/end are scroll progress through the pinned section; every number comes from the demo snapshot.
function chapters(graph, sim) {
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const first = sim.history.filter((h) => h.wave === 0).map((h) => label(h.target));
  const waves = sim.waves.filter((w) => w.wave > 0).map((w) => `Wave ${w.wave}: ${w.nodes} components`).join(' · ');
  return [
    { id: 'hero', start: 0, end: 0.14 },
    { id: 'layers', start: 0.14, end: 0.31, side: 'right', kicker: '01 · Model', title: 'Five systems. One city.',
      text: `Roads, hospitals, power, communication and emergency response, ${graph.nodes.length} components in all. Each is a graph layer, planned and monitored on its own.` },
    { id: 'links', start: 0.31, end: 0.47, side: 'left', kicker: '02 · Connect', title: 'The links nobody modelled.',
      text: `${graph.dependencies.length} cross-layer dependencies, each with a strength and a buffer time. This is where the worst failures travel.` },
    { id: 'event', start: 0.47, end: 0.6, side: 'right', kicker: '03 · Inject', title: 'One component trips.',
      text: `${first.slice(0, 2).join(' and ')} fail${first.length === 1 ? 's' : ''} first. Nothing else has noticed yet.` },
    { id: 'waves', start: 0.6, end: 0.8, side: 'left', kicker: '04 · Propagate', title: 'Failure travels in waves.',
      text: `${waves}. Health flows along the links, delayed by batteries and backup stock.` },
    { id: 'act', start: 0.8, end: 0.94, side: 'right', kicker: '05 · Act', title: 'Then it tells you what to fix.',
      text: 'Every recommendation is verified by re-running the simulation with the fix applied, and repairs are ordered so providers come back first.' },
    { id: 'cta', start: 0.94, end: 1.01 },
  ];
}

function Hero() {
  return (
    <>
      <p className="nx-eyebrow">Multi-layer graph decision support</p>
      <h1>See what a single failure takes down with it.</h1>
      <p className="nx-lead">NexusGraph traces how a failure in one infrastructure reaches the others, and ranks what to fix first.</p>
      <div className="nx-row wrap">
        <Link to="/dashboard" className="nx-btn primary large">Open the dashboard <LuArrowRight /></Link>
        <Link to="/builder" className="nx-btn large">Build a scenario</Link>
      </div>
      <p className="nx-scrollhint" aria-hidden="true">Scroll to follow a failure <span /></p>
    </>
  );
}

function Cta() {
  return (
    <>
      <h2>Try it on a scenario.</h2>
      <div className="nx-pills">{SCENARIOS.map(([id, name]) => <Link key={id} to={`/dashboard?scenario=${id}`} className="nx-pill">{name}</Link>)}</div>
    </>
  );
}

const webglOk = () => {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
};

export default function Story() {
  const [demo, setDemo] = useState(null);
  const [active, setActive] = useState(0);
  const [mode] = useState(() => (webglOk() && !prefersReducedMotion() ? 'gl' : 'static'));
  const root = useRef(null), canvas = useRef(null), labelRefs = useRef({});
  useEffect(() => { loadDemo().then(setDemo); }, []);

  const data = useMemo(() => {
    if (!demo) return null;
    const graph = demoGraph(demo, 'power-outage');
    const sim = demo.byScenario['power-outage'].simulation;
    return { graph, sim, chapters: chapters(graph, sim) };
  }, [demo]);

  useEffect(() => {
    if (mode !== 'gl' || !data) return undefined;
    let scene, stopped = false, onScroll, io;
    import('../viz/CityScene').then(({ createCityScene }) => {
      if (stopped) return;
      scene = createCityScene(canvas.current, { graph: data.graph, sim: data.sim, labels: labelRefs.current });
      let ticking = false, cur = 0;
      const update = () => {
        ticking = false;
        const r = root.current.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
        scene.setProgress(p);
        const i = data.chapters.findIndex((c) => p >= c.start && p < c.end);
        if (i >= 0 && i !== cur) { cur = i; setActive(i); }
      };
      onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      io = new IntersectionObserver(([e]) => scene.setRunning(e.isIntersecting && !document.hidden));
      io.observe(root.current);
      update();
      scene.setProgress(0);
    });
    return () => { stopped = true; window.removeEventListener('scroll', onScroll); io?.disconnect(); scene?.dispose(); };
  }, [mode, data]);

  if (mode === 'static' || !data) {
    return (
      <section className="nx-hero">
        <div className="nx-hero-copy"><Hero /></div>
        <HeroCascade />
      </section>
    );
  }

  return (
    <section className="nx-story" ref={root} aria-label="How a failure spreads, told in scroll">
      <div className="nx-story-pin">
        <canvas ref={canvas} className="nx-story-canvas" aria-hidden="true" />
        <div className="nx-story-scrim" />
        {data.graph.layers.map((l) => (
          <span key={l.id} className="nx-layer-tag" style={{ '--c': l.color }} ref={(el) => { labelRefs.current[l.id] = el; }}><i />{l.name}</span>
        ))}
        {data.chapters.map((c, i) => (
          <div key={c.id} className={`nx-chapter ${c.side || 'left'} ${c.id} ${i === active ? 'is-on' : ''}`} aria-hidden={i !== active}>
            {c.id === 'hero' ? <Hero /> : c.id === 'cta' ? <Cta /> : (
              <>
                <p className="nx-kicker">{c.kicker}</p>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
              </>
            )}
          </div>
        ))}
        <ol className="nx-rail-dots" aria-hidden="true">{data.chapters.map((c, i) => <li key={c.id} className={i === active ? 'is-on' : ''} />)}</ol>
      </div>
    </section>
  );
}
