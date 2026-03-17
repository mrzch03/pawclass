# clawbox-mistakes — 错题本管理工具

记录学生做错的题目，追踪薄弱知识点，通过间隔重复安排复习。当学生做错题、需要复习、或想了解自己的薄弱环节时，使用这个工具。

## 命令

### 添加错题

```bash
# 基本添加
clawbox-mistakes add --subject math --problem "求解 x^2 - 5x + 6 = 0" --topic 二次方程

# 完整信息
clawbox-mistakes add --subject physics --problem "自由落体问题：从10m高处释放一个球，求落地时间" \
  --topic 自由落体 --wrong-answer "1s" --correct-answer "约1.43s" \
  --explanation "使用 h=½gt²，t=√(2h/g)" --difficulty 3 --source "期中考试" --tags "运动学,力学"

# 管道输入题目
echo "证明：任意三角形的内角和为180度" | clawbox-mistakes add --subject math --topic 几何证明
```

输出错题 ID（如 `m_a3f8c1b2`），加 `--json` 输出完整对象。

### 查询错题

```bash
# 列出所有
clawbox-mistakes mistake list --json

# 按学科过滤
clawbox-mistakes mistake list --subject math --unmastered --json

# 获取详情
clawbox-mistakes mistake get m_a3f8c1b2 --json

# 标记已掌握
clawbox-mistakes mistake master m_a3f8c1b2

# 更新信息
clawbox-mistakes mistake update m_a3f8c1b2 --explanation "新的解析" --difficulty 4

# 删除
clawbox-mistakes mistake delete m_a3f8c1b2
```

### 复习

```bash
# 查看待复习的错题（按间隔重复算法排序）
clawbox-mistakes review due --subject math --limit 5 --json

# 记录复习结果
clawbox-mistakes review log m_a3f8c1b2 --result correct --note "这次理解了配方法"
clawbox-mistakes review log m_a3f8c1b2 --result wrong --note "还是忘了公式"
clawbox-mistakes review log m_a3f8c1b2 --result partial

# 查看某题的复习历史
clawbox-mistakes review history m_a3f8c1b2 --json
```

`--result` 取值：`correct`（完全正确）、`wrong`（做错）、`partial`（部分正确）。

### 统计

```bash
# 总体统计
clawbox-mistakes stats --json

# 按学科统计
clawbox-mistakes stats --subject math --json
```

JSON 输出包含 `total`、`mastered`、`unmastered`、`bySubject`（各学科计数）、`weakTopics`（未掌握最多的知识点排名）。

### 启动 HTTP 服务

```bash
clawbox-mistakes serve
```

在端口 9801 启动 HTTP 服务，提供 REST API 和健康检查端点 `/healthz`。

## 输出格式

所有命令加 `--json` 输出 JSON 到 stdout。

单个错题对象：
```json
{
  "id": "m_a3f8c1b2",
  "subject": "math",
  "topic": "二次方程",
  "problemText": "求解 x^2 - 5x + 6 = 0",
  "wrongAnswer": "x=1, x=6",
  "correctAnswer": "x=2, x=3",
  "explanation": "使用因式分解 (x-2)(x-3)=0",
  "difficulty": 3,
  "mastered": false,
  "tags": "[\"代数\",\"方程\"]",
  "createdAt": "2026-03-17T10:00:00Z"
}
```

列表返回数组 `[{...}, {...}]`，可用 `jq .[]` 遍历。

## 在聊天中展示

错题本有 Web UI，启动后可嵌入聊天卡片：

```
[clawbox-viz:mistakes-review](http://localhost:9801/review)
```

## 使用场景

1. **学生做错题后** — 立即用 `add` 记录错题、错误答案和正确解法，帮助学生积累错题本
2. **复习阶段** — 用 `review due` 获取待复习错题，引导学生逐题回顾，用 `review log` 记录结果
3. **考前分析** — 用 `stats` 查看薄弱知识点，重点复习未掌握的高频错题类型
4. **阶段性检查** — 用 `mistake list --unmastered --subject math` 查看某学科剩余未掌握的题目
5. **标记进步** — 学生连续答对后用 `mistake master` 标记已掌握，追踪学习进度

## 注意事项

- 所有数据存储在本地 SQLite，路径由 `CLAWBOX_MISTAKES_DB` 控制
- `--subject` 是添加错题时唯一的必填字段（加上题目内容）
- `tags` 用逗号分隔传入（`--tags "代数,方程"`），存储为 JSON 数组
- `difficulty` 范围 1-5，默认 3
- `review due` 返回的是未掌握且最需要复习的错题，优先返回从未复习过的和上次答错的
- 管道输入时题目从 stdin 读取，其他字段仍通过 flags 传入
