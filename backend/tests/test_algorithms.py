import itertools
import random
import unittest

from app.algorithms.centrality import betweenness_centrality
from app.algorithms.coloring import is_proper, welsh_powell
from app.algorithms.connectivity import bridges_and_articulation_points, connected_components
from app.algorithms.discrete_math import (count_paths_dag, crew_for_batch, n_choose_k, pigeonhole_min_load,
                                          relation_properties, restoration_times, transitive_closure)
from app.algorithms.graph import Graph
from app.algorithms.matching import hungarian
from app.algorithms.mst import kruskal
from app.algorithms.shortest_path import dijkstra, shortest_path
from app.algorithms.traversal import bfs_levels, dfs_preorder, find_cycles, topological_sort

try:
    import networkx as nx
except ImportError:  # networkx is only used to cross-validate; tests still run without it
    nx = None


def make(edges, nodes=()):
    g = Graph(nodes)
    for i, (u, v, w) in enumerate(edges):
        g.add_edge(f"e{i}", u, v, w)
    return g


def random_graph(rng, n, p):
    edges = [(str(i), str(j), rng.randint(1, 9)) for i in range(n) for j in range(i + 1, n) if rng.random() < p]
    return make(edges, [str(i) for i in range(n)])


class TraversalTests(unittest.TestCase):
    def test_bfs_levels_and_parents(self):
        adj = {"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": []}
        level, parent = bfs_levels(adj, ["a"])
        self.assertEqual(level, {"a": 0, "b": 1, "c": 1, "d": 2})
        self.assertIn(parent["d"], ("b", "c"))

    def test_multi_source_bfs(self):
        level, _ = bfs_levels({"a": ["c"], "b": ["c"], "c": []}, ["a", "b"])
        self.assertEqual(level["c"], 1)

    def test_dfs_preorder_visits_all_reachable_once(self):
        adj = {"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": ["a"]}
        order = dfs_preorder(adj, "a")
        self.assertEqual(order[0], "a")
        self.assertEqual(sorted(order), ["a", "b", "c", "d"])

    def test_topological_sort_and_cycle_leftover(self):
        order, left = topological_sort("abcd", {"a": ["b", "c"], "b": ["d"], "c": ["d"]})
        self.assertEqual(left, [])
        pos = {n: i for i, n in enumerate(order)}
        self.assertTrue(pos["a"] < pos["b"] < pos["d"] and pos["a"] < pos["c"] < pos["d"])
        order, left = topological_sort("abc", {"a": ["b"], "b": ["c"], "c": ["b"]})
        self.assertEqual(order, ["a"])
        self.assertEqual(sorted(left), ["b", "c"])

    def test_find_cycles(self):
        self.assertEqual(find_cycles({"a": ["b"], "b": ["c"]}), [])
        cyc = find_cycles({"a": ["b"], "b": ["c"], "c": ["a"]})
        self.assertEqual(len(cyc), 1)
        self.assertEqual(cyc[0][0], cyc[0][-1])


class ShortestPathTests(unittest.TestCase):
    def setUp(self):
        self.g = make([("a", "b", 1), ("b", "c", 1), ("a", "c", 5), ("c", "d", 1)])

    def test_basic_path(self):
        cost, nodes, _ = shortest_path(self.g, "a", "d")
        self.assertEqual((cost, nodes), (3, ["a", "b", "c", "d"]))

    def test_blocked_edge_forces_detour(self):
        cost, nodes, _ = shortest_path(self.g, "a", "d", blocked_edges=["e1"])
        self.assertEqual((cost, nodes), (6, ["a", "c", "d"]))

    def test_unreachable_and_blocked_source(self):
        self.assertIsNone(shortest_path(self.g, "a", "d", blocked_nodes=["c"]))
        self.assertEqual(dijkstra(self.g, "a", blocked_nodes=["a"]), ({}, {}))

    @unittest.skipIf(nx is None, "networkx not installed")
    def test_matches_networkx(self):
        rng = random.Random(7)
        for _ in range(25):
            g = random_graph(rng, 12, 0.3)
            G = nx.Graph()
            G.add_nodes_from(g.nodes)
            for u, v, w in g.edges.values():
                if not G.has_edge(u, v) or G[u][v]["weight"] > w:
                    G.add_edge(u, v, weight=w)
            dist, _ = dijkstra(g, "0")
            self.assertEqual(dist, dict(nx.single_source_dijkstra_path_length(G, "0")))


class ConnectivityTests(unittest.TestCase):
    def test_components(self):
        g = make([("a", "b", 1), ("c", "d", 1)], ["e"])
        self.assertEqual(sorted(len(c) for c in connected_components(g)), [1, 2, 2])

    def test_path_graph_bridges_and_articulation(self):
        bridges, points = bridges_and_articulation_points(make([("a", "b", 1), ("b", "c", 1)]))
        self.assertEqual(sorted(bridges), ["e0", "e1"])
        self.assertEqual(points, ["b"])

    def test_cycle_has_neither(self):
        self.assertEqual(bridges_and_articulation_points(make([("a", "b", 1), ("b", "c", 1), ("c", "a", 1)])), ([], []))

    def test_parallel_edges_are_not_bridges(self):
        bridges, _ = bridges_and_articulation_points(make([("a", "b", 1), ("a", "b", 2)]))
        self.assertEqual(bridges, [])

    @unittest.skipIf(nx is None, "networkx not installed")
    def test_matches_networkx(self):
        rng = random.Random(11)
        for _ in range(40):
            g = random_graph(rng, 10, 0.22)
            G = nx.Graph(); G.add_nodes_from(g.nodes); G.add_edges_from((u, v) for u, v, _ in g.edges.values())
            bridges, points = bridges_and_articulation_points(g)
            self.assertEqual(sorted(points), sorted(nx.articulation_points(G)))
            self.assertEqual(len(bridges), len(list(nx.bridges(G))))
            self.assertEqual(len(connected_components(g)), nx.number_connected_components(G))


