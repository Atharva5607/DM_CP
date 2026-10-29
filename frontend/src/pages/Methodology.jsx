import { Link } from 'react-router-dom';

const Eq = ({ children }) => <pre className="nx-code">{children}</pre>;
const TOC = [['what', 'What the system does'], ['why', 'Why it matters'], ['layers', 'How layers work'], ['deps', 'How dependencies work'], ['cascade', 'How the cascade is computed'], ['risk', 'How risk is scored'], ['actions', 'How recommendations are made'], ['views', 'Reading the visualisations'], ['limits', 'Assumptions and limits']];

export default function Methodology() {
  return (
    <div className="nx-doc">
      <nav aria-label="On this page" className="nx-toc"><ul>{TOC.map(([id, t]) => <li key={id}><a href={`#${id}`}>{t}</a></li>)}</ul></nav>
      <article className="nx-prose">
        <h1>Methodology</h1>
        <p className="lead">NexusGraph answers one question: if this component fails, what else stops working, how soon, and what should we do first?</p>

        <h2 id="what">What the system does</h2>
        <p>It stores several infrastructures as graph layers, links them with dependencies, applies an event to one or more components, computes how the damage spreads, scores the outcome and proposes corrective actions. Every proposed action is checked by running the simulation again with that action applied.</p>

        <h2 id="why">Why it matters</h2>
        <p>Large failures are rarely single-system failures. They grow along dependencies that no single operator owns. A model that stops at the boundary of one layer will underestimate risk exactly where it is highest. Treating the whole as a graph makes those links explicit and measurable.</p>

        <h2 id="layers">How layers work</h2>
        <p>A layer is an undirected weighted graph G = (V, E). Nodes carry a criticality from 1 to 10, an optional zone and a repair time. Edge weights are travel minutes or cost. In the layered view each layer is a band, with foundations such as power at the bottom and the services that rely on them above.</p>
        <p>Some nodes are marked as feeds (grid intake, core network hub, control centre). If every path from a node to a living feed is cut, the node is isolated even if it is undamaged. Layers without feeds use the largest surviving connected component instead. Isolation is judged against the intact graph, so components nobody wired up are not reported as isolated.</p>

        <h2 id="deps">How dependencies work</h2>
        <p>A dependency is an ordered pair (provider, dependent) with a kind, a strength s in (0, 1] and a buffer in minutes. Providers of the same kind for one dependent form a redundancy group. The dependency relation is irreflexive and in general neither symmetric nor transitive. Its transitive closure gives every component a provider could ever reach, called the blast radius.</p>
        <Eq>{`supply(g)  = max over providers p in group g of  health(p)
loss(g)    = strength(g) * (1 - supply(g))
dep_health = product over groups g of (1 - loss(g))`}</Eq>

        <h2 id="cascade">How the cascade is computed</h2>
        <p>Each component has a health h in [0, 1]. The event sets the initial damage, and then the health of every component must satisfy:</p>
        <Eq>{`h(v) = min( event_damage(v), dep_health(v), isolation_cap(v) )`}</Eq>
        <p>Health only ever decreases, so the equation has a fixed point that a breadth-first worklist reaches in a few waves. Wave 0 is the direct impact. Wave k holds components whose health dropped because a wave k-1 component dropped. Each step records its cause, so the path from the event to any component can be traced, and its arrival time is the sum of the buffers along that path. Circular dependencies cannot loop forever, because every step must lower a health value by a measurable amount.</p>

        <h2 id="risk">How risk is scored</h2>
        <Eq>{`risk = 100 * ( 0.55 * loss + 0.20 * spread + 0.15 * depth + 0.10 * structural )

loss        weighted mean of (1 - health), weight = criticality * (1 + bottleneck score)
spread      layers with a degraded component / all layers
depth       cascade waves / 5, capped at 1
structural  failed articulation points / all articulation points`}</Eq>
        <p>The bottleneck score is betweenness centrality on all layers joined by dependency links, so components that bridge layers weigh more. Below 20 is low, below 45 moderate, below 70 high, above that critical. The weights are explicit constants so they can be questioned and tuned.</p>

        <h2 id="actions">How recommendations are made</h2>
        <p>Candidates are generated from the situation: clear a blocked road, repair a damaged component, switch a dependent to backup power, redirect a service. Each is simulated and ranked by risk reduction per crew-hour. A greedy plan then adds actions one at a time by largest marginal gain. Repairs are ordered by a topological sort of the dependency graph so providers return first, and batched with a graph colouring so adjacent repairs do not collide. Ambulances are assigned to hospitals by minimum-cost matching over shortest travel times, with detours computed by Dijkstra around blocked roads.</p>

        <h2 id="views">Reading the visualisations</h2>
        <ul>
          <li><b>Health ring.</b> The arc around each node is its health. A full ring is a healthy component, a short arc is a degraded one. Dashed grey means isolated, a pulsing red ring means failed, mint means restored by a mitigation.</li>
          <li><b>Layers, 3D stack, Network.</b> Three layouts of the same data. Layers shows bands. The stack shows each layer as a plane, which makes the vertical dependency links obvious. Network groups components by layer with a force layout.</li>
          <li><b>Moving particles.</b> A dependency that has carried failure by the current wave turns red and shows particles flowing from provider to dependent.</li>
          <li><b>Replay.</b> Scrub or play the waves. Each tick shows how many components that wave hit.</li>
          <li><b>Failure flow.</b> A Sankey-style diagram: health lost along dependency links, from the layer that failed to the layer that felt it.</li>
          <li><b>Dependency matrix.</b> Link counts between layer pairs, with the failure carried shown in red.</li>
          <li><b>Layer health radar and wave bars.</b> Where the damage lies and how it builds up over the waves.</li>
        </ul>

        <h2 id="limits">Assumptions and limits</h2>
        <p>Strengths, buffers and criticalities are inputs, not measurements. The model is deterministic and does not forecast probabilities. Health is a dimensionless service level, not a physical quantity. These choices keep every result explainable. Algorithms and their complexity are listed in <Link to="/developers">the developer notes</Link>.</p>
      </article>
    </div>
  );
}
