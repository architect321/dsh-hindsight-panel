<p align="center">
  <img alt="Hindsight 记忆视图" src="docs/assets/logo.svg" width="200">
</p>

<h1 align="center">Hindsight 记忆视图</h1>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
  <a href="https://github.com/deepseek-ai"><img alt="Platform: DeepSeek Harness" src="https://img.shields.io/badge/Platform-DeepSeek%20Harness-4F7CFF"></a>
  <img alt="Hindsight memory" src="https://img.shields.io/badge/Hindsight-memory-8B5CF6">
</p>

`dsh-hindsight-panel`：在左侧栏点「Hindsight 记忆」图标，主区打开整页，观测本机 `hindsight-coding-agents` 插件到底记住了什么、放在哪里，并处理需要人工决定的异步整理任务。只读——不改写、不删除任何记忆。

## 快速开始

### 安装

本仓以 DSH 插件包形式发布：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，`dsh.client` 声明 web 平台入口；不发布到 npm。

挂到 profile 的方式：在 profile 的 `package.json` 里把本仓加成依赖，然后在「插件」里启用。

```json
"dsh-hindsight-panel": "link:<本仓路径>"
```

前置条件：本机已装 `hindsight-coding-agents`（记忆库本体）并有可用的 Hindsight 守护进程；另需一条可用的模型路由（生成中文摘要用）。

生效方式：client 半改动刷新页面（Ctrl+R）即可；host 半（`lib/index.js`）的改动要重启 DSH，或在「插件」里把本插件关闭再打开（触发 profile 重组）。

插件配置默认读 `~/.hindsight/coding-agent.json`，与编码代理插件读同一个文件；可用 `HINDSIGHT_CONFIG` 指向别处。

### 侧栏入口

- 与「诊断画布」（`dsh-sleuth-canvas`）同一套注册方式：`sidebar.panellist` 注册一行图标（id `hindsight-memory`，`order: 40`，label 取「Hindsight 记忆」），`main` 的 keyed 槽注册同一 id 的整页组件；选中侧栏这一行就渲染这一页，不再占用会话视图的页签。
- 若侧栏里的入口不想看了：行内 unpin（「更多」菜单）只隐藏图标，页面注册不受影响；彻底移除要改 `lib/client.js` 里的这段注册。
- client 半改动只需刷新页面（Ctrl+R）；host 半（`lib/index.js`）的改动仍需重启 DSH 或在「插件」里关闭再打开本插件。

## 页签

- **概览**：记忆库（bank）、运行形态（daemon / API 地址 / 健康状态 / 配置文件）、事实与观察统计、五张固定页面的生成状态与中文用途摘要、数据库位置；顶部有「自检并拉起」按钮。「记忆统计」里的「整理操作」一行显示**去重后**的待处理/失败/处理中数量（与「整理」页同源），并带「查看整理操作 →」跳转。
- **页面**：`Component map`、`Core concepts`、`Conventions and patterns`、`Key decisions and rationale`、`Initiatives and enhancements` 五张固定页面；每张卡片带一段**中文摘要**（见下），展开可读正文与生成问句；另列自定义页面与举措页面。
- **记忆**：按类型（observation / world / experience）与关键字分页浏览事实，显示写入时间、标签与状态。
- **文档**：每次会话回写的 transcript 文档，含字符数、抽取出的记忆单元数、来源 harness；可继续加载。
- **整理**：Hindsight 异步任务队列（会话回写、记忆整理、页面刷新）。顶部显示队列数量（失败 / 待处理 / 处理中）与其中需要你处理的条数；只列出**需要用户处理**的任务，可直接重试、取消或删除任务记录；无需用户处理的任务只写入日志，不在这里显示。日志路径可在卡片里复制，也会出现在「存储」页。
- **存储**：配置、日志、整理操作日志、嵌入式 PostgreSQL 实例与插件安装目录的完整路径、大小和日志文件清单；带「复制路径」。

## 整理操作的判定与日志

「整理」页读取 `GET /v1/default/banks/{bank}/operations`（failed / pending / processing 各取最近 100 条，`exclude_parents=true` 去掉批量任务的主记录去重；有失败项时再分页读取 completed 历史用于判断“是否已被后续任务取代”，最多 5 页），按下面规则分流：

| 情况 | 处理 |
| --- | --- |
| 失败，且之后没有同一文档/页面的成功或进行中任务 | **需要处理**：可「重试」重新排队，或「删除记录」清理 |
| 失败，但之后同一目标已有成功或进行中的任务（superseded） | 无需处理，写日志 |
| 失败，但更早的完成记录未纳入检查、无法确认是否已被取代 | **需要处理**：只提供「删除记录」，避免重试造成重复写入 |
| 处理中且 15 分钟内没有进度心跳 | **需要处理**：可「取消任务」（同时清掉崩溃 worker 遗留的 processing） |
| 待处理、排队中或已排期（`next_retry_at` 在未来） | 无需处理，写日志 |
| 待处理超过 1 小时仍未开始 | **需要处理**：提示先「自检并拉起」，可「取消任务」 |

