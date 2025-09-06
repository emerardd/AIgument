from sqlalchemy import create_engine, inspect, text
import os

# 获取数据库路径
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "instance", "aigument.db")
engine = create_engine(f'sqlite:///{db_path}')

# 检查表
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"数据库中的表：{tables}")

# 检查每个表中的数据
for table in tables:
    print(f"\n表 {table} 中的数据：")
    with engine.connect() as conn:
        # 安全地引用表名，避免SQL注入（虽然此脚本仅用于本地调试）
        # 使用参数化无法用于表名，这里通过白名单校验 + 引号包裹
        if table not in tables:
            continue
        quoted_table = f'"{table}"'
        result = conn.execute(text(f"SELECT * FROM {quoted_table}"))
        for row in result:
            print(row) 