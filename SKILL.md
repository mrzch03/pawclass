---
name: pawclass
description: Teaching cloud app — mistake tracking + interactive lessons. Use the pawclass CLI to manage teaching sessions. The server is already running remotely.
metadata: {"openclaw":{"requires":{"bins":["pawclass"]}}}
---

# PawClass — 教学云应用

PawClass 是一个**远程云服务**，已经部署好了。你只需要用 `pawclass` CLI 来调用它。

**不需要**：启动服务、配置数据库、设置 API key。这些都已经在服务端配好了。

## 环境变量

CLI 需要 `PAWCLASS_BASE_URL` 来知道服务地址。如果没设置，先设一下：
```bash
export PAWCLASS_BASE_URL="https://pawclass.teachclaw.app"
```

## 教学流程

### 1. 创建教学大纲（JSON 格式）

根据学生需求写一个教学大纲 JSON 文件：
```bash
cat > /tmp/outline.json << 'EOF'
{
  "title": "Python 基础入门",
  "scenario": "knowledge_first",
  "scenes": [
    {
      "title": "什么是 Python",
      "actions": [
        {"type": "narration", "text": "Python 是一门简洁优雅的编程语言..."},
        {"type": "slide", "content": "# Python 特点\n- 简洁易读\n- 生态丰富\n- 跨平台"}
      ]
    },
    {
      "title": "第一个程序",
      "actions": [
        {"type": "narration", "text": "让我们写第一个 Python 程序"},
        {"type": "code", "language": "python", "content": "print('Hello, World!')"},
        {"type": "quiz", "question": "print() 函数的作用是？", "options": ["输出内容到屏幕", "读取用户输入", "定义变量"], "answer": 0}
      ]
    }
  ]
}
EOF
```

### 2. 创建教学 session
```bash
pawclass session load --outline @/tmp/outline.json
# → {"id":"ses_xxx","status":"generating"}
```

### 3. 检查 session 状态
```bash
pawclass session status ses_xxx
# → {"status":"ready","totalSteps":7}
```

### 4. 在聊天中发送教学链接

在回复中用这个格式嵌入链接，前端会自动打开教学面板：
```
[clawbox-pawclass:ses_xxx](https://pawclass.teachclaw.app/session/ses_xxx)
```

然后开始播放：
```bash
pawclass session play ses_xxx
```

### 5. 教学过程中

教学应用会自主播放。关键事件会作为系统通知出现在聊天中：
- "[clawbox-pawclass] 第4步测验完成，答对3/5题"
- "[clawbox-pawclass] 学生请求帮助"
- "[clawbox-pawclass] 教学完成"

### 6. 按需操作
```bash
pawclass session pause ses_xxx    # 暂停
pawclass session resume ses_xxx   # 继续
pawclass session results ses_xxx  # 查看测验结果
pawclass session stop ses_xxx     # 结束
```

## 使用场景

- 学生说"帮我讲讲 Python" → 写大纲 JSON → 创建 session → 发链接
- 学生说"我想复习数学" → 写数学大纲 → 开始教学
- 收到测验通知 → 查看结果 → 答错的建议再学

## 注意事项

- **不要运行** `pawclass serve` 或 `pawclass migrate`（那是服务端命令）
- 启动教学后不需要管理播放节奏，应用会自主推进
- 系统通知自动出现在聊天中，按需响应即可
