import { Link } from 'react-router-dom';
import { LuArrowRight, LuBoxes, LuFlaskConical, LuGitBranch, LuLayers, LuNetwork, LuRadar, LuRepeat, LuSparkles, LuTimer } from 'react-icons/lu';
import HeroCascade from '../components/HeroCascade';

const SCENARIOS = [
  ['road-blockage', 'Road blockage', 'Hospital access is cut and ambulances lose their destination.'],
  ['power-outage', 'Power outage', 'One substation takes hospitals, towers and signals with it.'],
  ['flood', 'Riverside flood', 'One flood zone ends up affecting all five layers.'],
  ['comm-failure', 'Communication failure', 'The control centre loses its link to every field unit.'],
];

const STEPS = [
  ['Model', 'Each infrastructure becomes a graph layer. Nodes are components, edges are the connections inside the layer.'],
  ['Connect', 'Dependency links join layers: a hospital relies on a substation, an ambulance relies on a road.'],
  ['Inject', 'Block a road, fail a tower, flood a zone. Choose how severe.'],
  ['Propagate', 'Health flows along the links in waves, delayed by buffers like batteries and backup stock.'],
  ['Act', 'Fixes are ranked by measured risk reduction, and repairs are ordered so providers return first.'],
];

const MATH = [
  ['Graphs and paths', 'layers, Dijkstra detours, BFS waves'],
  ['Connectivity', 'components, bridges, articulation points'],
  ['Trees', 'minimum spanning backbone, causal paths'],
  ['Relations', 'the dependency relation and its closure'],
  ['Colouring', 'conflict-free repair batches'],
  ['Counting', 'single and double failure case counts'],
  ['Recurrences', 'health fixed point, restoration time'],
  ['Modular arithmetic', 'crew rotation across batches'],
  ['Pigeonhole', 'ambulance and repair load bounds'],
  ['Matching', 'optimal ambulance to hospital assignment'],
];

export default function Landing() {
  return (
    <div className="nx-landing">
      <section className="nx-hero">
        <div className="nx-hero-copy">
          <p className="nx-eyebrow"><LuNetwork /> Multi-layer graph decision support</p>
          <h1>See what a single failure takes down with it.</h1>
          <p className="nx-lead">NexusGraph models roads, hospitals, power, networks and emergency services as connected layers, traces how a failure in one reaches the others, and ranks what to fix first.</p>
          <div className="nx-row wrap">
            <Link to="/dashboard" className="nx-btn primary large">Open the dashboard <LuArrowRight /></Link>
            <Link to="/builder" className="nx-btn large">Build a scenario</Link>
          </div>
          <div className="nx-try">
            <span>Start from a demo scenario</span>
            <div className="nx-pills">{SCENARIOS.map(([id, name]) => <Link key={id} to={`/dashboard?scenario=${id}`} className="nx-pill">{name}</Link>)}</div>
          </div>
        </div>
        <HeroCascade />
      </section>

      <section className="nx-band">
        <div className="nx-wrap two-col">
          <div>
            <h2>Infrastructure is planned one system at a time</h2>
            <p>The road department sees roads. The utility sees substations. The hospital sees beds. Each has a plan for its own failures, and none can see the links between systems, where the worst failures begin.</p>
            <p>When a substation trips, signals go dark, a tower drops to battery, a blood bank warms up and an ambulance loses its route. Nobody modelled that chain.</p>
          </div>
          <div>
            <h2>NexusGraph models the links</h2>
            <p>Every infrastructure is a graph layer. Dependencies connect the layers, each with a strength and a buffer time. An event is injected into one layer and the engine computes, wave by wave, which components degrade, when, and why.</p>
            <p>The answer is more than a picture: a risk score, a causal trace for every affected component, and a ranked list of actions that were each tested by simulating them.</p>
          </div>
        </div>
      </section>

      <section className="nx-wrap">
        <h2 className="nx-h2">From event to action in five steps</h2>
        <ol className="nx-steps-row">
          {STEPS.map(([title, text], i) => <li key={title}><span>{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}
        </ol>
      </section>

      <section className="nx-wrap">
        <h2 className="nx-h2">What is inside</h2>
        <div className="nx-bento">
          <div className="nx-card span4"><LuGitBranch className="ico violet" /><h3>Cross-layer dependency engine</h3><p>Redundant providers share a group, so losing one of two feeders hurts less than losing the only one. Circular dependencies are detected and the cascade still converges.</p></div>
          <div className="nx-card"><LuTimer className="ico amber" /><h3>Replayable timeline</h3><p>Scrub the cascade wave by wave and watch it spread through the layers.</p></div>
          <div className="nx-card"><LuBoxes className="ico cyan" /><h3>Three ways to see it</h3><p>Banded layers, an isometric 3D stack and a force-directed network, all from the same data.</p></div>
          <div className="nx-card"><LuRadar className="ico rose" /><h3>Single-failure screening</h3><p>Fail every component alone and rank the worst single points of failure.</p></div>
          <div className="nx-card"><LuSparkles className="ico mint" /><h3>Tested recommendations</h3><p>Backup power, road clearing, redirection. Each is simulated before it is ranked.</p></div>
          <div className="nx-card span3"><LuLayers className="ico violet" /><h3>Extensible layers</h3><p>Water, rail or telecom are one API call away, with no engine changes.</p></div>
          <div className="nx-card span3"><LuFlaskConical className="ico amber" /><h3>Works without a server</h3><p>If the backend is not running, the dashboard falls back to a snapshot of the four built-in scenarios, so a review never stalls.</p></div>
        </div>
      </section>

      <section className="nx-band">
        <div className="nx-wrap">
          <h2 className="nx-h2">Discrete mathematics, doing real work</h2>
          <p className="nx-sub">Every concept below is implemented and used by the engine, not only described.</p>
          <dl className="nx-math">{MATH.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <div className="nx-row wrap"><Link to="/methodology" className="nx-btn"><LuRepeat /> Read the methodology</Link><Link to="/developers" className="nx-btn">Developer notes</Link></div>
        </div>
      </section>
    </div>
  );
}
