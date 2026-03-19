---
name: pawclass
description: Teaching platform with mistake tracking and interactive lessons. Use for mistake management, personalized teaching outlines, and interactive classroom sessions with slides, whiteboard, quizzes, and voice narration.
metadata: {"openclaw":{"requires":{"bins":["pawclass"]}}}
---

# PawClass — 教学云应用

集成错题管理 + 个性化教学大纲生成 + 互动课堂播放。

## 错题管理

### 添加错题
```bash
curl -X POST http://localhost:9801/api/mistake \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject":"数学","topic":"二次函数","problemText":"求解...","wrongAnswer":"x=3","correctAnswer":"x=2","explanation":"..."}'
```

### 查看统计
```bash
curl http://localhost:9801/api/stats -H "Authorization: Bearer $TOKEN"
```

### 标记掌握
```bash
curl -X POST http://localhost:9801/api/mistake/<id>/master -H "Authorization: Bearer $TOKEN"
```

## 教学流程

### 1. 生成教学大纲（基于错题数据）
```bash
curl -X POST http://localhost:9801/api/teaching/outline \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"request":"学生的原话","depth":"standard"}' > /tmp/outline.json
```

### 2. 创建教学 session
```bash
pawclass session load --outline "$(cat /tmp/outline.json)"
→ {"id":"ses_xxx","status":"generating"}
```

### 3. 等待生成完成
```bash
pawclass session status ses_xxx
→ {"status":"ready","totalSteps":7}
```

### 4. 在聊天中嵌入教学界面并开始
在回复中嵌入链接，前端会自动打开 App Panel：

"好的，我来给你系统讲一下。
[pawclass:ses_xxx](http://localhost:9801/session/ses_xxx)"

```bash
pawclass session play ses_xxx
```

### 5. 教学应用自主播放

关键事件会作为系统通知出现在聊天中：
- "[pawclass] 第4步测验完成，答对3/5题"
- "[pawclass] 学生请求帮助"
- "[pawclass] 教学完成"

### 6. 按需响应通知

查看测验结果：
```bash
pawclass session results ses_xxx
```

暂停/继续：
```bash
pawclass session pause ses_xxx
pawclass session resume ses_xxx
```

### 7. 测验结果闭环
- 答错的题 → 录入错题本
- 答对的相关错题 → 标记掌握

## 使用场景

- 学生说"帮我讲讲二次函数" → 拿大纲 → 启动教学
- 学生某知识点反复做错 → 主动建议上课
- 学生说"我想复习力学" → 启动混合模式教学

## 注意事项

- 启动教学后不需要管理播放节奏，应用会自主推进
- 系统通知自动出现在聊天中，按需响应即可
- 教学界面链接格式: [pawclass:session_id](url)
