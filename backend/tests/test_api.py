"""HTTP-level tests. Skipped automatically when FastAPI is not installed."""
import unittest

try:
    from fastapi.testclient import TestClient
    from app.main import app
except ImportError:  # pragma: no cover
    TestClient = None


@unittest.skipIf(TestClient is None, "fastapi not installed")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)
        self.c.post("/api/scenarios/road-blockage/load")

    def test_health_and_scenarios(self):
        self.assertEqual(self.c.get("/api/health").json()["status"], "ok")
        ids = {s["id"] for s in self.c.get("/api/scenarios").json()}
        self.assertTrue({"road-blockage", "power-outage", "flood", "comm-failure", "blank"} <= ids)

    def test_layers_and_graph(self):
        self.assertEqual(len(self.c.get("/api/layers").json()), 5)
        g = self.c.get("/api/graph").json()
        self.assertEqual((len(g["nodes"]), len(g["edges"]), len(g["dependencies"])), (31, 38, 42))
        self.assertIn("structure", g)

    def test_full_workflow(self):
        self.assertEqual(self.c.get("/api/recommendations").status_code, 400)  # nothing simulated yet
        sim = self.c.post("/api/simulations", json={"event_id": "ev-road"})
        self.assertEqual(sim.status_code, 200)
        body = sim.json()
        self.assertEqual(body["nodes"]["H1"]["status"], "critical")
        self.assertIn("T3-T5", body["edges"])
        recs = self.c.get("/api/recommendations").json()
        self.assertTrue(recs["ranked"] and recs["plan"]["steps"])
        summary = self.c.get("/api/analytics/summary").json()
        self.assertEqual(summary["simulation"]["id"], body["id"])
        fixed = self.c.post("/api/simulations/mitigate", json={"mitigations": recs["plan"]["mitigations"]}).json()
        self.assertEqual(fixed["after_risk"], recs["plan"]["risk_after"])
        self.assertEqual(self.c.get("/api/simulations/latest").json()["id"], fixed["simulation"]["id"])

    def test_inline_event_and_event_registry(self):
        ev = self.c.post("/api/events", json={"type": "power_failure", "target_nodes": ["P4"], "severity": 0.8})
        self.assertEqual(ev.status_code, 201)
        r = self.c.post("/api/simulations", json={"event_id": ev.json()["id"]})
        self.assertEqual(r.status_code, 200)

    def test_graph_editing(self):
        self.c.post("/api/scenarios/blank/load")
        self.assertEqual(self.c.post("/api/nodes", json={"id": "A", "layer": "power", "label": "A"}).status_code, 201)
        self.assertEqual(self.c.post("/api/nodes", json={"id": "B", "layer": "power", "label": "B"}).status_code, 201)
        self.assertEqual(self.c.post("/api/edges", json={"source": "A", "target": "B", "weight": 2}).status_code, 201)
        self.assertEqual(self.c.post("/api/dependencies", json={"provider": "A", "dependent": "B"}).status_code, 201)
        self.assertEqual(self.c.post("/api/layers", json={"id": "water", "name": "Water"}).status_code, 201)
        self.assertEqual(self.c.delete("/api/nodes/A").status_code, 204)
        self.assertEqual(len(self.c.get("/api/graph").json()["edges"]), 0)

    def test_errors_map_to_http_codes(self):
        self.assertEqual(self.c.post("/api/scenarios/atlantis/load").status_code, 404)
        self.assertEqual(self.c.post("/api/nodes", json={"layer": "nope", "label": "x"}).status_code, 404)
        self.assertEqual(self.c.post("/api/nodes", json={"id": "T1", "layer": "traffic", "label": "dup"}).status_code, 400)
        self.assertEqual(self.c.post("/api/simulations", json={}).status_code, 400)
        self.assertEqual(self.c.delete("/api/edges/ghost").status_code, 404)
        self.assertEqual(self.c.post("/api/events", json={"type": "meteor", "target_nodes": ["T1"]}).status_code, 422)
        self.assertEqual(self.c.post("/api/events", json={"type": "flood", "severity": 3, "zone": "east"}).status_code, 422)

    def test_vulnerability(self):
        v = self.c.get("/api/analytics/vulnerability").json()
        self.assertEqual(v["cases_evaluated"], 31)


if __name__ == "__main__":
    unittest.main()
