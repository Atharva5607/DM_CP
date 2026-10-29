"""Export a read-only snapshot of the four demo scenarios for the frontend.

The dashboard falls back to this snapshot when the API is not running, and the landing page
uses it for the live preview. Regenerate after changing the seed data or the engine:

    cd backend && python scripts/export_demo.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.workspace import Workspace  # noqa: E402

OUT = ROOT.parent / "frontend" / "src" / "demo" / "demo.json"


def main() -> None:
    ws = Workspace()
    scenarios = [s for s in ws.list_scenarios() if s["id"] != "blank"]
    ws.load_scenario(scenarios[0]["id"])
    graph = ws.graph_state()
    graph.pop("events")
    graph.pop("scenario")

    by_scenario = {}
    for s in scenarios:
        ws.load_scenario(s["id"])
        events = ws.graph_state()["events"]
        sim = ws.run_simulation(event_id=events[0]["id"])
        recs = ws.recommendations()
        analytics = ws.analytics()
        applied = ws.apply_mitigations(recs["plan"]["mitigations"])
        by_scenario[s["id"]] = {
            "events": events, "simulation": sim, "recs": recs, "analytics": analytics,
            "plan_result": {k: applied[k] for k in ("before_risk", "after_risk", "resolved_nodes", "simulation")},
        }
    ws.load_scenario(scenarios[0]["id"])
    payload = {"scenarios": scenarios, "graph": graph, "byScenario": by_scenario, "vulnerability": ws.vulnerability()}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