- 为避免“重试老失败任务”造成重复写入：同一 document / mental model 之后已有成功或进行中的任务时，旧失败记录判定为 superseded，只记日志。completed 历史按页读取到最老的失败项为止（最多 500 条）；没覆盖到的失败项标记为“无法确认”，不允许重试。
- 无需处理的项每条写一行 JSONL 到 `~/.hindsight/profiles/<daemonProfile>.panel-operations.log`：在**打开/刷新「整理」页拉取时写入**，同进程内按 `bank + 任务 id + 状态 + 更新时间` 去重，反复刷新不会重复追加；任务操作（retry / delete / cancel）也记一行 `event: "action"`，并在动作前读取任务详情，把任务类型、状态、文档与原始错误一起留下作为审计。
- 「记忆统计」里的整理操作数量不再直接取 `/stats` 的 `pending_operations` / `failed_operations`（那里把批量任务的主记录和子记录各算一次，会出现“失败 10”而实际只有 5 个任务），而是和「整理」页一样用 `exclude_parents=true` 的任务列表计数；两个页面的数字因此一致。`/stats` 的原始计数只在 operations 接口不可用（旧版 Hindsight）时兜底。
- 没有需要处理的项时，页面会结合队列数量直接说明原因（“队列中的 N 项任务会自动完成，或已被后续任务取代”），避免出现“待处理 1”与“没有需要你处理的任务”并列造成的语义冲突；队列本身为空时显示“当前没有排队、处理中或失败的整理任务”。
- 这些操作只作用于异步任务队列，不会删除任何记忆、页面或文档；「删除记录」仅删除终态任务行。重试会重新抽取同一份内容，可能重复写入事实；取消后该任务不会再自动执行。


## 中文摘要

页面卡片上的「中文摘要」由本机 DSH 的默认模型生成：host 半把页面名称、标签和正文（截断到 14000 字符）发给默认模型，要求返回 `{"title": "...", "summary": "..."}` 形式的简体中文摘要；client 半把标题和 2–4 句摘要显示在卡片上，正文仍按原文（Markdown）保留在下方。

- **缓存**：按 bank + 页面 id + 更新时间 + 正文摘要值缓存（进程内，最多 80 条）；页面更新后自动重新生成，面板刷新不会重复调用模型。
- **未生成正文的固定页面**：显示这类页面用途的固定中文说明，例如「组件地图记录本项目的目录、模块与关键文件各自负责什么」。
- **失败**：显示错误信息和「重试」按钮；host 半尚未加载（例如刚更新代码但没重启 DSH）时显示「摘要接口要重启 DSH 后才可用」。
- **模型路由**：默认取 `agentDefaultModel.currentSelection()`，即当前 profile 的默认模型；也可以在插件的 `cordis.patch.yml` 配置里写 `provider` / `model` 覆盖。
- **需要重新加载 host 半**：只刷新页面会加载新的 client，但 host 的新 RPC（摘要、整理操作）要等 DSH 重启，或在「插件」里把本插件关闭再打开（触发 profile 重组）。

## 自检与拉起

重启电脑后，DSH 会随桌面启动，`hindsight-coding-agents` 插件在会话启动时 spawn `daemon-start.js`；本地嵌入模型和重排模型从 `HF_HOME` 缓存加载，通常 20–40 秒后 API 就绪。面板打开时如果 API 还不可用，会**每 5 秒自动探测一次**，就绪后自动刷新。

**面板打开时会自动拉起（0.4.5 起）**：只重启 DSH（不是重启电脑）时，daemon 会随 DSH 一起退出，而 Hindsight 插件要等下一次会话启动才重新拉起它——这段时间面板会显示「不可用」。所以面板在概览加载后发现 API 不可用时，会等 6 秒后自己跑一次「自检并拉起」（每次打开面板最多一次）；如果发现守护进程已经在启动（例如插件刚在会话启动时拉起的），就只跟随等待、不再重复 spawn。恢复过程会显示在自检卡片里（「启动中… 已等待 Ns」→「记忆库已恢复」）。

顶部「自检并拉起」按钮提供手动兜底：

