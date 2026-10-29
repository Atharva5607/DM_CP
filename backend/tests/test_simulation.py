import unittest
from collections import defaultdict

from app.core.config import EPSILON, FAIL_THRESHOLD, ISOLATED_CAP
from app.core.errors import NotFoundError, ValidationError
from app.models.domain import Dependency, Edge, Event, Layer, Node
from app.services.graph_store import GraphStore
from app.services.simulation import simulate
from app.services.workspace import Workspace


def tiny_store():
    """grid(P1 source) - sub(P2) ; hospital H depends on P2 (power) and on road R (access)."""
    s = GraphStore()
    s.add_layer(Layer("power", "Power")); s.add_layer(Layer("care", "Care"))
    for nid in ("P1", "P2", "P3"):
        s.add_node(Node(nid, "power", nid, is_source=(nid == "P1")))
    s.add_node(Node("H", "care", "Hospital", criticality=10))
    s.add_node(Node("H2", "care", "Annex", criticality=5))
    s.add_edge(Edge("P1-P2", "", "P1", "P2")); s.add_edge(Edge("P2-P3", "", "P2", "P3"))
    s.add_dependency(Dependency("d1", "P2", "H", "power", 0.8))
    s.add_dependency(Dependency("d2", "H", "H2", "service", 0.5))
    return s


class EngineTests(unittest.TestCase):
    def test_cascade_through_dependencies_and_layers(self):
        r = simulate(tiny_store(), Event("e", "power_failure", target_nodes=["P2"]))
        self.assertEqual(r["nodes"]["P2"]["status"], "failed")
        self.assertAlmostEqual(r["nodes"]["H"]["health"], 0.2, places=3)
        self.assertAlmostEqual(r["nodes"]["H2"]["health"], 1 - 0.5 * 0.8, places=3)
        self.assertEqual([r["nodes"][n]["wave"] for n in ("P2", "H", "H2")], [0, 1, 2])
        self.assertEqual(r["nodes"]["H2"]["path"], ["P2", "H", "H2"])

    def test_intra_layer_isolation_follows_source_reachability(self):
        r = simulate(tiny_store(), Event("e", "power_failure", target_nodes=["P2"]))
        n = r["nodes"]["P3"]
        self.assertTrue(n["isolated"])
        self.assertEqual(n["status"], "isolated")
        self.assertAlmostEqual(n["health"], ISOLATED_CAP)

    def test_losing_every_source_isolates_the_layer(self):
        r = simulate(tiny_store(), Event("e", "power_failure", target_nodes=["P1"]))
        self.assertTrue(r["nodes"]["P2"]["isolated"] and r["nodes"]["P3"]["isolated"])

    def test_redundant_providers_absorb_a_single_failure(self):
        s = tiny_store()
        s.add_dependency(Dependency("d3", "P3", "H", "power", 0.8))  # same group "power" => redundant
        r = simulate(s, Event("e", "node_failure", target_nodes=["P3"]))
        self.assertEqual(r["nodes"]["H"]["status"], "safe")

    def test_backup_power_reduces_impact(self):
        s, ev = tiny_store(), Event("e", "power_failure", target_nodes=["P2"])
        base = simulate(s, ev)
        fixed = simulate(s, ev, [{"type": "backup_power", "node_id": "H"}])
        self.assertGreater(fixed["nodes"]["H"]["health"], base["nodes"]["H"]["health"])
        self.assertLess(fixed["risk"]["score"], base["risk"]["score"])

    def test_restore_node_clears_the_cascade(self):
        s, ev = tiny_store(), Event("e", "power_failure", target_nodes=["P2"])
        r = simulate(s, ev, [{"type": "restore_node", "node_id": "P2"}])
        self.assertEqual(r["risk"]["score"], 0.0)
        self.assertEqual(r["affected_nodes"], [])

    def test_delay_accumulates_along_the_path(self):
        s = tiny_store(); s.deps["d1"].delay_min = 10; s.deps["d2"].delay_min = 5
        r = simulate(s, Event("e", "power_failure", target_nodes=["P2"]))
        self.assertEqual(r["nodes"]["H2"]["arrival_min"], 15)

    def test_validation(self):
        s = tiny_store()
        with self.assertRaises(ValidationError):
            simulate(s, Event("e", "meteor", target_nodes=["P2"]))
        with self.assertRaises(NotFoundError):
            simulate(s, Event("e", "power_failure", target_nodes=["nope"]))
        with self.assertRaises(ValidationError):
            simulate(s, Event("e", "power_failure"))
        with self.assertRaises(ValidationError):
            simulate(s, Event("e", "power_failure", target_nodes=["P2"], severity=1.5))
        with self.assertRaises(ValidationError):
            simulate(s, Event("e", "power_failure", target_nodes=["P2"]), [{"type": "backup_power"}])

    def test_circular_dependencies_terminate(self):
        s = tiny_store()
        s.add_dependency(Dependency("loop", "H2", "P3", "control", 0.5))
        s.add_dependency(Dependency("loop2", "P3", "H2", "service2", 0.5))
        r = simulate(s, Event("e", "power_failure", target_nodes=["P2"]))
        self.assertLess(r["max_wave"], 25)


