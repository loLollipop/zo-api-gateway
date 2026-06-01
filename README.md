# Zo Computer API Gateway

一个基于 Cloudflare Workers 的 API 网关，将 Zo Computer 的 API 转换为兼容 Anthropic Messages API (`/v1/messages`) 的接口。自带号池管理面板，支持在线添加/管理多个 Zo Token.

## 功能

- 兼容 Anthropic Messages API `/v1/messages` 端点
- 兼容 OpenAI Chat Completions API `/v1/chat/completions` 端点
- **支持 Tool Use / Function Calling** — 利用 Zo `output_format` 结构化输出实现可靠的工具调用
- 支持流式 (SSE) 和非流式响应
- 支持 `Authorization: Bearer` 和 `x-api-key` 双认证
- 支持 `system` 系统提示词
- 支持所有 Zo Computer 上可用的模型
- **号池管理面板** — Web 界面在线管理 Zo Token（添加/删除/启停），无需改代码
- **多 Key 聚合** — 多个 Zo Token 轮询调度，自动故障切换，对外统一为一个 Key
- GitHub Actions 自动部署，push 到 main 即自动更新
- 零成本部署在 Cloudflare Workers 上

## 号池管理面板

部署后访问 `https://你的域名/admin` 即可打开管理面板：

- 用 Admin Key 登录
- 查看所有 Token 的状态（总计/可用/已禁用）
- 在线添加新 Token（单个或批量导入）
- 启用/禁用/删除 Token
- Token 数据持久化在 Cloudflare KV 中，不会丢失
- 已部署实例会在首次访问 token / log 相关接口时自动迁移旧 KV blob 数据，无需手动处理

## 两种工作模式

### 直通模式（默认）

用户直接传入自己的 Zo Access Token，网关原样转发。

### 多 Key 聚合模式

配置 `GATEWAY_KEY` 和 `ADMIN_KEY` 后，通过管理面板添加多个 Zo Token。客户端只需要用一个 Gateway Key，网关自动轮询选择后端 Token；如果当前没有任何可用的池内 Token，请求会返回 `503`，不会回退成直通模式。

```
客户端 → Gateway Key → Worker → 轮询选择 Zo Token → api.zo.computer
                                    ↓ 失败时自动切换
                               下一个 Zo Token → api.zo.computer
```

## 部署（GitHub Actions 自动部署）

只需要配置一次，之后每次 push 到 main 分支都会自动部署。

### 第 1 步：Fork 本仓库

点击 GitHub 页面右上角的 **Fork** 按钮，把仓库复制到你自己的账号下。

### 第 2 步：获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → **我的个人资料** → 左侧 **API 令牌**
3. 点击 **创建令牌**
4. 选择 **编辑 Cloudflare Workers** 模板
5. 确认权限后点击 **继续摘要** → **创建令牌**
6. 复制生成的令牌（只显示一次）

### 第 3 步：获取 Cloudflare Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧 **Workers 和 Pages**
3. 右侧会显示 **账户 ID**，复制它

### 第 4 步：创建 KV 命名空间

1. 在 Cloudflare Dashboard 左侧 → **Workers 和 Pages** → **KV**
2. 点击 **创建命名空间**，名称填 `zo-gateway-tokens`
3. 创建后复制 **命名空间 ID**

### 第 5 步：配置 GitHub Secrets

进入你 Fork 的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，依次添加：

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 第 2 步获取的 API 令牌 | Cloudflare 部署凭证 |
| `CLOUDFLARE_ACCOUNT_ID` | 第 3 步获取的账户 ID | Cloudflare 账户标识 |
| `KV_NAMESPACE_ID` | 第 4 步获取的 KV 命名空间 ID | Token 数据存储 |
| `GATEWAY_KEY` | 你自定义的客户端调用 Key，比如 `sk-gw-xxx` | 客户端访问 `/v1/*` 的统一 API 密钥 |
| `ADMIN_KEY` | 你自定义的管理 Key，比如 `sk-admin-xxx` | 管理面板和 `/admin/*` 的登录密钥 |

所有配置都在 GitHub Secrets 里完成，不需要去 Cloudflare Dashboard 手动设置任何变量。

> 注意：`ADMIN_KEY` 未配置，或与 `GATEWAY_KEY` 相同时，管理面访问会返回 `503 Admin access is unavailable.`。

### 第 6 步：触发部署

随便改一下代码（比如编辑 README），push 到 main 分支，GitHub Actions 会自动部署。

部署成功后：
- Worker URL：`https://zo-api-gateway.<你的子域>.workers.dev`
- 管理面板：`https://zo-api-gateway.<你的子域>.workers.dev/admin`

## 管理 Zo Token

### 通过管理面板（推荐）

1. 访问 `https://你的域名/admin`
2. 用 Admin Key 登录
3. 在面板上添加 Zo Token（支持单个添加和批量导入）
4. 可以随时启用/禁用/删除 Token

### 批量导入格式

在管理面板的批量导入框中，每行一个 Token：

```
zo_sk_token1
账号2:zo_sk_token2
我的账号3:zo_sk_token3
```

格式为 `备注名:token`，不写备注名则自动编号。

## 使用

### 直通模式

```bash
curl -s https://YOUR_WORKER_URL/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ZO_TOKEN" \
  -d '{
    "model": "claude-opus-4-8",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### 多 Key 聚合模式

```bash
curl -s https://YOUR_WORKER_URL/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
  -d '{
    "model": "claude-opus-4-8",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### 在 Claude Code 中使用