1. 检查配置文件、`/health`、pg0 数据目录与守护进程 pid；
2. API 不可用时，以离线模式（`HF_HUB_OFFLINE=1`、`TRANSFORMERS_OFFLINE=1`）spawn 已安装插件里的 `dist/daemon-start.js --harness dsh`（插件包目录从 profile 的 `node_modules` 自动定位）。启动器把进度写进 `~/.hindsight/coding-agents-logs/plugin.log` 的 `[hindsight:daemon.start]` 行；被 spawn 时的 stdout/stderr 才写到 `~/.hindsight/profiles/<daemonProfile>.panel-start.log`（node 崩溃时才非空）；
3. 每 3 秒轮询，最长 15 分钟；恢复后自动刷新概览、统计与页面，并在自检卡片里显示最新检查项。等待超时后卡片会列出 `plugin.log` 的启动行、`<daemonProfile>.log` 与 `panel-start.log` 的最新内容——不要再让「启动超时」成为唯一线索。

启动前会检查 `~/.hindsight/profiles/<daemonProfile>.pid` 和本插件的启动标记；如果检测到守护进程已经在启动，只显示「启动中」，不会重复拉起。判断 pid 时不仅看进程是否存活，还会：

- 用 `tasklist` 核对镜像名：pid 被 Windows 复用给无关进程（比如某个 `chrome.exe`）时，不会再把状态误判成「启动中」而一直不拉起；
- pid 文件超过 30 分钟仍未就绪时按已卡住处理，允许重新拉起；
- 端口已监听但 `/health` 不健康时（只重启 DSH 后常见的「孤儿守护进程 + 数据库已断开」），**不会**再起一个抢端口的进程，而是直接提示先停掉占用端口的进程。

拉起时会给 `daemon-start.js` 带上 `HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT=1800`（已显式设置的环境变量优先）。embed CLI 默认只等 180 秒：首次启动若需要下载 `hindsight-api` 依赖（数百 MB、慢网下要十几分钟），180 秒一到就把下载中的进程杀掉，缓存永远装不完——于是每次点「自检并拉起」都在重复下载、重复失败。把等待上限抬高后，第一次能装完，之后启动恢复为 40 秒左右。

> 启动变慢/失败的一个常见原因：机器重启后 Hugging Face Hub 不可达，嵌入模型初始化会卡在 Hub 重试。`~/.hindsight/profiles/<daemonProfile>.env` 里的 `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1` 让模型直接从缓存加载；本插件手动拉起时也会显式带上这两个变量。
>
> 另一个常见原因是直连 PyPI 太慢。需要时可以在本插件配置里指定 PyPI 镜像（只影响拉起时的 uv 下载）：
>
> ```yaml
> # cordis.patch.yml，本插件的 insert 项里
> config:
>   uvIndex: https://mirrors.aliyun.com/pypi/simple/
> ```
>
> 注意：uv 的 tool 环境会按解析设置缓存，切镜像会让缓存重建一次；同一台机器上最好固定用一个镜像，或者不用。

## 数据来源

- 配置：`~/.hindsight/coding-agent.json`（可用 `HINDSIGHT_CONFIG` 覆盖），决定 `serverMode`、`apiPort`、`daemonProfile`。
- 记忆内容：本机 Hindsight API（daemon 模式为 `http://127.0.0.1:9077`），只发只读请求：
  `GET /health`、`/v1/default/banks`、`/v1/default/banks/{bank}/stats`、`/pages/tree`、`/pages/{id}`、`/memories/list`、`/documents`。
- 整理操作：`GET /v1/default/banks/{bank}/operations`；用户点击按钮时才发写请求：
  `POST /operations/{id}/retry`（重新排队）、`DELETE /operations/{id}`（取消进行中）、`DELETE /operations/{id}/delete`（删除终态记录）。
- 中文摘要：本机 DSH 默认模型（`ctx.llm`），只发送当前页面的名称、标签和正文，不发送其他记忆。
- 自检/拉起：`~/.hindsight/profiles/<daemonProfile>.{env,pid,log}`、`~/.hindsight/profiles/<daemonProfile>.panel-start.log`、`~/.hindsight/coding-agents-logs/plugin.log`（启动器的 `[hindsight:daemon.start]` 行）；只 spawn 本机插件自带的 `daemon-start.js`，不访问外部服务。
- 整理日志：`~/.hindsight/profiles/<daemonProfile>.panel-operations.log`（本插件写的 JSONL：打开「整理」页时写入的自动跳过任务，以及用户操作审计），同目录也是「存储」页里的「整理操作日志」条目。
- 存储：`~/.hindsight/coding-agents-logs/`、`~/.pg0/instances/hindsight-embed-<daemonProfile>/`（C 盘目录联接会显示实际位置）。

## 隐私与免责

