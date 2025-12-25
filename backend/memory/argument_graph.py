"""
论点图谱 (Argument Graph)

使用图结构表示辩论中的论点关系：
- 论点节点（ArgumentNode）
- 关系边（支持、反驳、削弱等）
- 图谱分析（未被反驳的论点、有效攻击等）
"""

from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json


class RelationType(Enum):
    """论点关系类型"""
    SUPPORTS = "supports"        # 支持（己方论点强化）
    ATTACKS = "attacks"          # 攻击（直接反驳对方论点）
    REBUTS = "rebuts"            # 反驳（针对对方论据）
    UNDERMINES = "undermines"    # 削弱（质疑对方证据基础）
    BUILDS_ON = "builds_on"      # 基于（在己方论点基础上发展）


class ArgumentStrength(Enum):
    """论点强度"""
    WEAK = 1
    MODERATE = 2
    STRONG = 3
    DECISIVE = 4


@dataclass
class ArgumentNode:
    """论点节点
    
    表示辩论中的一个论点/论据。
    """
    id: str
    content: str
    author: str  # "pro" 或 "con"
    round: int
    timestamp: datetime = field(default_factory=datetime.now)
    
    # 论点属性
    argument_type: str = "claim"  # claim, evidence, rebuttal, example
    strength: ArgumentStrength = ArgumentStrength.MODERATE
    
    # 状态追踪
    is_rebutted: bool = False
    rebuttal_count: int = 0
    support_count: int = 0
    
    # 提取的关键点
    key_points: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)  # 引用的证据
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content[:200] + "..." if len(self.content) > 200 else self.content,
            "author": self.author,
            "round": self.round,
            "type": self.argument_type,
            "strength": self.strength.name,
            "is_rebutted": self.is_rebutted,
            "rebuttal_count": self.rebuttal_count,
            "support_count": self.support_count,
            "key_points": self.key_points,
        }


@dataclass
class ArgumentEdge:
    """论点关系边"""
    id: str
    source_id: str
    target_id: str
    relation: RelationType
    strength: float = 0.5  # 0-1，关系强度
    description: str = ""  # 关系描述
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source_id,
            "target": self.target_id,
            "relation": self.relation.value,
            "strength": self.strength,
            "description": self.description,
        }


