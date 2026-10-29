import { LuCircleCheck, LuCrosshair, LuListOrdered, LuRoute, LuSparkles, LuWrench } from 'react-icons/lu';
import { EmptyState } from './Feedback';
import { RiskCurve } from '../viz/charts';
import { minutes } from '../utils/graph';

export default function RecommendationsPanel({ recs, graph, busy, onApply, comparison, onPick }) {
  if (!recs) return <EmptyState icon={LuSparkles} title="Recommendations appear after a simulation">Each action is tested by re-running the cascade with it applied.</EmptyState>;
  const { plan, ranked, repair_schedule: sched, restoration_order: order, dispatch } = recs;
  const done = !!comparison;

  return (
    <div className="nx-stack gap-lg">
      <section>
        <div className="nx-section-head">
          <div>
            <h3>Recommended plan</h3>
            <p>Each step adds the action with the largest remaining risk reduction.</p>
          </div>
          {plan.steps.length > 0 && (
            <button className="nx-btn primary small" disabled={busy || done} onClick={() => onApply(plan.mitigations)}>
              <LuCircleCheck /> {done ? 'Applied' : 'Apply plan'}
            </button>
          )}
        </div>
        {plan.steps.length === 0 ? <p className="nx-muted">No action reduces the risk meaningfully.</p> : (
          <>
            <RiskCurve plan={plan} />
            <ol className="nx-steps">
              {plan.steps.map((s) => (
                <li key={s.step}><span>{s.step}</span><p>{s.title}</p><b>risk {s.risk_after}</b></li>
              ))}
            </ol>
            <p className="nx-hint">Risk {plan.risk_before} to {plan.risk_after}. {plan.resolved_nodes.length} components return to safe.</p>
          </>
        )}
      </section>

      <section>
        <div className="nx-section-head"><div><h3>All actions</h3><p>Ranked by risk reduction per crew-hour.</p></div></div>
        {ranked.length === 0 ? <p className="nx-muted">No candidate actions found.</p> : (
          <ul className="nx-actions">
            {ranked.slice(0, 8).map((c) => (
              <li key={`${c.rank}-${c.target}`}>
                <span className="nx-rank">{c.rank}</span>
                <div>
                  <div className="nx-row wrap"><b>{c.title}</b><span className={`nx-prio ${c.priority}`}>{c.priority}</span></div>
                  <p className="nx-list-sub">{c.detail}</p>
                  <p className="nx-list-sub strong">Risk down by {c.risk_reduction}{c.risk_after === 0 ? ', to zero' : ''} · {c.cost.toFixed(1)} crew-hours · restores {c.resolved_nodes.length}</p>
                </div>
                <button className="nx-btn small" disabled={busy || done} onClick={() => onApply([c.mitigation])}>Apply</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dispatch.assignments.length > 0 && (
        <section>
          <div className="nx-section-head"><div><h3><LuRoute /> Ambulance dispatch</h3><p>Minimum-cost assignment over shortest travel times. By the pigeonhole principle at least {dispatch.min_units_per_hospital} unit(s) share a hospital.</p></div></div>
          <ul className="nx-list">
            {dispatch.assignments.map((a) => (
              <li key={a.unit}><button onClick={() => onPick(a.unit)}>
                <span className="nx-list-main"><span>{a.unit_label}</span><span className={a.changed ? 'nx-warn' : ''}>{a.hospital_label}</span></span>
                <span className="nx-list-sub">{a.travel_min != null ? `${a.travel_min} min` : 'no route'}{a.changed ? ', redirected from the usual hospital' : ''}</span>
              </button></li>
            ))}
          </ul>
        </section>
      )}

      {order.length > 0 && (
        <section>
          <div className="nx-section-head"><div><h3><LuListOrdered /> Restoration order</h3><p>Providers return before what depends on them. ETA follows T(v) = repair(v) + max T(provider).</p></div></div>
          <ol className="nx-list numbered">
            {order.map((o) => (
              <li key={o.node}><button onClick={() => onPick(o.node)}><span className="nx-list-main"><span><i>{o.order}</i>{o.label}</span><span>{o.circular ? 'circular' : minutes(o.eta_min)}</span></span></button></li>
            ))}
          </ol>
        </section>
      )}

      {sched.batches.length > 0 && (
        <section>
          <div className="nx-section-head"><div><h3><LuWrench /> Repair schedule</h3><p>{sched.actions} actions in {sched.colors_used} conflict-free batches (graph colouring). With {sched.crews} crews, some crew gets at least {sched.min_actions_per_crew}.</p></div></div>
          {sched.batches.map((b) => (
            <div key={b.batch} className="nx-batch">
              <h5><LuCrosshair /> Batch {b.batch}</h5>
              <ul>{b.actions.map((a) => <li key={a.title}><span>{a.title}</span><em>crew {a.crew}</em></li>)}</ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