```bash
# 设置环境变量
export ANTHROPIC_BASE_URL=https://YOUR_WORKER_URL
export ANTHROPIC_API_KEY=YOUR_GATEWAY_KEY

# 启动 Claude Code
claude
```

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    api_key="YOUR_GATEWAY_KEY",
    base_url="https://YOUR_WORKER_URL",
)

message = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role": "user", "content": "你好"}],
)
print(message.content[0].text)
```

## 多 Key 调度策略

- **轮询 (Round Robin)**：请求均匀分配到各个 Token
- **自动故障切换**：Token 返回 401/403/429 时自动标记为失败，切换到下一个
- **冷却恢复**：失败的 Token 在冷却时间（默认 60s）后自动恢复可用
- **全部耗尽保护**：所有 Token 都失败时重置状态，重新尝试

## 支持的模型

网关支持 Zo Computer 当前可用的聊天模型，包括：

- `claude-opus-4-8`
- `claude-sonnet-4-6`
- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`
- `deepseek-v4-pro`
- `glm-5`
- `minimax-m3`
- `gemini-3.1-pro-preview`

传入不带供应商前缀的 model 名时，网关会按内置别名映射到 Zo 的 `provider:model` 格式；也可以直接传 `zo:provider/model`。

## 已知限制（重要，使用前请读）

本网关本质上是 **Zo Computer `/zo/ask` 接口 ↔ Anthropic Messages API 的协议适配层**，不是高保真 Anthropic 透传代理。上游 Zo `/zo/ask` 是一个"摊平字符串进、摊平字符串出"的 agentic 端点，无法暴露 Anthropic 原生协议的所有语义，所以以下能力**无法**做到与官方 Anthropic API 等效：

### 模型人格 / 行为差异

上游 Zo 平台在调用 Claude 时会**自动注入一段 Zo agentic assistant 的 persona system prompt** 并启用平台自带的工具能力（联网、文件、代码等）。所以即便客户端调用的是 `claude-opus-4-8`，模型也会以"我是 Zo，你的个人云端电脑助手"的身份回答，并可能在没明确请求的情况下使用工具。这与裸 Claude API 的默认行为差异显著。

→ 如果你需要"原生 Claude 行为"，请在 Zo 平台创建一个**无 system prompt、不挂工具的 persona**，然后在请求里通过 `metadata.persona_id` 传入该 persona id：

```bash
curl -s https://YOUR_WORKER_URL/v1/messages \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "claude-opus-4-8",
    "messages": [{"role":"user","content":"你好"}],
    "metadata": {"persona_id": "你的 raw persona id"}
  }'
```

### 客户端 `system` 字段是**尽力而为**

由于上游只接受 `input: string`，本网关会把客户端的 `system` 字段以 `[System]\n...` 文本前缀的方式拼到对话开头送给 Zo。**这不是真正的 system 通道**，模型有概率识别出这是"对话内容里的指令"并**主动选择不遵守**（已实测）。需要可靠 system 行为请走上面的 `persona_id` 路径。

### Tool Use 支持说明

网关通过 Zo 的 `output_format` 结构化输出功能实现了工具调用支持：

- **OpenAI 格式**：支持 `tools` 参数，响应中返回标准的 `tool_calls` 结构
- **Anthropic 格式**：支持 `tools` 参数，响应中返回 `tool_use` content block
- 当请求包含工具定义时，网关会将工具描述注入到 prompt 中，并使用 Zo 的 `output_format` 约束模型输出为结构化 JSON（`text` + `tool_name` + `tool_args`），然后解析为标准 API 格式返回
- 流式模式下，带工具的请求会先以非流式方式获取完整响应，解析后再以 SSE 事件流形式发送，确保工具调用的可靠性
- 支持工具名称和参数的自动映射与纠正（模糊匹配）

**限制**：工具调用的可靠性取决于模型对 `output_format` 的遵从程度，不保证 100% 与官方 API 行为一致。

### 不支持的功能

| 功能 | 状态 | 备注 |
|---|---|---|
| 多模态输入 (`image` content block) | **静默丢弃** | `/zo/ask` 不接受图片，图片在网关层被过滤 |
| Extended thinking（`thinking` 参数）| **请求侧不透传** | Zo 后端无对应入口；网关响应侧已**预留** thinking part_kind → Anthropic `thinking` content_block 的转换，一旦上游开始透出会自动生效 |

### 响应元数据是估算/重建的，不是上游透传

以下字段**不是**上游真实值，而是由网关基于响应文本估算/合成的：

| 字段 | 实际来源 |
|---|---|
| `id` | 网关随机生成 (`msg_xxx`) |
| `model`（响应字段） | 客户端传入的 model 名（即使上游路由到别的模型也无从察觉） |
| `usage.input_tokens` / `usage.output_tokens` | `Math.ceil(text.length / 4)` 估算；非真实 tokenizer 计数 |
| `stop_reason` | 在网关层根据 `max_tokens` / `stop_sequences` 是否触发判断；如果都没触发则为 `end_turn` |

### 网关层兜底实现

下列 Anthropic 参数上游 Zo 不接受，但**网关已在收到响应后做客户端侧兜底**：

- `max_tokens` — 网关按 `max_tokens * 4` 字符为上限截断输出，并把 `stop_reason` 改成 `max_tokens` (`finish_reason: length`)
- `stop_sequences`（OpenAI 的 `stop`）— 网关在输出文本里扫描，最早命中处截断，并把 `stop_reason` 改成 `stop_sequence`

`temperature` / `top_p` / `top_k` 由于不影响上游生成，目前只能被忽略。

### 上游 Zo 服务稳定性

Zo `/zo/ask` 偶发 5xx，网关会原样向客户端返回 502 + 上游原文。这是上游服务问题，不在本网关可修复范围内。

## License

MIT