class ArgumentGraph:
    """论点图谱
    
    管理辩论中所有论点及其关系，提供：
    - 论点添加和关系建立
    - 未被反驳论点查询
    - 论点有效性分析
    - 辩论态势评估
    """
    
    def __init__(self, topic: str = ""):
        self.topic = topic
        self.nodes: Dict[str, ArgumentNode] = {}
        self.edges: List[ArgumentEdge] = []
        self._edge_counter = 0
        self._node_counter = 0
        
        # 索引
        self._outgoing_edges: Dict[str, List[ArgumentEdge]] = {}  # source_id -> edges
        self._incoming_edges: Dict[str, List[ArgumentEdge]] = {}  # target_id -> edges
        self._nodes_by_author: Dict[str, List[str]] = {"pro": [], "con": []}
        self._nodes_by_round: Dict[int, List[str]] = {}
    
    def add_argument(
        self,
        content: str,
        author: str,
        round_num: int,
        argument_type: str = "claim",
        key_points: List[str] = None,
        evidence_refs: List[str] = None,
        strength: ArgumentStrength = ArgumentStrength.MODERATE
    ) -> ArgumentNode:
        """添加论点节点
        
        Args:
            content: 论点内容
            author: 作者（pro/con）
            round_num: 轮次
            argument_type: 类型（claim/evidence/rebuttal/example）
            key_points: 关键点列表
            evidence_refs: 证据引用
            strength: 强度
            
        Returns:
            创建的 ArgumentNode
        """
        self._node_counter += 1
        node_id = f"arg_{round_num}_{author}_{self._node_counter}"
        
        node = ArgumentNode(
            id=node_id,
            content=content,
            author=author,
            round=round_num,
            argument_type=argument_type,
            key_points=key_points or [],
            evidence_refs=evidence_refs or [],
            strength=strength
        )
        
        self.nodes[node_id] = node
        self._nodes_by_author[author].append(node_id)
        
        if round_num not in self._nodes_by_round:
            self._nodes_by_round[round_num] = []
        self._nodes_by_round[round_num].append(node_id)
        
        # 初始化边索引
        self._outgoing_edges[node_id] = []
        self._incoming_edges[node_id] = []
        
        return node
    
    def add_relation(
        self,
        source_id: str,
        target_id: str,
        relation: RelationType,
        strength: float = 0.5,
        description: str = ""
    ) -> Optional[ArgumentEdge]:
        """添加论点关系
        
        Args:
            source_id: 源论点 ID
            target_id: 目标论点 ID
            relation: 关系类型
            strength: 关系强度 (0-1)
            description: 关系描述
            
        Returns:
            创建的 ArgumentEdge，如果 ID 无效则返回 None
        """
        if source_id not in self.nodes or target_id not in self.nodes:
            return None
        
        self._edge_counter += 1
        edge_id = f"edge_{self._edge_counter}"
        
        edge = ArgumentEdge(
            id=edge_id,
            source_id=source_id,
            target_id=target_id,
            relation=relation,
            strength=strength,
            description=description
        )
        
        self.edges.append(edge)
        self._outgoing_edges[source_id].append(edge)
        self._incoming_edges[target_id].append(edge)
        
        # 更新节点状态
        target_node = self.nodes[target_id]
        if relation in [RelationType.ATTACKS, RelationType.REBUTS, RelationType.UNDERMINES]:
            target_node.is_rebutted = True
            target_node.rebuttal_count += 1
        elif relation in [RelationType.SUPPORTS, RelationType.BUILDS_ON]:
            source_node = self.nodes[source_id]
            source_node.support_count += 1
        
        return edge
    
    def get_unaddressed_arguments(self, side: str) -> List[ArgumentNode]:
        """获取指定方未被反驳的论点
        
        Args:
            side: 立场 (pro/con)，获取对方未被反驳的论点
            
        Returns:
            未被反驳的论点列表
        """
        opponent = "con" if side == "pro" else "pro"
        unaddressed = []
        
        for node_id in self._nodes_by_author[opponent]:
            node = self.nodes[node_id]
            if not node.is_rebutted:
                unaddressed.append(node)
        
        return unaddressed
    
    def get_strongest_arguments(self, side: str, limit: int = 3) -> List[ArgumentNode]:
        """获取指定方最强的论点
        
        基于：强度级别、支持数量、未被反驳状态
        """
        nodes = [self.nodes[nid] for nid in self._nodes_by_author[side]]
        
        def score(node: ArgumentNode) -> float:
            base = node.strength.value * 10
            support_bonus = node.support_count * 2
            rebuttal_penalty = node.rebuttal_count * 3 if node.is_rebutted else 0
            return base + support_bonus - rebuttal_penalty
        
        sorted_nodes = sorted(nodes, key=score, reverse=True)
        return sorted_nodes[:limit]
    
    def get_attack_chains(self, node_id: str) -> List[List[str]]:
        """获取针对某论点的攻击链
        
        Returns:
            攻击链列表，每条链是论点 ID 序列
        """
        chains = []
        
        def dfs(current_id: str, chain: List[str]):
            incoming = self._incoming_edges.get(current_id, [])
            attacks = [e for e in incoming if e.relation in [
                RelationType.ATTACKS, RelationType.REBUTS, RelationType.UNDERMINES
            ]]
            
            if not attacks:
                if len(chain) > 1:
                    chains.append(chain[:])
                return
            
            for edge in attacks:
                chain.append(edge.source_id)
                dfs(edge.source_id, chain)
                chain.pop()
        
        dfs(node_id, [node_id])
        return chains
    
    def calculate_debate_score(self) -> Dict[str, Any]:
        """计算双方辩论得分
        
        基于图结构：
        - 有效论点数量
        - 成功攻击数量
        - 未被反驳的论点
        - 论点强度加权
        """
        pro_score = 0.0
        con_score = 0.0
        
        # 计算论点得分
        for node_id, node in self.nodes.items():
            base_score = node.strength.value * 5
            
            # 未被反驳加分
            if not node.is_rebutted:
                base_score += 10
            else:
                base_score -= 3 * node.rebuttal_count
            
            # 支持加分
            base_score += node.support_count * 2
            
            if node.author == "pro":
                pro_score += base_score
            else:
                con_score += base_score
        
        # 计算攻击效果
        for edge in self.edges:
            if edge.relation in [RelationType.ATTACKS, RelationType.REBUTS]:
                target = self.nodes[edge.target_id]
                attacker = self.nodes[edge.source_id]
                attack_value = edge.strength * 5
                
                if attacker.author == "pro":
                    pro_score += attack_value
                else:
                    con_score += attack_value
        
        total = pro_score + con_score
        pro_percentage = (pro_score / total * 100) if total > 0 else 50
        
        return {
            "pro_score": round(pro_score, 1),
            "con_score": round(con_score, 1),
            "pro_percentage": round(pro_percentage, 1),
            "con_percentage": round(100 - pro_percentage, 1),
            "leader": "pro" if pro_score > con_score else ("con" if con_score > pro_score else "tie"),
            "pro_unaddressed": len(self.get_unaddressed_arguments("con")),
            "con_unaddressed": len(self.get_unaddressed_arguments("pro")),
            "total_arguments": len(self.nodes),
            "total_relations": len(self.edges),
        }
    
    def get_debate_summary(self) -> Dict[str, Any]:
        """获取辩论摘要"""
        return {
            "topic": self.topic,
            "rounds": list(self._nodes_by_round.keys()),
            "pro_arguments": len(self._nodes_by_author["pro"]),
            "con_arguments": len(self._nodes_by_author["con"]),
            "total_relations": len(self.edges),
            "scores": self.calculate_debate_score(),
            "pro_strongest": [n.to_dict() for n in self.get_strongest_arguments("pro", 2)],
            "con_strongest": [n.to_dict() for n in self.get_strongest_arguments("con", 2)],
        }
    
    def get_round_arguments(self, round_num: int) -> List[ArgumentNode]:
        """获取指定轮次的论点"""
        node_ids = self._nodes_by_round.get(round_num, [])
        return [self.nodes[nid] for nid in node_ids]
    
    def to_dict(self) -> Dict[str, Any]:
        """导出为字典"""
        return {
            "topic": self.topic,
            "nodes": [node.to_dict() for node in self.nodes.values()],
            "edges": [edge.to_dict() for edge in self.edges],
            "summary": self.get_debate_summary(),
        }
    
    def to_mermaid(self) -> str:
        """导出为 Mermaid 图表格式"""
        lines = ["graph TB"]
        
        # 添加节点
        for node in self.nodes.values():
            label = node.content[:30].replace('"', "'") + "..."
            shape = "([" if node.author == "pro" else "[["
            end_shape = "])" if node.author == "pro" else "]]"
            color = ":::pro" if node.author == "pro" else ":::con"
            lines.append(f'    {node.id}{shape}"{label}"{end_shape}{color}')
        
        # 添加边
        for edge in self.edges:
            arrow = "-->" if edge.relation in [RelationType.SUPPORTS, RelationType.BUILDS_ON] else "-.->|攻击|"
            lines.append(f'    {edge.source_id} {arrow} {edge.target_id}')
        
        # 添加样式
        lines.append('    classDef pro fill:#3b82f6,color:#fff')
        lines.append('    classDef con fill:#f97316,color:#fff')
        
        return "\n".join(lines)