class MstColoringCentralityTests(unittest.TestCase):
    def test_kruskal_known_total(self):
        g = make([("a", "b", 1), ("b", "c", 2), ("a", "c", 3), ("c", "d", 4), ("b", "d", 5)])
        edges, total = kruskal(g)
        self.assertEqual((len(edges), total), (3, 7))

    def test_kruskal_forest(self):
        edges, total = kruskal(make([("a", "b", 2), ("c", "d", 3)]))
        self.assertEqual((len(edges), total), (2, 5))

    @unittest.skipIf(nx is None, "networkx not installed")
    def test_kruskal_matches_networkx(self):
        rng = random.Random(3)
        for _ in range(25):
            g = random_graph(rng, 12, 0.35)
            G = nx.Graph(); G.add_nodes_from(g.nodes)
            for u, v, w in g.edges.values():
                if not G.has_edge(u, v) or G[u][v]["weight"] > w:
                    G.add_edge(u, v, weight=w)
            expected = sum(d["weight"] for *_, d in nx.minimum_spanning_edges(G, data=True))
            self.assertEqual(kruskal(g)[1], expected)

    def test_coloring_is_proper_and_bounded(self):
        rng = random.Random(5)
        for _ in range(30):
            g = random_graph(rng, 14, 0.3)
            adj = g.plain_adj()
            colors = welsh_powell(adj)
            self.assertTrue(is_proper(adj, colors))
            self.assertLessEqual(max(colors.values()) + 1, max((len(v) for v in adj.values()), default=0) + 1)

    def test_odd_cycle_needs_three_colours(self):
        adj = {"a": ["b", "e"], "b": ["a", "c"], "c": ["b", "d"], "d": ["c", "e"], "e": ["d", "a"]}
        self.assertEqual(len(set(welsh_powell(adj).values())), 3)

    def test_betweenness_star(self):
        g = make([("c", "a", 1), ("c", "b", 1), ("c", "d", 1)])
        bc = betweenness_centrality(g)
        self.assertAlmostEqual(bc["c"], 1.0)
        self.assertEqual(bc["a"], 0.0)

    @unittest.skipIf(nx is None, "networkx not installed")
    def test_betweenness_matches_networkx(self):
        rng = random.Random(9)
        for _ in range(15):
            g = random_graph(rng, 11, 0.3)
            G = nx.Graph(); G.add_nodes_from(g.nodes); G.add_edges_from((u, v) for u, v, _ in g.edges.values())
            ours, ref = betweenness_centrality(g), nx.betweenness_centrality(G)
            for n in g.nodes:
                self.assertAlmostEqual(ours[n], ref[n], places=9)


class MatchingTests(unittest.TestCase):
    def test_hungarian_matches_bruteforce(self):
        rng = random.Random(1)
        for _ in range(60):
            n = rng.randint(1, 5)
            m = rng.randint(n, 6)
            cost = [[rng.randint(0, 20) for _ in range(m)] for _ in range(n)]
            _, total = hungarian(cost)
            best = min(sum(cost[i][p[i]] for i in range(n)) for p in itertools.permutations(range(m), n))
            self.assertEqual(total, best)

    def test_rejects_more_rows_than_columns(self):
        with self.assertRaises(ValueError):
            hungarian([[1], [2]])


class DiscreteMathTests(unittest.TestCase):
    def test_counting_and_pigeonhole(self):
        self.assertEqual(n_choose_k(31, 2), 465)
        self.assertEqual(n_choose_k(3, 5), 0)
        self.assertEqual(pigeonhole_min_load(10, 3), 4)
        self.assertEqual(pigeonhole_min_load(3, 3), 1)

    def test_path_counting_diamond(self):
        order = ["s", "a", "b", "t"]
        paths = count_paths_dag(order, [("s", "a"), ("s", "b"), ("a", "t"), ("b", "t")], ["s"])
        self.assertEqual(paths["t"], 2)

    def test_transitive_closure_and_relation_properties(self):
        nodes = ["a", "b", "c"]
        closure = transitive_closure(nodes, [("a", "b"), ("b", "c")])
        self.assertEqual(closure["a"], {"b", "c"})
        props = relation_properties(nodes, [("a", "b"), ("b", "c")])
        self.assertTrue(props["irreflexive"] and not props["transitive"])
        self.assertTrue(relation_properties(nodes, [("a", "b"), ("b", "c"), ("a", "c")])["transitive"])
        self.assertTrue(relation_properties(nodes, [("a", "a"), ("b", "b"), ("c", "c")])["reflexive"])

    def test_modular_crews_and_recurrence(self):
        self.assertEqual([crew_for_batch(b, 0, 3) for b in range(5)], [0, 1, 2, 0, 1])
        t = restoration_times(["p", "q", "r"], {"q": ["p"], "r": ["p", "q"]}, {"p": 10, "q": 5, "r": 1})
        self.assertEqual(t, {"p": 10, "q": 15, "r": 16})


if __name__ == "__main__":
    unittest.main()
