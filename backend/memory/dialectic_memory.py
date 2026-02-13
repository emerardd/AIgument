"""
辩证法引擎的记忆与观点进化树构建
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, List


@dataclass
class DialecticRoundRecord:
    round: int
    thesis: str
    antithesis: str
    synthesis: str
    fallacies: List[Dict[str, Any]] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)


class DialecticMemory:
    def __init__(self, topic: str, total_rounds: int):
        self.topic = topic
        self.total_rounds = total_rounds
        self.rounds: List[DialecticRoundRecord] = []

    def add_round(
        self,
        round_num: int,
        thesis: str,
        antithesis: str,
        synthesis: str,
        fallacies: List[Dict[str, Any]]
    ) -> DialecticRoundRecord:
        record = DialecticRoundRecord(
            round=round_num,
            thesis=thesis,
            antithesis=antithesis,
            synthesis=synthesis,
            fallacies=fallacies or []
        )
        self.rounds.append(record)
        return record

    def build_tree(self) -> Dict[str, Any]:
        """输出 React Flow 兼容的节点与边"""
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        x_gap = 260
        y_map = {"thesis": 0, "antithesis": 140, "synthesis": 280}

        for record in self.rounds:
            x = (record.round - 1) * x_gap
            t_id = f"t{record.round}"
            a_id = f"a{record.round}"
            s_id = f"s{record.round}"

            nodes.extend([
                {
                    "id": t_id,
                    "type": "dialectic",
                    "position": {"x": x, "y": y_map["thesis"]},
                    "data": {
                        "label": record.thesis,
                        "kind": "thesis",
                        "round": record.round,
                    }
                },
                {
                    "id": a_id,
                    "type": "dialectic",
                    "position": {"x": x, "y": y_map["antithesis"]},
                    "data": {
                        "label": record.antithesis,
                        "kind": "antithesis",
                        "round": record.round,
                    }
                },
                {
                    "id": s_id,
                    "type": "dialectic",
                    "position": {"x": x, "y": y_map["synthesis"]},
                    "data": {
                        "label": record.synthesis,
                        "kind": "synthesis",
                        "round": record.round,
                    }
                },
            ])

            edges.extend([
                {
                    "id": f"e_{t_id}_{a_id}",
                    "source": t_id,
                    "target": a_id,
                    "label": "反题",
                    "type": "smoothstep",
                    "animated": True
                },
                {
                    "id": f"e_{t_id}_{s_id}",
                    "source": t_id,
                    "target": s_id,
                    "label": "合题",
                    "type": "smoothstep"
                },
                {
                    "id": f"e_{a_id}_{s_id}",
                    "source": a_id,
                    "target": s_id,
                    "label": "合题",
                    "type": "smoothstep"
                },
            ])

            next_thesis_id = f"t{record.round + 1}"
            if record.round < self.total_rounds:
                edges.append({
                    "id": f"e_{s_id}_{next_thesis_id}",
                    "source": s_id,
                    "target": next_thesis_id,
                    "label": "上升",
                    "type": "smoothstep"
                })

        return {"nodes": nodes, "edges": edges}

    def build_trace(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "total_rounds": self.total_rounds,
            "rounds": [
                {
                    "round": r.round,
                    "thesis": r.thesis,
                    "antithesis": r.antithesis,
                    "synthesis": r.synthesis,
                    "fallacies": r.fallacies,
                    "timestamp": r.timestamp.isoformat(),
                }
                for r in self.rounds
            ],
            "created_at": self.rounds[0].timestamp.isoformat() if self.rounds else None
        }