class ArgumentAnalyzer:
    """论点分析器
    
    使用 AI 分析论点内容，提取关键信息并建立关系。
    """
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    async def extract_key_points(self, argument: str) -> List[str]:
        """提取论点的关键点"""
        prompt = f"""请从以下辩论论点中提取 2-4 个核心观点/论据，每个用一句话概括：

论点内容：
{argument}

请以 JSON 数组格式输出，例如：
["核心观点1", "核心观点2", "核心观点3"]
"""
        messages = [{"role": "user", "content": prompt}]
        response = self.ai_client.get_completion(messages, temperature=0.3)
        
        try:
            import json
            # 提取 JSON
            if "[" in response:
                start = response.find("[")
                end = response.rfind("]") + 1
                return json.loads(response[start:end])
        except:
            pass
        return []
    
    async def analyze_relation(
        self, 
        source_arg: str, 
        target_arg: str,
        source_author: str,
        target_author: str
    ) -> Optional[Dict[str, Any]]:
        """分析两个论点之间的关系"""
        prompt = f"""分析以下两个辩论论点之间的关系：

【论点A】({source_author})
{source_arg[:300]}

【论点B】({target_author})
{target_arg[:300]}

请判断论点A与论点B的关系，以 JSON 格式输出：
```json
{{
    "has_relation": true/false,
    "relation_type": "attacks"/"rebuts"/"supports"/"undermines"/"builds_on"/"none",
    "strength": 0.1-1.0,
    "description": "关系描述，10字以内"
}}
```
"""
        messages = [{"role": "user", "content": prompt}]
        response = self.ai_client.get_completion(messages, temperature=0.3)
        
        try:
            import json
            if "{" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                result = json.loads(response[start:end])
                if result.get("has_relation"):
                    return result
        except:
            pass
        return None
    
    async def build_graph_from_debate(
        self,
        topic: str,
        arguments: List[Dict[str, Any]]
    ) -> ArgumentGraph:
        """从辩论记录构建论点图谱
        
        Args:
            topic: 辩论主题
            arguments: 论点列表，每项包含 {content, author, round}
            
        Returns:
            构建好的 ArgumentGraph
        """
        graph = ArgumentGraph(topic=topic)
        
        # 添加所有论点
        node_map = {}  # (round, author) -> node_id
        for arg in arguments:
            key_points = await self.extract_key_points(arg["content"])
            node = graph.add_argument(
                content=arg["content"],
                author=arg["author"],
                round_num=arg["round"],
                key_points=key_points
            )
            node_map[(arg["round"], arg["author"])] = node.id
        
        # 分析相邻论点的关系
        for i, arg in enumerate(arguments):
            if i == 0:
                continue
            
            prev_arg = arguments[i - 1]
            
            # 只分析不同立场之间的关系
            if arg["author"] != prev_arg["author"]:
                relation = await self.analyze_relation(
                    source_arg=arg["content"],
                    target_arg=prev_arg["content"],
                    source_author=arg["author"],
                    target_author=prev_arg["author"]
                )
                
                if relation:
                    source_id = node_map[(arg["round"], arg["author"])]
                    target_id = node_map[(prev_arg["round"], prev_arg["author"])]
                    
                    relation_type = RelationType[relation["relation_type"].upper()]
                    graph.add_relation(
                        source_id=source_id,
                        target_id=target_id,
                        relation=relation_type,
                        strength=relation.get("strength", 0.5),
                        description=relation.get("description", "")
                    )
        
        return graph