- **只读**：不新增、不改写、不删除任何记忆、页面或文档，也不改 `~/.hindsight` 下的配置；对记忆库唯一的写请求是「整理」页的重试 / 取消 / 删除终态任务记录。
- **数据不出本机**：读取全部直达本机 Hindsight API（默认 `http://127.0.0.1:9077`）与 `~/.hindsight` 下的文件，不访问任何外部服务，也没有使用统计上报。
- **唯一的模型调用**：页面卡片的中文摘要，会把当前页面的名称、标签和正文（截断到 14000 字符）发给当前 profile 的默认模型；不发送其他记忆、文档或会话内容。
- **本仓不含用户数据**：仓库里没有真实记忆内容、没有本机用户名 / 邮箱 / 主机名、没有绝对路径，也没有截图。README 里的 `~/.hindsight/...` 都是占位模板，`<daemonProfile>` 由本机配置决定。
- **本机日志**：`~/.hindsight/profiles/<daemonProfile>.panel-operations.log` 等文件只在本机生成，含任务 id、状态与错误原文，请按本机隐私要求自行保管。
- **安全边界**：面板假定 Hindsight API 只监听本机回环地址；若要暴露到网络，请自行加鉴权与访问控制。
- **风险自负**：「重试」会重新抽取同一份内容、可能重复写入事实；重要记忆库建议先备份再操作。

## 限制

- 不改记忆：不新增、不改写、不删除任何记忆、页面或文档；「整理」页只对异步任务队列做重试 / 取消 / 删除终态记录。生成中文摘要会把页面正文发给默认模型，除此之外不产生模型调用。
- 五张页面由插件在会话启动时按模板生成；新库在生成完成前显示「未生成」，同时显示这类页面的中文用途摘要。
- 页面正文按原文（Markdown）显示；中文摘要只是阅读辅助，不替代正文。
- 记忆按 bank 隔离：一个仓库一个库，worktree 共用主库；删除 bank 不可恢复。
- 不展示 daemon 的抽取模型、外发流量等运维信息，那些看 `plugin.log`。
- 「重试」会重新抽取同一份内容，可能重复写入事实；失败任务若之后已被同一目标的成功或进行中任务取代，「整理」页不会建议重试；无法确认是否被取代的失败任务只允许「删除记录」。
- 判定阈值是启发式的（处理中 15 分钟无心跳、待处理排队超过 1 小时）；「整理」页会显示最后心跳/排队时长，取消前请确认该任务确实不会再自己完成。

## English

A full page opened from the left sidebar ("Hindsight memory", registered the same way as 诊断画布: one id in `sidebar.panellist` and the layout's keyed `main` slot) for the `hindsight-coding-agents` plugin: bank and runtime status, the five fixed memory pages with their source questions, paged memory facts, session documents, the on-disk locations (config, logs, embedded PostgreSQL instance, and the operations log), and an **Operations** view for the async task queue. Each page card carries a Chinese summary generated by the profile's default model from the page body (cached per page version, with a retry action and a static purpose summary for pages that have not been generated yet); the original Markdown body stays available below it.

The Operations view lists only tasks that need a human decision — failed tasks with no later task on the same target (retry or delete the record), failed tasks whose completed-history window could not prove they were superseded (delete only), and tasks stuck in processing or queueing (cancel) — and can retry, cancel or delete those records in the local Hindsight service. Tasks that need no action (queued, deferred, running with a fresh heartbeat, or superseded by a later success) are appended as JSONL rows to `~/.hindsight/profiles/<daemonProfile>.panel-operations.log` when the view loads and are not shown; the same file is listed on the Storage tab. When nothing needs action the page reconciles the queue counts with the empty state ("the N queued or failed task(s) will finish on their own, or were already superseded"), so a pending count never sits beside a bare "nothing here". Memory stats and this view use the same de-duplicated operation counts (`exclude_parents=true`), so the overview and this page always agree; the raw `/stats` counters are used only when the operations endpoint is unavailable.

A **Self-check & start** action checks the config, API, database and daemon, and starts the daemon when it is down by spawning the installed `hindsight-coding-agents/dist/daemon-start.js` in offline mode (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, and a raised `HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT`) and polling for up to 15 minutes. Since 0.4.5 the panel also pulls the daemon up **by itself**: a restart of DSH (not the machine) takes the daemon down with it and the Hindsight plugin only starts one at the next session start, so whenever the overview loads with the API down the panel waits 6 seconds and then runs one self-check/start — following an already-running start instead of spawning a second launcher. While the API is down it probes every 5 seconds and refreshes automatically once the daemon comes up, and on failure it lists the tail of `plugin.log`, the daemon log and `panel-start.log` instead of only reporting a timeout.

Requires the `hindsight-coding-agents` plugin, a reachable Hindsight server (local daemon by default), and a model route (the profile's `agentDefaultModel`, or `provider`/`model` in this plugin's config). Set `HINDSIGHT_CONFIG` if the plugin config lives elsewhere. The summary, self-check and operations RPCs are part of the host half, so restart DSH or toggle the plugin once after updating it.

## License

MIT, see [LICENSE](LICENSE).