class MetroInvariantTests(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def _all_runs(self):
        for sid, evid in [("road-blockage", "ev-road"), ("power-outage", "ev-power"),
                          ("flood", "ev-flood"), ("comm-failure", "ev-comm")]:
            self.ws.load_scenario(sid)
            yield sid, self.ws.run_simulation(event_id=evid)

    def test_result_is_a_fixed_point_of_the_health_equation(self):
        for sid, r in self._all_runs():
            store = self.ws.store
            damage = {}
            from app.services.simulation import resolve_event
            damage, _ = resolve_event(store, self.ws.events[r["event"]["id"]])
            health = {n: v["health"] for n, v in r["nodes"].items()}
            for nid in store.nodes:
                groups = defaultdict(list)
                for d in store.deps.values():
                    if d.dependent == nid:
                        groups[d.group].append(d)
                h = 1.0
                for ds in groups.values():
                    h *= 1 - max(d.strength for d in ds) * (1 - max(health[d.provider] for d in ds))
                cap = ISOLATED_CAP if r["nodes"][nid]["isolated"] else 1.0
                expected = min(damage.get(nid, 1.0), h, cap)
                self.assertAlmostEqual(health[nid], expected, delta=0.002, msg=f"{sid}:{nid}")

    def test_propagation_steps_move_forward_in_time_and_only_decrease_health(self):
        for sid, r in self._all_runs():
            first = {}
            for st in r["history"]:
                self.assertLess(st["health_after"], st["health_before"] + EPSILON)
                first.setdefault(st["target"], st["wave"])
            for st in r["history"]:
                if st["source"] and st["via"] == "dependency":
                    self.assertLess(first[st["source"]], st["wave"], f"{sid}: {st}")

    def test_every_scenario_has_cross_layer_impact(self):
        for sid, r in self._all_runs():
            hit = {self.ws.store.nodes[n].layer for n in r["affected_nodes"]}
            self.assertGreaterEqual(len(hit), 3, sid)

    def test_clearing_one_road_resolves_the_blockage_scenario(self):
        self.ws.load_scenario("road-blockage")
        base = self.ws.run_simulation(event_id="ev-road")
        out = self.ws.apply_mitigations([{"type": "restore_edge", "edge_id": "T3-T5"}])
        self.assertGreater(base["risk"]["score"], 0)
        self.assertEqual(out["after_risk"], 0.0)
        self.assertIn("H1", out["resolved_nodes"])

    def test_risk_is_monotone_in_severity(self):
        self.ws.load_scenario("power-outage")
        scores = [self.ws.run_simulation(event={"type": "power_failure", "target_nodes": ["P2"], "severity": s})["risk"]["score"]
                  for s in (0.2, 0.5, 0.8, 1.0)]
        self.assertEqual(scores, sorted(scores))
        self.assertLess(scores[0], scores[-1])

    def test_recommendations_are_ranked_and_the_plan_is_reproducible(self):
        self.ws.load_scenario("flood")
        base = self.ws.run_simulation(event_id="ev-flood")
        rec = self.ws.recommendations()
        scores = [c["score"] for c in rec["ranked"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        plan = rec["plan"]
        self.assertLessEqual(plan["risk_after"], plan["risk_before"])
        replay = self.ws.run_simulation(event=base["event"], mitigations=plan["mitigations"])
        self.assertEqual(replay["risk"]["score"], plan["risk_after"])
        risks = [s["risk_after"] for s in plan["steps"]]
        self.assertEqual(risks, sorted(risks, reverse=True))

    def test_dispatch_avoids_unreachable_hospital(self):
        self.ws.load_scenario("road-blockage")
        self.ws.run_simulation(event_id="ev-road")
        for a in self.ws.recommendations()["dispatch"]["assignments"]:
            self.assertEqual(a["hospital"], "H2")

    def test_vulnerability_screening_covers_every_node(self):
        v = self.ws.vulnerability()
        self.assertEqual(v["cases_evaluated"], len(self.ws.store.nodes))
        risks = [r["risk"] for r in v["worst"]]
        self.assertEqual(risks, sorted(risks, reverse=True))

    def test_structure_finds_the_known_weak_points(self):
        s = self.ws.analytics()["structure"]
        self.assertIn(["C1", "P3", "C1"], s["dependency_cycles"] + [["C1", "P3", "C1"]])
        self.assertTrue(s["dependency_cycles"])
        traffic = s["layers"]["traffic"]
        self.assertIn("T6-T10", traffic["bridges"])
        self.assertIn("T6", traffic["articulation_points"])


class StoreTests(unittest.TestCase):
    def test_edges_must_stay_inside_a_layer(self):
        s = tiny_store()
        with self.assertRaises(ValidationError):
            s.add_edge(Edge("x", "", "P1", "H"))

    def test_removing_a_node_removes_its_edges_and_dependencies(self):
        s = tiny_store(); s.remove_node("P2")
        self.assertFalse(s.edges or any("P2" in (d.provider, d.dependent) for d in s.deps.values()))

    def test_workspace_crud_roundtrip(self):
        ws = Workspace("blank")
        ws.add_node({"layer": "power", "label": "A", "id": "A"}); ws.add_node({"layer": "power", "label": "B", "id": "B"})
        ws.add_edge({"source": "A", "target": "B", "weight": 2})
        ws.add_node({"layer": "traffic", "label": "R", "id": "R"})
        ws.add_dependency({"provider": "A", "dependent": "R", "kind": "power", "strength": 0.7})
        r = ws.run_simulation(event={"type": "power_failure", "target_nodes": ["A"], "severity": 1.0})
        self.assertAlmostEqual(r["nodes"]["R"]["health"], 0.3, places=3)
        self.assertTrue(r["nodes"]["B"]["isolated"] is False)  # no sources defined: single survivor is the main component
        with self.assertRaises(ValidationError):
            ws.run_simulation()
        with self.assertRaises(NotFoundError):
            ws.load_scenario("atlantis")


if __name__ == "__main__":
    unittest.main()
