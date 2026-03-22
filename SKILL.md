---
name: pawclass
description: Teaching cloud app — build interactive courses with atomic CLI commands. Create courses, add slides/code/quiz/interactive scenes, add narration and whiteboard elements, manage mistakes.
metadata: {"openclaw":{"requires":{"bins":["pawclass"],"env":["PAWCLASS_TOKEN"]},"primaryEnv":"PAWCLASS_TOKEN"}}
---

# PawClass — Agent 内容创作工具

PawClass 是**远程云服务**，已部署好。用 `pawclass` CLI 的原子命令逐步构建课程。

## 重要：环境已预配置

> **所有环境变量已自动配置好，直接使用命令即可。**
>
> - `PAWCLASS_BASE_URL` 和 `PAWCLASS_TOKEN` 已注入，**不要修改、不要 unset、不要重新设置**。
> - **不要运行** `pawclass serve` 或 `pawclass migrate`（那是服务端命令，不是 CLI 命令）。
> - **不要尝试启动本地服务**，CLI 直接调用远程 API。

## 课程创建流程

### 1. 创建空课程

```bash
pawclass course create --title "Python 基础"
# stdout: {"id":"crs_xxx","url":"https://pawclass.teachclaw.app/course/crs_xxx","status":"draft"}
```

### 2. 逐步添加内容

每个命令都是原子操作，立即生效。浏览器端实时看到内容出现。

**添加幻灯片**（创建新 Scene）：
```bash
pawclass slide add crs_xxx --title "什么是 Python" --content "# Python 特点\n- 简洁易读\n- 生态丰富\n- 跨平台"
# stdout: {"sceneIndex":0,"sceneId":"xxx"}
```

**添加代码块**（创建新 Scene）：
```bash
pawclass code add crs_xxx --language python --content "print('Hello, World!')"
# 可选: --title "自定义标题"
# stdout: {"sceneIndex":1,"sceneId":"xxx"}
```

**添加测验**（创建新 Scene）：
```bash
pawclass quiz add crs_xxx --question "print() 函数的作用是？" --options "输出内容,读取输入,定义变量" --answer 0
# stdout: {"sceneIndex":2,"sceneId":"xxx"}
```

**添加互动场景**（创建新 Scene）：
```bash
pawclass interactive add crs_xxx --type code-editor --language python
# stdout: {"sceneIndex":3,"sceneId":"xxx"}
```

**添加旁白**（追加到最后一个 Scene 的 actions）：
```bash
pawclass narration add crs_xxx --text "让我们来看看第一个 Python 程序"
# stdout: {"sceneIndex":1,"actionId":"xxx"}
```

**添加白板元素**（追加到最后一个 Scene 的 actions）：
```bash
pawclass whiteboard add crs_xxx --type text --content "重点！" --x 100 --y 200
# 可选: --fontSize 24 --color "#ff0000" --width 200 --height 50
# type: text | shape | latex | line
# shape 类型可选: --shape rectangle|circle|triangle
# stdout: {"sceneIndex":1,"actionId":"xxx"}
```

### 3. 在聊天中发送课程链接

创建课程后，用以下格式发送链接，前端会自动渲染为可点击的教学卡片：
```
[clawbox-pawclass:crs_xxx](https://pawclass.teachclaw.app/course/crs_xxx)
```

### 4. 定稿并播放

```bash
pawclass course finalize crs_xxx
pawclass course play crs_xxx
```

### 5. 播放控制

```bash
pawclass course pause crs_xxx
pawclass course resume crs_xxx
pawclass course stop crs_xxx
pawclass course results crs_xxx   # 测验结果
pawclass course status crs_xxx    # 查询状态
```

## 分组策略

| 命令 | 行为 |
|------|------|
| `slide add` | 创建新 Scene |
| `code add` | 创建新 Scene |
| `quiz add` | 创建新 Scene |
| `interactive add` | 创建新 Scene |
| `narration add` | 追加到最后一个 Scene 的 actions |
| `whiteboard add` | 追加到最后一个 Scene 的 actions |

## 典型教学工作流

```bash
# 1. 创建课程
pawclass course create --title "Python 基础入门"

# 2. 第一个场景：介绍
pawclass slide add crs_xxx --title "什么是 Python" --content "# Python\n- 简洁易读\n- 生态丰富"
pawclass narration add crs_xxx --text "Python 是一门非常流行的编程语言"

# 3. 第二个场景：代码演示
pawclass code add crs_xxx --language python --content "# 第一个程序\nprint('Hello, World!')\n\n# 变量赋值\nname = 'Alice'\nprint(f'Hello, {name}!')"
pawclass narration add crs_xxx --text "这是最基本的 Python 代码，print 函数用来输出内容"

# 4. 第三个场景：测验
pawclass quiz add crs_xxx --question "print() 函数的作用是？" --options "输出内容到屏幕,读取用户输入,定义变量" --answer 0

# 5. 发送课程链接（前端自动打开教学面板）
# 在回复中包含：[clawbox-pawclass:crs_xxx](https://pawclass.teachclaw.app/course/crs_xxx)

# 6. 定稿 + 播放
pawclass course finalize crs_xxx
pawclass course play crs_xxx
```

## 错题管理

```bash
# 添加错题
pawclass mistake add --subject "数学" --problem "2+3=?" --answer "5" --wrong "4"
# 可选: --topic "加法" --difficulty 3

# 列出错题
pawclass mistake list
pawclass mistake list --subject "数学" --topic "加法"

# 标记已掌握
pawclass mistake master <mistake-id>

# 查看统计
pawclass stats
```

## 注意事项

- **环境已配好** — `PAWCLASS_TOKEN` 和 `PAWCLASS_BASE_URL` 已自动注入，不要修改
- **不要运行** `pawclass serve` 或 `pawclass migrate`（服务端命令，不是给 Agent 用的）
- **不要尝试本地模式** — CLI 直接调用远程 `https://pawclass.teachclaw.app`
- 课程数据持久化在数据库，**服务重启不会丢失**
- 课程支持**渐进式加载**：创建后浏览器立即可以打开，内容会实时出现
- draft 和 playing 状态都可以继续添加内容
- stdout 输出 JSON（给 Agent 解析），stderr 输出人类可读状态
- 在聊天中发送 `[clawbox-pawclass:crs_xxx](url)` 格式的链接，前端自动打开教学面板
