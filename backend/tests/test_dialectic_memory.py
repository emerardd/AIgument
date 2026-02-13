"""
Dialectic memory tests.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from memory.dialectic_memory import DialecticMemory


def test_build_tree_nodes_edges():
    memory = DialecticMemory(topic="T", total_rounds=2)
    memory.add_round(
        round_num=1,
        thesis="t1",
        antithesis="a1",
        synthesis="s1",
        fallacies=[]
    )
    memory.add_round(
        round_num=2,
        thesis="t2",
        antithesis="a2",
        synthesis="s2",
        fallacies=[]
    )

    tree = memory.build_tree()
    nodes = tree.get("nodes", [])
    edges = tree.get("edges", [])

    assert len(nodes) == 6
    assert len(edges) >= 6

    node_ids = {n["id"] for n in nodes}
    assert "t1" in node_ids
    assert "a1" in node_ids
    assert "s1" in node_ids
    assert "t2" in node_ids
    assert "a2" in node_ids
    assert "s2" in node_ids
