"""
ArgumentGraph 测试

覆盖图分析算法：add_argument, add_relation, get_unaddressed, strongest, attack_chains, mermaid
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from memory.argument_graph import ArgumentGraph, RelationType


class TestArgumentGraph:
    """论点图谱核心功能"""

    @pytest.fixture
    def graph(self):
        g = ArgumentGraph()
        n1 = g.add_argument("AI提高生产力", "pro", round_num=1)
        n2 = g.add_argument("AI导致失业", "con", round_num=1)
        n3 = g.add_argument("新岗位会出现", "pro", round_num=2)
        n4 = g.add_argument("转型成本巨大", "con", round_num=2)
        return g, [n1, n2, n3, n4]

    def test_add_argument(self):
        g = ArgumentGraph()
        node = g.add_argument("测试论点", "pro", round_num=1)
        assert len(g.nodes) == 1
        assert node.content == "测试论点"
        assert node.author == "pro"

    def test_add_multiple_arguments(self):
        g = ArgumentGraph()
        g.add_argument("论点一", "pro", round_num=1)
        g.add_argument("论点二", "con", round_num=1)
        assert len(g.nodes) == 2

    def test_add_relation(self, graph):
        g, nodes = graph
        edge = g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        assert edge is not None
        assert len(g.edges) == 1

    def test_add_relation_invalid_id(self, graph):
        g, nodes = graph
        result = g.add_relation("nonexistent", nodes[0].id, RelationType.ATTACKS)
        assert result is None

    def test_get_unaddressed_arguments(self, graph):
        g, nodes = graph
        # con attacks pro's first argument
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        # Get pro's unrebutted arguments from con's perspective
        unaddressed = g.get_unaddressed_arguments("con")
        # Should return pro's unaddressed args (node 0 is rebutted, node 2 is not)
        assert any(n.id == nodes[2].id for n in unaddressed)

    def test_get_strongest_arguments(self, graph):
        g, nodes = graph
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        strongest_pro = g.get_strongest_arguments("pro", limit=2)
        assert len(strongest_pro) <= 2
        assert all(n.author == "pro" for n in strongest_pro)

    def test_get_attack_chains(self, graph):
        g, nodes = graph
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        g.add_relation(nodes[2].id, nodes[1].id, RelationType.REBUTS)
        chains = g.get_attack_chains(nodes[0].id)
        assert isinstance(chains, list)

    def test_calculate_debate_score(self, graph):
        g, nodes = graph
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        score = g.calculate_debate_score()
        assert "pro_score" in score
        assert "con_score" in score
        assert "leader" in score

    def test_to_mermaid(self, graph):
        g, nodes = graph
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        mermaid = g.to_mermaid()
        assert "graph" in mermaid.lower()
        assert "pro" in mermaid.lower()

    def test_empty_graph(self):
        g = ArgumentGraph()
        score = g.calculate_debate_score()
        assert isinstance(score, dict)
        assert score["total_arguments"] == 0

    def test_to_dict(self, graph):
        g, nodes = graph
        g.add_relation(nodes[1].id, nodes[0].id, RelationType.ATTACKS)
        d = g.to_dict()
        assert "nodes" in d or "arguments" in d
        assert "edges" in d or "relations" in d
