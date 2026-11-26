import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, openSync, readdirSync } from 'node:fs'
import { appendFile, mkdir, open, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-hindsight-panel'
export const inject = ['connection']

const CHANNEL = '/hindsight-panel'
const MAX_BODY_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 15000
const PAGE_BODY_TIMEOUT_MS = 25000
const MAX_SCAN_ENTRIES = 4000
const SUMMARY_TIMEOUT_MS = 60000
const SUMMARY_MAX_BODY_CHARS = 14000
const SUMMARY_MAX_TOKENS = 700
const SUMMARY_CACHE_LIMIT = 80
const PROBE_TIMEOUT_MS = 3000
// 启动标记记录的是面板自己 spawn 的 daemon-start.js：只要这个进程还活着，启动就仍在进行
// （冷启动下载依赖可能要十几分钟）。标记不需要短 TTL——旧记录在进程退出后自然失效。
const DAEMON_START_MARKER_TTL_MS = 30 * 60 * 1000
// 一个 pid 文件只描述“最近一次启动”：daemon 的 uvx/嵌入进程会自己写这个文件，但它崩溃后
// 文件不会消失，Windows 还会复用 pid。超过这个时长且 API 仍不可达，就当作过期记录，
// 否则面板会一直以为“启动中”而不去重新拉起。
const DAEMON_PID_TRUST_MAX_MS = 30 * 60 * 1000
// 冷启动要下载 hindsight-api 的依赖（本机实测数百 MB），embed 默认只等 180 秒就判定失败，
// 于是每次启动都被杀在半路、缓存永远装不完。面板拉起时把等待上限抬到 30 分钟，
// 已经设置过的环境变量优先（用户可自行调小）。
const DAEMON_STARTUP_TIMEOUT_ENV = 'HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT'
const DAEMON_STARTUP_TIMEOUT_DEFAULT_SECONDS = '1800'
// pid 文件可能被 Windows 复用给任意进程；只有这些镜像才可能是守护进程链路。
const DAEMON_PROCESS_IMAGES = [
  'node.exe',
  'python.exe',
  'pythonw.exe',
  'uv.exe',
  'uvx.exe',
  'hindsight-api.exe',
  'hindsight-embed.exe',
]
const RECOVERY_LOG_TAIL_LINES = 40
const RECOVERY_LOG_TAIL_CHARS = 8000
const DAEMON_PROFILE_DEFAULT = 'coding-agent'
const OPERATIONS_FETCH_LIMIT = 100
const OPERATIONS_COMPLETED_MAX_PAGES = 5
const OPERATION_STUCK_PROCESSING_MS = 15 * 60 * 1000
const OPERATION_STUCK_PENDING_MS = 60 * 60 * 1000
const OPERATION_DEFERRED_AHEAD_MS = 60 * 1000
const OPERATIONS_LOG_MAX_KEYS = 4000
const SUMMARY_SYSTEM = [
  '你是中文技术摘要助手，读者是项目维护者。',
  '阅读给定的记忆页面，用简体中文概括它：主题是什么、涉及哪些主要模块/文件/对象、当前状态或关键结论是什么。',
  '只输出一个 JSON 对象，格式为 {"title":"...","summary":"..."}，不要代码块、不要 Markdown、不要额外说明。',
  'title 不超过 24 个字；summary 为 2 到 4 句、不超过 220 个字。',
].join('\n')

/** The five taxonomy pages the plugin seeds in every bank. */
export const TAXONOMY = [
  { name: 'Component map', label: '组件地图' },
  { name: 'Core concepts', label: '核心概念' },
  { name: 'Conventions and patterns', label: '约定与模式' },
  { name: 'Key decisions and rationale', label: '关键决策与理由' },
  { name: 'Initiatives and enhancements', label: '举措与增强' },
]

function expandHome(value) {
  if (typeof value !== 'string' || value === '') return value
  if (value === '~') return os.homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2))
  }
  return value
}

function configFileOf(config = {}) {
  const fromConfig = typeof config.configFile === 'string' ? expandHome(config.configFile) : ''
  const fromEnv = typeof process.env.HINDSIGHT_CONFIG === 'string' ? expandHome(process.env.HINDSIGHT_CONFIG) : ''
  if (fromConfig !== '') return fromConfig
  if (fromEnv !== '') return fromEnv
  return path.join(os.homedir(), '.hindsight', 'coding-agent.json')
}

async function statSafe(target) {
  try {
    return await stat(target)
  } catch {
    return null
  }
}

async function realpathSafe(target) {
  try {
    return await realpath(target)
  } catch {
    return ''
  }
}

async function readRawConfig(config) {
  const file = configFileOf(config)
  let values = {}
  let error = ''
  let exists = false
  try {
    const text = await readFile(file, 'utf8')
    exists = true
    const parsed = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) values = parsed
    else error = 'config is not a JSON object'
  } catch (cause) {
    if (cause && cause.code === 'ENOENT') {
      error = '配置文件不存在'
    } else {
      error = String((cause && (cause.message || cause.code)) || cause)
    }
  }
  return { path: file, exists, values, error }
}

function endpointOf(values) {
  const mode = typeof values.serverMode === 'string' && values.serverMode !== ''
    ? values.serverMode
    : 'cloud'
  const port = Number(values.apiPort) > 0 ? Number(values.apiPort) : 9077
  if (mode === 'daemon') {
    return { mode, url: 'http://127.0.0.1:' + port, port, token: typeof values.apiToken === 'string' ? values.apiToken : '' }
  }
  const raw = typeof values.apiUrl === 'string' && values.apiUrl !== ''
    ? values.apiUrl
    : 'https://api.hindsight.vectorize.io'
  return { mode, url: raw.replace(/\/+$/, ''), port, token: typeof values.apiToken === 'string' ? values.apiToken : '' }
}

function publicConfig(raw, endpoint) {
  return {
    path: raw.path,
    exists: raw.exists,
    error: raw.error,
    serverMode: endpoint.mode,
    apiUrl: endpoint.url,
    apiPort: endpoint.port,
    daemonProfile: typeof raw.values.daemonProfile === 'string' && raw.values.daemonProfile !== ''
      ? raw.values.daemonProfile
      : 'coding-agent',
    apiTokenConfigured: endpoint.token !== '',
    bankId: typeof raw.values.bankId === 'string' ? raw.values.bankId : '',
    bankIdTemplate: typeof raw.values.bankIdTemplate === 'string'
      ? raw.values.bankIdTemplate
      : 'coding-agent::{gitProject}',
    observeScopes: typeof raw.values.observationScopes === 'string' ? raw.values.observationScopes : '',
    disabled: raw.values.disabled === true,
  }
}

async function requestJson(endpoint, pathname, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs === undefined ? REQUEST_TIMEOUT_MS : options.timeoutMs)
  try {
    const headers = { accept: 'application/json' }
    if (endpoint.token !== '') headers.authorization = 'Bearer ' + endpoint.token
    const init = { method: options.method === undefined ? 'GET' : options.method, headers, signal: controller.signal }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }
    const response = await fetch(endpoint.url + pathname, init)
    const text = await response.text()
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + (text === '' ? '' : ' ' + text.slice(0, 240)))
    }
    if (text.trim() === '') return null
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(endpoint, pathname, timeoutMs = REQUEST_TIMEOUT_MS) {
  return requestJson(endpoint, pathname, { timeoutMs })
}

function bankPath(bank) {
  return '/v1/default/banks/' + encodeURIComponent(bank)
}

async function dirSize(dir) {
  const result = { bytes: 0, files: 0, truncated: false }
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (result.files >= MAX_SCAN_ENTRIES) {
        result.truncated = true
        return result
      }
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        const info = await statSafe(full)
        if (info !== null) {
          result.bytes += info.size
          result.files += 1
        }
      }
    }
  }
  return result
}

async function listDir(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const info = await statSafe(path.join(dir, entry.name))
      if (info === null) continue
      files.push({ name: entry.name, bytes: info.size, mtime: info.mtime.toISOString() })
    }
    files.sort((a, b) => a.name.localeCompare(b.name))
    return files
  } catch {
    return []
  }
}

async function collectStorage(raw, endpoint) {
  const entries = []
  const profile = typeof raw.values.daemonProfile === 'string' && raw.values.daemonProfile !== ''
    ? raw.values.daemonProfile
    : 'coding-agent'

  const configInfo = await statSafe(raw.path)
  entries.push({
    key: 'config',
    label: '插件配置',
    labelKey: 'storage.config',
    path: raw.path,
    exists: raw.exists,
    bytes: configInfo === null ? null : configInfo.size,
    mtime: configInfo === null ? null : configInfo.mtime.toISOString(),
    note: 'Hindsight 编码代理插件唯一的配置文件',
    noteKey: 'storage.config.note',
  })

  const logsDir = path.join(os.homedir(), '.hindsight', 'coding-agents-logs')
  const logFiles = await listDir(logsDir)
  entries.push({
    key: 'logs',
    label: '插件日志',
    labelKey: 'storage.logs',
    path: logsDir,
    exists: existsSync(logsDir),
    bytes: logFiles.reduce((sum, file) => sum + file.bytes, 0),
    files: logFiles,
    note: 'plugin.log / diag.jsonl / usage.jsonl',
    noteKey: 'storage.logs.note',
  })

  const panelLogPath = operationsLogPath(profile)
  const panelLogInfo = await statSafe(panelLogPath)
  entries.push({
    key: 'panelOperationsLog',
    label: '整理操作日志',
    labelKey: 'storage.panelLog',
    path: panelLogPath,
    exists: panelLogInfo !== null,
    bytes: panelLogInfo === null ? null : panelLogInfo.size,
    mtime: panelLogInfo === null ? null : panelLogInfo.mtime.toISOString(),
    note: '面板写入的异步任务 JSONL：无需处理项与用户操作审计',
    noteKey: 'storage.panelLog.note',
  })

  const dbPath = path.join(os.homedir(), '.pg0', 'instances', 'hindsight-embed-' + profile)
  const dbReal = await realpathSafe(dbPath)
  const size = existsSync(dbPath) ? await dirSize(dbPath) : { bytes: 0, files: 0, truncated: false }
  entries.push({
    key: 'database',
    label: '记忆数据库',
    labelKey: 'storage.database',
    path: dbPath,
    realPath: dbReal !== '' && dbReal !== dbPath ? dbReal : '',
    exists: existsSync(dbPath),
    bytes: size.bytes,
    files: size.files,
    truncated: size.truncated,
    note: '嵌入式 PostgreSQL（pg0，profile ' + profile + '）：所有 bank 的事实、观察、页面与文档都在这里',
    noteKey: 'storage.database.note',
    profile: profile,
  })

  const profileDir = typeof process.env.DSH_PROFILE_DIR === 'string' ? process.env.DSH_PROFILE_DIR : ''
  const packageDir = resolvePluginPackageDir(profileDir)
  if (packageDir !== '' && existsSync(packageDir)) {
    entries.push({
      key: 'package',
      label: '插件安装目录',
      labelKey: 'storage.package',
      path: packageDir,
      exists: true,
      note: 'profile "' + (process.env.DSH_PROFILE || 'desktop') + '" 安装的 hindsight-coding-agents 包（只有代码，不含记忆）',
      noteKey: 'storage.package.note',
      profileName: process.env.DSH_PROFILE || 'desktop',
    })
  }

  return {
    apiUrl: endpoint.url,
    mode: endpoint.mode,
    entries,
    notes: [
      '记忆按仓库分库（bank），例如 coding-agent::my-project；worktree 共用主库。',
      '删除某个 bank 会清空该仓库的全部页面、事实与文档，且不可恢复。',
    ],
    noteKeys: ['storage.note.banks', 'storage.note.delete'],
  }
}

export async function collectOverview(config = {}) {
  const raw = await readRawConfig(config)
  const endpoint = endpointOf(raw.values)
  const overview = {
    generatedAt: new Date().toISOString(),
    config: publicConfig(raw, endpoint),
    endpoint: { mode: endpoint.mode, url: endpoint.url },
    health: null,
    healthError: '',
    banks: [],
    banksError: '',
    storage: null,
  }

  try {
    overview.health = await fetchJson(endpoint, '/health', 5000)
  } catch (cause) {
    overview.healthError = String((cause && cause.message) || cause)
  }

  try {
    const listed = await fetchJson(endpoint, '/v1/default/banks?limit=100')
    const banks = listed !== null && Array.isArray(listed.banks) ? listed.banks : []
    overview.banks = banks.map((bank) => ({
      id: String(bank.bank_id || bank.name || ''),
      name: String(bank.name || bank.bank_id || ''),
      factCount: Number(bank.fact_count) || 0,
      documentCount: Number(bank.document_count) || null,
      createdAt: bank.created_at || null,
      lastWriteAt: bank.last_write_at || null,
      lastDocumentAt: bank.last_document_at || null,
    }))
  } catch (cause) {
    overview.banksError = String((cause && cause.message) || cause)
  }

  try {
    overview.storage = await collectStorage(raw, endpoint)
  } catch (cause) {
    overview.storage = {
      apiUrl: endpoint.url,
      mode: endpoint.mode,
      entries: [],
      notes: ['存储信息读取失败：' + String((cause && cause.message) || cause)],
    }
  }

  return overview
}

function daemonProfileOf(raw) {
  return typeof raw.values.daemonProfile === 'string' && raw.values.daemonProfile !== ''
    ? raw.values.daemonProfile
    : DAEMON_PROFILE_DEFAULT
}

function profileStatePath(profile, extension) {
  return path.join(os.homedir(), '.hindsight', 'profiles', profile + '.' + extension)
}

/** Windows 上查询 pid 对应的镜像名（如 "uvx.exe"）；查不到时返回空串。 */
function processImageName(pid) {
  if (process.platform !== 'win32') return ''
  try {
    const probe = spawnSync('tasklist', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    })
    if (probe.status !== 0 || typeof probe.stdout !== 'string') return ''
    const match = /^"([^"]+)"/.exec(probe.stdout.trim())
    return match === null ? '' : match[1].toLowerCase()
  } catch {
    return ''
  }
}

/**
 * pid 文件里记录的通常是 uvx/python 启动器，而不是 hindsight-api 本体，所以只按
 * “镜像看起来像不像守护进程链路”来判断；查不到镜像名时保持宽容（不因此拒绝启动）。
 */
function isDaemonProcessImage(image) {
  return image === '' || DAEMON_PROCESS_IMAGES.includes(image)
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Read `~/.hindsight/profiles/<profile>.pid` and describe how much to trust it:
 * the process may have exited, gone stuck, or (on Windows) had its pid reused by
 * an unrelated process. `trusted` means "this looks like a daemon still starting".
 */
async function readPidState(profile) {
  try {
    const file = profileStatePath(profile, 'pid')
    const text = await readFile(file, 'utf8')
    const info = await statSafe(file)
    const pid = Number(text.trim())
    if (!Number.isInteger(pid) || pid <= 0) return null
    const alive = pidAlive(pid)
    const image = alive ? processImageName(pid) : ''
    return {
      pid,
      alive,
      image,
      ageMs: info === null ? 0 : Math.max(0, Date.now() - info.mtimeMs),
      trusted: alive && isDaemonProcessImage(image),
    }
  } catch {
    return null
  }
}

async function readStartMarker(profile) {
  try {
    const parsed = JSON.parse(await readFile(profileStatePath(profile, 'panel-start.json'), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return null
    const pid = Number(parsed.pid)
    const startedAt = Date.parse(parsed.startedAt)
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(startedAt)) return null
    return { pid, startedAt, alive: pidAlive(pid) }
  } catch {
    return null
  }
}

/** Read the tail of a text file without loading a multi-megabyte log into memory. */
async function readLogTail(file, lineLimit = RECOVERY_LOG_TAIL_LINES, charLimit = RECOVERY_LOG_TAIL_CHARS) {
  let handle
  try {
    handle = await open(file, 'r')
    const info = await handle.stat()
    const size = Math.min(info.size, 256 * 1024)
    if (size <= 0) return ''
    const buffer = Buffer.alloc(size)
    await handle.read(buffer, 0, size, info.size - size)
    const lines = buffer.toString('utf8').split(/\r?\n/).filter((line) => line.trim() !== '')
    let tail = lines.slice(-lineLimit).join('\n')
    if (tail.length > charLimit) tail = tail.slice(tail.length - charLimit)
    return tail
  } catch {
    return ''
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close()
      } catch {
        // 关不掉句柄不影响读出的日志
      }
    }
  }
}


/** Node 的 fetch 只报 `fetch failed`，真正的原因（ECONNREFUSED / 超时）在 cause 链上。 */
function describeFetchError(cause) {
  const parts = []
  let current = cause
  for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth += 1) {
    const message = typeof current.message === 'string' ? current.message : ''
    if (message !== '' && !parts.includes(message)) parts.push(message)
    const code = typeof current.code === 'string' ? current.code : ''
    if (code !== '' && !parts.includes(code)) parts.push(code)
    current = current.cause
  }
  return parts.length === 0 ? '请求失败' : parts.join(' · ')
}

/** Probe `/health` only; used for the recovery button and the panel's auto-poll. */
export async function collectProbe(config = {}) {
  const raw = await readRawConfig(config)
  const endpoint = endpointOf(raw.values)
  const startedAt = Date.now()
  const base = {
    at: new Date().toISOString(),
    apiUrl: endpoint.url,
    mode: endpoint.mode,
    profile: daemonProfileOf(raw),
  }
  try {
    const health = await fetchJson(endpoint, '/health', PROBE_TIMEOUT_MS)
    return {
      ...base,
      reachable: true,
      status: health !== null && typeof health === 'object' && health.status ? String(health.status) : 'healthy',
      database: health !== null && typeof health === 'object' && health.database ? String(health.database) : '',
      error: '',
      latencyMs: Date.now() - startedAt,
    }
  } catch (cause) {
    return {
      ...base,
      reachable: false,
      status: '',
      database: '',
      error: describeFetchError(cause),
      latencyMs: Date.now() - startedAt,
    }
  }
}

function isPluginPackageDir(dir) {
  return dir !== '' && existsSync(path.join(dir, 'dist', 'daemon-start.js'))
}

// 在 profile 的 node_modules 里定位已安装的 Hindsight 插件包：不写死包名与作用域，
// 兼容 link（junction）、普通安装、以及带 @scope 的目录布局。
function resolvePluginPackageDir(profileDir) {
  if (profileDir === '') return ''
  const modulesDir = path.join(profileDir, 'node_modules')
  let entries = []
  try {
    entries = readdirSync(modulesDir, { withFileTypes: true })
  } catch {
    return ''
  }
  const candidates = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '.bin') continue
    const full = path.join(modulesDir, entry.name)
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (!entry.name.startsWith('@')) {
      candidates.push(full)
      continue
    }
    let scoped = []
    try {
      scoped = readdirSync(full, { withFileTypes: true })
    } catch {
      continue
    }
    for (const sub of scoped) {
      if (sub.isDirectory() || sub.isSymbolicLink()) candidates.push(path.join(full, sub.name))
    }
  }
  return candidates.find(isPluginPackageDir) || ''
}

function daemonStarterPath() {
  const profileDir = typeof process.env.DSH_PROFILE_DIR === 'string' && process.env.DSH_PROFILE_DIR !== ''
    ? process.env.DSH_PROFILE_DIR
    : path.join(os.homedir(), '.dsh', 'profiles', typeof process.env.DSH_PROFILE === 'string' ? process.env.DSH_PROFILE : 'desktop')
  const packageDir = resolvePluginPackageDir(profileDir)
  const candidate = packageDir === '' ? '' : path.join(packageDir, 'dist', 'daemon-start.js')
  return candidate !== '' && existsSync(candidate) ? candidate : ''
}

function nodeCommand() {
  const probe = spawnSync('node', ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 3000 })
  if (probe.status === 0) return { command: 'node', env: {} }
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } }
}

/**
 * Spawn the installed plugin's `dist/daemon-start.js`, detached, in offline mode.
 *
 * The embed CLI only gives a cold start 180 s (`HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT`).
 * A first start can have to download the whole `hindsight-api` environment (hundreds of
 * MB, minutes on a slow link), so that default killed the attempt halfway through the
 * download — leaving the uv cache half-filled, so the next attempt downloaded everything
 * again. Raising the limit is what breaks that loop; an explicit user setting still wins.
 */
async function startDetachedDaemon(raw, config = {}) {
  const starter = daemonStarterPath()
  if (starter === '') {
    throw new Error('找不到已安装 Hindsight 插件里的 daemon-start.js，请确认插件安装完整')
  }
  const profile = daemonProfileOf(raw)
  const logPath = profileStatePath(profile, 'panel-start.log')
  const binary = nodeCommand()
  const startupTimeoutSeconds = typeof process.env[DAEMON_STARTUP_TIMEOUT_ENV] === 'string'
    && process.env[DAEMON_STARTUP_TIMEOUT_ENV] !== ''
    ? process.env[DAEMON_STARTUP_TIMEOUT_ENV]
    : DAEMON_STARTUP_TIMEOUT_DEFAULT_SECONDS
  const extraEnv = {}
  if (startupTimeoutSeconds !== process.env[DAEMON_STARTUP_TIMEOUT_ENV]) {
    extraEnv[DAEMON_STARTUP_TIMEOUT_ENV] = startupTimeoutSeconds
  }
  // 需要时可用 config.uvIndex 指定 PyPI 镜像（国内直连 PyPI，首次安装可能要十几分钟）。
  // 注意 uv 的 tool 环境按解析设置缓存：中途切镜像会让缓存重建一次，同一台机器上应固定一种方式。
  if (typeof config.uvIndex === 'string' && config.uvIndex !== '') {
    extraEnv.UV_DEFAULT_INDEX = config.uvIndex
    extraEnv.UV_INDEX_URL = config.uvIndex
  }
  const fd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(binary.command, [starter, '--harness', 'dsh'], {
      detached: true,
      stdio: ['ignore', fd, fd],
      windowsHide: true,
      env: {
        ...process.env,
        ...binary.env,
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
        HINDSIGHT_CONFIG: raw.path,
        ...extraEnv,
      },
    })
  } finally {
    closeSync(fd)
  }
  const spawned = await new Promise((resolve) => {
    let settled = false
    child.once('spawn', () => {
      if (settled) return
      settled = true
      resolve(true)
    })
    child.once('error', () => {
      if (settled) return
      settled = true
      resolve(false)
    })
  })
  if (!spawned) throw new Error('无法启动守护进程：node 或 daemon-start.js 启动失败')
  child.on('error', () => {})
  child.unref()
  await writeFile(
    profileStatePath(profile, 'panel-start.json'),
    JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }),
    'utf8',
  ).catch(() => {})
  // spawn 成功不代表启动器能跑下去：node 缺失、权限不足或 uvx 不在 PATH 时进程会立刻退出。
  // 旧实现把这种失败也算成“启动中”，界面只能干等到超时（而拉起日志里其实写了原因）。
  await new Promise((resolve) => setTimeout(resolve, 800))
  if (child.exitCode !== null && child.exitCode !== 0) {
    const tail = await readLogTail(logPath, 20, 3000)
    throw new Error(
      '守护进程启动器立即退出（exit ' + child.exitCode + '）'
        + (tail === '' ? '，详见 ' + logPath : '：\n' + tail),
    )
  }
  return { pid: child.pid, logPath, starter, command: binary.command, startupTimeoutSeconds }
}

/** TCP 层探测：端口有没有人监听。用来区分“没启动”和“启动了但 /health 不健康”。 */
function probePort(port) {
  if (!Number.isInteger(port) || port <= 0) return Promise.resolve(false)
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(1500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function formatWait(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return seconds + ' 秒'
  return Math.floor(seconds / 60) + ' 分 ' + (seconds % 60) + ' 秒'
}

/** 记忆数据库端口被孤儿守护进程占着时，拉起是没用的——必须先把旧进程停掉。 */
function occupiedPortHint(port) {
  return 'API 端口 127.0.0.1:' + port + ' 正在监听，但 /health 不健康。'
    + '常见于只重启 DSH 之后：API 进程还活着，它启动的嵌入式数据库已经被带走。'
    + '请先停掉占用端口的进程，再点一次「自检并拉起」：'
    + '\nPowerShell: $p=(Get-NetTCPConnection -LocalPort ' + port + ' -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }'
}

/**
 * Check the Hindsight config, API, database and daemon, and optionally start
 * the daemon when it is down. Starting is idempotent: a recent start marker or
 * a live, trusted profile pid means "already starting".
 */
export async function collectSelfCheck(config = {}, payload = {}) {
  const raw = await readRawConfig(config)
  const endpoint = endpointOf(raw.values)
  const profile = daemonProfileOf(raw)
  const probe = await collectProbe(config)
  const dbPath = path.join(os.homedir(), '.pg0', 'instances', 'hindsight-embed-' + profile)
  const pid = await readPidState(profile)
  const marker = await readStartMarker(profile)
  const now = Date.now()
  const markerFresh = marker !== null && marker.alive && (now - marker.startedAt) < DAEMON_START_MARKER_TTL_MS
  // pid 文件指向“像守护进程链路、且没有老到离谱”的进程才算启动中；否则（进程已退出、
  // pid 被 Windows 复用给别的程序、或卡了半小时以上）都应当允许重新拉起。
  const pidTrusted = pid !== null && pid.trusted && pid.ageMs < DAEMON_PID_TRUST_MAX_MS
  const pidStale = pid !== null && pid.alive && !pid.trusted
  const starting = !probe.reachable && (markerFresh || pidTrusted)
  const portListening = probe.reachable ? true : await probePort(endpoint.mode === 'daemon' ? endpoint.port : 0)
  let daemonDetail
  if (probe.reachable) {
    daemonDetail = '运行中'
  } else if (starting) {
    daemonDetail = '启动中' + (pidTrusted ? ' · pid ' + pid.pid + '（已等待 ' + formatWait(pid.ageMs) + '）' : '')
  } else if (portListening) {
    daemonDetail = '端口 ' + endpoint.port + ' 已监听，但 API 不健康（可能是数据库断开的孤儿守护进程）'
  } else if (pid === null) {
    daemonDetail = '未运行'
  } else if (!pid.alive) {
    daemonDetail = '未运行 · pid ' + pid.pid + '（已退出）'
  } else if (pidStale) {
    daemonDetail = '未运行 · pid ' + pid.pid + ' 指向无关进程（' + pid.image + '），已忽略'
  } else {
    daemonDetail = '未运行 · pid ' + pid.pid + '（' + formatWait(pid.ageMs) + '未就绪，按已卡住处理）'
  }
  const checks = [
    {
      key: 'config',
      label: '配置文件',
      ok: raw.exists,
      detail: raw.path + (raw.error === '' ? '' : ' · ' + raw.error),
    },
    {
      key: 'api',
      label: 'Hindsight API',
      ok: probe.reachable,
      detail: endpoint.url + (probe.reachable
        ? ' · ' + probe.status + (probe.database === '' ? '' : ' · db ' + probe.database)
        : ' · ' + probe.error),
    },
    {
      key: 'database',
      label: '记忆数据库',
      ok: existsSync(dbPath),
      detail: dbPath,
    },
    {
      key: 'daemon',
      label: '守护进程',
      ok: probe.reachable || starting,
      detail: daemonDetail,
    },
  ]

  let start = null
  let error = ''
  if (payload.start === true) {
    if (probe.reachable) {
      start = { started: false, starting: false, alreadyRunning: true }
    } else if (starting) {
      start = { started: false, starting: true, alreadyStarting: true }
    } else if (portListening) {
      // 拉起只会再起一个和现有监听者抢端口的进程，先把原因说清楚。
      start = { started: false, starting: false, blocked: 'api-unhealthy' }
      error = occupiedPortHint(endpoint.port)
    } else {
      try {
        start = { started: true, starting: true, ...(await startDetachedDaemon(raw, config)) }
      } catch (cause) {
        error = String((cause && cause.message) || cause)
        start = { started: false, starting: false, error }
      }
    }
  }

  const logs = []
  if (!probe.reachable) {
    // daemon-start.js 自己把「Starting / Waiting for daemon / ✗ …」写进插件的 plugin.log，
    // 而不是写进它被 spawn 时的 stdout，所以只看 panel-start.log 永远是空的。
    const pluginLogPath = path.join(os.homedir(), '.hindsight', 'coding-agents-logs', 'plugin.log')
    const pluginLines = (await readLogTail(pluginLogPath, 600, 64000))
      .split('\n')
      .filter((line) => line.includes('[hindsight:daemon.start]')
        || line.includes('[hindsight:profile.create]')
        || line.includes('[hindsight] '))
      .slice(-30)
    logs.push({ key: 'plugin', path: pluginLogPath, tail: pluginLines.join('\n') })
    const startLogPath = profileStatePath(profile, 'panel-start.log')
    const profileLogPath = profileStatePath(profile, 'log')
    logs.push({ key: 'profile', path: profileLogPath, tail: await readLogTail(profileLogPath) })
    // panel-start.log 只收启动器的 stdout/stderr（node 崩溃时才非空），但排查时值得带上。
    const startTail = await readLogTail(startLogPath, 15, 3000)
    if (startTail !== '') logs.push({ key: 'panelStart', path: startLogPath, tail: startTail })
  }

  return {
    at: new Date().toISOString(),
    profile,
    healthy: probe.reachable,
    starting: start !== null && start.starting === true ? true : starting,
    checks,
    probe,
    daemon: {
      pid: pid === null ? null : pid.pid,
      pidAlive: pid !== null && pid.alive,
      pidImage: pid === null ? '' : pid.image,
      pidTrusted,
      pidStale,
      waitedMs: pidTrusted ? pid.ageMs : 0,
      markerFresh,
      portListening,
    },
    logs,
    start,
    error,
  }
}

async function resolveEndpoint(config) {
  const raw = await readRawConfig(config)
  const endpoint = endpointOf(raw.values)
  return { raw, endpoint }
}

function requireBank(payload) {
  const bank = payload !== null && typeof payload === 'object' && typeof payload.bank === 'string'
    ? payload.bank.trim()
    : ''
  if (bank === '') throw new Error('缺少 bank 参数')
  return bank
}

/**
 * Deduplicated operation counts, from the same `exclude_parents` listing the
 * 整理 view uses. /stats counts batch parent and child rows separately, so its
 * failed_operations can be double the number of failed logical tasks; the
 * overview and the 整理 view must show one number. Null when the operations
 * endpoint is unavailable (older Hindsight), so the caller falls back.
 */
async function collectOperationCounts(endpoint, bank) {
  try {
    const [failed, pending, processing] = await Promise.all([
      listOperations(endpoint, bank, 'failed'),
      listOperations(endpoint, bank, 'pending'),
      listOperations(endpoint, bank, 'processing'),
    ])
    return { failed: failed.total, pending: pending.total, processing: processing.total }
  } catch {
    return null
  }
}

export async function collectStats(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const { endpoint } = await resolveEndpoint(config)
  const stats = await fetchJson(endpoint, bankPath(bank) + '/stats')
  const operationCounts = await collectOperationCounts(endpoint, bank)
  return {
    bank,
    totalNodes: Number(stats.total_nodes) || 0,
    totalObservations: Number(stats.total_observations) || 0,
    totalDocuments: Number(stats.total_documents) || 0,
    totalLinks: Number(stats.total_links) || 0,
    totalEntities: Number(stats.total_entities) || null,
    factTypes: stats.nodes_by_fact_type || {},
    lastWriteAt: stats.last_memory_write_at || null,
    lastConsolidatedAt: stats.last_consolidated_at || null,
    pendingOperations: operationCounts === null
      ? Number(stats.pending_operations) || 0
      : operationCounts.pending,
    failedOperations: operationCounts === null
      ? Number(stats.failed_operations) || 0
      : operationCounts.failed,
    processingOperations: operationCounts === null ? null : operationCounts.processing,
    operationCountSource: operationCounts === null ? 'stats' : 'operations',
  }
}

/**
 * Every operation the panel has already written to the skip log, so a poll or a
 * page refresh does not append the same row again. Bounded: the oldest key is
 * dropped once the cap is reached.
 */
const loggedOperationKeys = new Map()

function operationsLogPath(profile) {
  return path.join(os.homedir(), '.hindsight', 'profiles', profile + '.panel-operations.log')
}

function rememberLoggedOperation(key) {
  loggedOperationKeys.set(key, Date.now())
  if (loggedOperationKeys.size <= OPERATIONS_LOG_MAX_KEYS) return
  const oldest = loggedOperationKeys.keys().next()
  if (oldest.done !== true) loggedOperationKeys.delete(oldest.value)
}

async function appendOperationLog(file, entries) {
  if (entries.length === 0) return 0
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8')
  return entries.length
}

function operationTime(value) {
  if (value === null || value === undefined || value === '') return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function normalizeOperation(item) {
  const source = item !== null && typeof item === 'object' ? item : {}
  const progress = source.progress !== null && typeof source.progress === 'object' ? source.progress : null
  const details = source.details !== null && typeof source.details === 'object' ? source.details : null
  return {
    id: String(source.id || source.operation_id || ''),
    taskType: String(source.task_type || source.operation_type || 'unknown'),
    status: String(source.status || ''),
    itemsCount: Number(source.items_count) || 0,
    documentId: source.document_id ? String(source.document_id) : null,
    filename: source.filename ? String(source.filename) : null,
    mentalModelId: source.mental_model_id ? String(source.mental_model_id) : null,
    createdAt: source.created_at || null,
    updatedAt: source.updated_at || null,
    completedAt: source.completed_at || null,
    nextRetryAt: source.next_retry_at || null,
    retryCount: Number(source.retry_count) || 0,
    errorMessage: typeof source.error_message === 'string' ? source.error_message.slice(0, 2000) : '',
    progress: progress === null
      ? null
      : {
          stage: String(progress.stage || ''),
          at: progress.at || null,
          processed: Number.isFinite(Number(progress.processed)) ? Number(progress.processed) : null,
          total: Number.isFinite(Number(progress.total)) ? Number(progress.total) : null,
        },
    details: details === null
      ? null
      : {
          outcome: String(details.outcome || ''),
          failureReason: details.failure_reason ? String(details.failure_reason) : '',
        },
  }
}

function operationTargetKey(operation) {
  if (operation.documentId !== null) return 'doc:' + operation.documentId
  if (operation.mentalModelId !== null) return 'mm:' + operation.mentalModelId
  return ''
}

function latestSuccessByTarget(operations) {
  const latest = new Map()
  for (const operation of operations) {
    if (operation.status === 'failed' || operation.status === 'cancelled') continue
    const key = operationTargetKey(operation)
    if (key === '') continue
    const created = operationTime(operation.createdAt)
    if (created === null) continue
    const known = latest.get(key)
    if (known === undefined || created > known) latest.set(key, created)
  }
  return latest
}

function classifyOperation(operation, now, latestByTarget, completedWindowStart) {
  if (operation.status === 'failed') {
    const key = operationTargetKey(operation)
    const created = operationTime(operation.createdAt)
    const later = key === '' ? undefined : latestByTarget.get(key)
    // A later successful (or still-running) operation on the same document or
    // page already redid this work; retrying the old row would duplicate facts.
    if (created !== null && later !== undefined && later > created) {
      return { needsUser: false, reason: 'superseded', actions: [] }
    }
    // The completed-history window did not reach back to this failure, so a
    // later success may exist outside what was checked. Retrying could then
    // duplicate facts, so only deletion of the stale record is offered.
    if (created !== null && completedWindowStart !== null && created < completedWindowStart) {
      return { needsUser: true, reason: 'unverified', actions: ['delete'] }
    }
    return { needsUser: true, reason: 'failed', actions: ['retry', 'delete'] }
  }
  if (operation.status === 'processing') {
    const lastBeat = (operation.progress === null ? null : operationTime(operation.progress.at)) ??
      operationTime(operation.updatedAt) ?? operationTime(operation.createdAt)
    if (lastBeat !== null && now - lastBeat > OPERATION_STUCK_PROCESSING_MS) {
      return { needsUser: true, reason: 'stuck-processing', actions: ['cancel'] }
    }
    return { needsUser: false, reason: 'processing', actions: [] }
  }
  const nextRetry = operationTime(operation.nextRetryAt)
  if (nextRetry !== null && nextRetry > now + OPERATION_DEFERRED_AHEAD_MS) {
    return { needsUser: false, reason: 'deferred', actions: [] }
  }
  const createdAt = operationTime(operation.createdAt)
  if (createdAt !== null && now - createdAt > OPERATION_STUCK_PENDING_MS) {
    return { needsUser: true, reason: 'stuck-pending', actions: ['cancel'] }
  }
  return { needsUser: false, reason: 'queued', actions: [] }
}

/**
 * Split the async operation queue into the rows that need a human decision and
 * the rows the worker will finish on its own. Pure apart from `now`, so the
 * classification can be tested without the live service. `completedWindowStart`
 * is the oldest completed row that was actually inspected, or null when the
 * whole completed history was available.
 */
export function triageOperations(operations, now = Date.now(), options = {}) {
  const completedWindowStart = options.completedWindowStart === undefined ? null : options.completedWindowStart
  const latestByTarget = latestSuccessByTarget(operations)
  const actionable = []
  const auto = []
  for (const operation of operations) {
    if (operation.status !== 'failed' && operation.status !== 'processing' && operation.status !== 'pending') continue
    const verdict = classifyOperation(operation, now, latestByTarget, completedWindowStart)
    if (verdict.needsUser) {
      actionable.push({ ...operation, reason: verdict.reason, actions: verdict.actions })
    } else {
      auto.push({ operation: operation, reason: verdict.reason })
    }
  }
  actionable.sort((left, right) => (operationTime(right.createdAt) ?? 0) - (operationTime(left.createdAt) ?? 0))
  return { actionable, auto }
}

async function listOperations(endpoint, bank, status, offset = 0) {
  const query = new URLSearchParams({
    status,
    limit: String(OPERATIONS_FETCH_LIMIT),
    offset: String(offset),
    exclude_parents: 'true',
  })
  const body = await fetchJson(endpoint, bankPath(bank) + '/operations?' + query.toString())
  const items = body !== null && Array.isArray(body.operations) ? body.operations : []
  return {
    items: items.map(normalizeOperation),
    total: body !== null && Number.isFinite(Number(body.total)) ? Number(body.total) : items.length,
  }
}

function oldestCreatedAtIn(operations) {
  let oldest = null
  for (const operation of operations) {
    const created = operationTime(operation.createdAt)
    if (created === null) continue
    if (oldest === null || created < oldest) oldest = created
  }
  return oldest
}

/**
 * List the bank's async operations and keep only the ones that need the user.
 * Operations the worker handles by itself are appended to the panel operations
 * log (one JSONL row per operation, deduplicated per process) and are not
 * returned as rows, so the panel never shows queue noise.
 */
export async function collectOperations(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const { raw, endpoint } = await resolveEndpoint(config)
  const profile = daemonProfileOf(raw)
  const logPath = operationsLogPath(profile)
  let lists
  try {
    lists = await Promise.all([
      listOperations(endpoint, bank, 'failed'),
      listOperations(endpoint, bank, 'pending'),
      listOperations(endpoint, bank, 'processing'),
    ])
  } catch (cause) {
    const message = String((cause && cause.message) || cause)
    if (message.includes('HTTP 404')) {
      return {
        bank,
        supported: false,
        fetchedAt: new Date().toISOString(),
        counts: { failed: 0, pending: 0, processing: 0 },
        actionable: [],
        auto: { count: 0, byReason: {} },
        log: { path: logPath, written: 0, error: '' },
        truncated: false,
        error: '',
      }
    }
    throw cause
  }
  const failed = lists[0]
  const pending = lists[1]
  const processing = lists[2]
  // Completed history is only needed to tell whether a failed row was already
  // redone by a later success, so a clean queue costs three requests. Page it
  // until it reaches the oldest failure (bounded) so a busy bank's 100-row page
  // does not hide the success that superseded an older failure.
  const completed = { items: [], total: 0 }
  let completedWindowStart = null
  if (failed.items.length > 0) {
    const oldestFailed = oldestCreatedAtIn(failed.items)
    let offset = 0
    let reached = oldestFailed === null
    for (let page = 0; page < OPERATIONS_COMPLETED_MAX_PAGES; page += 1) {
      const batch = await listOperations(endpoint, bank, 'completed', offset)
      completed.total = batch.total
      completed.items.push(...batch.items)
      if (batch.items.length < OPERATIONS_FETCH_LIMIT) {
        reached = true
        break
      }
      const oldestInBatch = oldestCreatedAtIn(batch.items)
      if (oldestInBatch !== null && (oldestFailed === null || oldestInBatch <= oldestFailed)) {
        reached = true
        break
      }
      offset += batch.items.length
      if (offset >= batch.total) {
        reached = true
        break
      }
    }
    if (!reached) {
      // Everything fetched is later than the uninspected history, so a failure
      // older than the window might still have a later success we cannot see.
      completedWindowStart = oldestCreatedAtIn(completed.items) ?? Date.now()
    }
  }
  const now = Date.now()
  const triage = triageOperations(
    completed.items.concat(failed.items, pending.items, processing.items),
    now,
    { completedWindowStart },
  )
  const autoByReason = {}
  const logEntries = []
  for (const entry of triage.auto) {
    autoByReason[entry.reason] = (autoByReason[entry.reason] || 0) + 1
    const operation = entry.operation
    const key = [bank, operation.id, operation.status, String(operation.updatedAt || '')].join('|')
    if (loggedOperationKeys.has(key)) continue
    rememberLoggedOperation(key)
    logEntries.push({
      at: new Date(now).toISOString(),
      event: 'skip',
      bank: bank,
      operationId: operation.id,
      taskType: operation.taskType,
      status: operation.status,
      reason: entry.reason,
      documentId: operation.documentId,
      mentalModelId: operation.mentalModelId,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
      error: operation.errorMessage.slice(0, 240),
    })
  }
  const log = { path: logPath, written: 0, error: '' }
  try {
    log.written = await appendOperationLog(logPath, logEntries)
  } catch (cause) {
    log.error = String((cause && cause.message) || cause)
  }
  return {
    bank,
    supported: true,
    fetchedAt: new Date(now).toISOString(),
    counts: { failed: failed.total, pending: pending.total, processing: processing.total },
    actionable: triage.actionable,
    auto: { count: triage.auto.length, byReason: autoByReason },
    log,
    truncated: failed.total > failed.items.length ||
      pending.total > pending.items.length ||
      processing.total > processing.items.length,
    error: '',
  }
}

/**
 * Retry, cancel or delete one async operation. This is the only write path on
 * the Hindsight service, and it never touches memory content: retry re-queues,
 * cancel stops a queued/running task, delete removes a terminal record.
 */
export async function runOperationAction(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const operationId = typeof payload.operationId === 'string' ? payload.operationId.trim() : ''
  if (operationId === '') throw new Error('缺少 operationId 参数')
  const action = payload.action
  if (action !== 'retry' && action !== 'delete' && action !== 'cancel') {
    throw new Error('action 必须是 retry / delete / cancel')
  }
  const { raw, endpoint } = await resolveEndpoint(config)
  const base = bankPath(bank) + '/operations/' + encodeURIComponent(operationId)
  const response = action === 'retry'
    ? await requestJson(endpoint, base + '/retry', { method: 'POST', body: {} })
    : (action === 'cancel'
        ? await requestJson(endpoint, base, { method: 'DELETE' })
        : await requestJson(endpoint, base + '/delete', { method: 'DELETE' }))
  const result = {
    bank,
    operationId,
    action,
    success: response === null || typeof response !== 'object' || response.success !== false,
    message: response !== null && typeof response === 'object' && typeof response.message === 'string'
      ? response.message
      : '',
    at: new Date().toISOString(),
  }
  try {
    // Record what the task was before the record disappears, so deleting a
    // failed operation still leaves its evidence in the audit log.
    let current = null
    try {
      const detail = await requestJson(endpoint, base, { timeoutMs: 5000 })
      if (detail !== null && typeof detail === 'object') current = normalizeOperation(detail)
    } catch {
      // a missing pre-read must not block the action or its audit row
    }
    await appendOperationLog(operationsLogPath(daemonProfileOf(raw)), [{
      at: result.at,
      event: 'action',
      bank,
      operationId,
      action,
      success: result.success,
      message: result.message.slice(0, 240),
      taskType: current === null ? null : current.taskType,
      status: current === null ? null : current.status,
      documentId: current === null ? null : current.documentId,
      mentalModelId: current === null ? null : current.mentalModelId,
      error: current === null ? '' : current.errorMessage.slice(0, 240),
    }])
  } catch {
    // the operation already changed; a failed audit row must not hide that
  }
  return result
}

function cleanPageBody(text) {
  if (typeof text !== 'string' || text === '') return ''
  let body = text.replace(/^\uFEFF/, '')
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(body)
  if (frontmatter !== null) body = body.slice(frontmatter[0].length)
  body = body.replace(/^\s*_?No content yet\.?_?\s*$/im, '')
  return body.trim()
}

function collectPageNodes(nodes, folder, output) {
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue
    if (typeof node.id !== 'string' || node.id === '') continue
    if (node.kind === 'page') {
      output.push({
        id: node.id,
        name: typeof node.name === 'string' ? node.name : node.id,
        description: typeof node.description === 'string' ? node.description : '',
        tags: Array.isArray(node.tags) ? node.tags : [],
        updatedAt: node.updated_at || node.timestamp || null,
        stale: node.is_stale === true || node.stale === true,
        refreshFailedAt: node.last_refresh_failed_at || null,
        folder: folder,
        trigger: node.trigger && typeof node.trigger === 'object' ? String(node.trigger.type || '') : '',
      })
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      collectPageNodes(node.children, node.kind === 'folder' ? String(node.name || '') : folder, output)
    }
  }
}

export async function collectPages(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const { endpoint } = await resolveEndpoint(config)
  let tree
  try {
    tree = await fetchJson(endpoint, bankPath(bank) + '/pages/tree')
  } catch (cause) {
    const message = String((cause && cause.message) || cause)
    if (message.includes('HTTP 404')) {
      return { bank, supported: false, pages: [], taxonomy: [], custom: [], error: '当前 Hindsight 版本不支持 pages 接口' }
    }
    throw cause
  }
  const flat = []
  collectPageNodes(tree !== null && Array.isArray(tree.roots) ? tree.roots : [], '', flat)

  const light = payload.light === true
  const pages = light
    ? flat.map((page) => ({ ...page, body: '', error: '' }))
    : await Promise.all(flat.map(async (page) => {
        try {
          const full = await fetchJson(
            endpoint,
            bankPath(bank) + '/pages/' + encodeURIComponent(page.id),
            PAGE_BODY_TIMEOUT_MS,
          )
          const source = full !== null && typeof full === 'object' ? full : {}
          return {
            ...page,
            body: cleanPageBody(source.body),
            description: typeof source.description === 'string' && source.description !== '' ? source.description : page.description,
            tags: Array.isArray(source.tags) && source.tags.length > 0 ? source.tags : page.tags,
            updatedAt: source.timestamp || page.updatedAt,
            stale: source.is_stale === true || page.stale,
            refreshFailedAt: source.last_refresh_failed_at || page.refreshFailedAt,
            error: '',
          }
        } catch (cause) {
          return { ...page, body: '', error: String((cause && cause.message) || cause) }
        }
      }))

  const byName = new Map()
  for (const page of pages) {
    const key = page.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, page)
  }
  const taxonomy = TAXONOMY.map((item) => {
    const page = byName.get(item.name.toLowerCase())
    return {
      name: item.name,
      label: item.label,
      pageId: page === undefined ? null : page.id,
      updatedAt: page === undefined ? null : page.updatedAt,
      stale: page === undefined ? false : page.stale === true,
      refreshFailedAt: page === undefined ? null : page.refreshFailedAt,
    }
  })
  const taxonomyIds = new Set(taxonomy.map((item) => item.pageId).filter((id) => id !== null))
  return {
    bank,
    supported: true,
    light,
    pages,
    taxonomy,
    custom: pages.filter((page) => !taxonomyIds.has(page.id)),
    error: '',
  }
}

function shortDigest(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function serviceOf(services, name) {
  const service = services === null || services === undefined ? undefined : services[name]
  return service === undefined || service === null ? undefined : service
}

function defaultModelOf(services, config) {
  const configuredProvider = typeof config.provider === 'string' ? config.provider.trim() : ''
  const configuredModel = typeof config.model === 'string' ? config.model.trim() : ''
  if (configuredProvider !== '' && configuredModel !== '') {
    return { provider: configuredProvider, model: configuredModel }
  }
  const service = serviceOf(services, 'agentDefaultModel')
  if (service !== undefined && typeof service.currentSelection === 'function') {
    const selection = service.currentSelection()
    if (selection !== null && typeof selection === 'object' &&
      typeof selection.provider === 'string' && selection.provider !== '' &&
      typeof selection.model === 'string' && selection.model !== '') {
      return { provider: selection.provider, model: selection.model }
    }
  }
  return null
}

function summaryPrompt(name, tags, body) {
  const tagLine = Array.isArray(tags) && tags.length > 0 ? '页面标签：' + tags.join(', ') + '\n' : ''
  return '页面名称：' + (name === '' ? '未命名页面' : name) + '\n' +
    tagLine +
    '请阅读下面的页面正文，按系统要求输出 JSON。\n\n页面正文：\n' +
    body.slice(0, SUMMARY_MAX_BODY_CHARS)
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
}

function parseSummaryPayload(text) {
  let raw = cleanText(text)
  if (raw === '') return { title: '', summary: '' }
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (parsed !== null && typeof parsed === 'object') {
        const title = cleanText(parsed.title).replace(/^(?:中文)?标题[：:]\s*/, '')
        const summary = cleanText(parsed.summary).replace(/^(?:中文)?摘要[：:]\s*/, '')
        if (summary !== '') return { title: title, summary: summary }
      }
    } catch {
      // fall through to the plain-text summary below
    }
  }
  return { title: '', summary: raw }
}

async function streamModelText(llm, route, prompt, signal) {
  let text = ''
  let failure = null
  const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
  for await (const chunk of llm.stream({
    provider: route.provider,
    model: route.model,
    system: SUMMARY_SYSTEM,
    messages: messages,
    maxTokens: SUMMARY_MAX_TOKENS,
    temperature: 0.2,
    signal: signal,
  })) {
    if (chunk === null || typeof chunk !== 'object') continue
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      text += chunk.text
    } else if (chunk.type === 'finish' && chunk.reason !== null && typeof chunk.reason === 'object' &&
      (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
      failure = chunk.reason.failure
    }
  }
  if (failure !== null && failure !== undefined) {
    const code = typeof failure.code === 'string' && failure.code !== '' ? failure.code : 'LLM_FAILED'
    const message = typeof failure.message === 'string' && failure.message !== '' ? failure.message : '模型请求失败'
    throw new Error(code + ': ' + message)
  }
  return text
}

/**
 * Summarize one page body into Simplified Chinese through the installation's
 * default model. Results are cached by bank, page, update time and body digest,
 * so a panel reload does not spend another model call.
 */
export async function summarizePage(services, config = {}, payload = {}, cache = new Map(), pending = new Map()) {
  const bank = typeof payload.bank === 'string' ? payload.bank.trim() : ''
  const pageId = typeof payload.pageId === 'string' ? payload.pageId.trim() : ''
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : ''
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  const tags = Array.isArray(payload.tags) ? payload.tags : []
  if (body === '') {
    return { pageId, title: '', summary: '', model: '', cached: false, empty: true }
  }
  const key = [bank, pageId === '' ? name : pageId, updatedAt, shortDigest(body)].join('|')
  const cached = cache.get(key)
  if (cached !== undefined) return { ...cached, cached: true }
  const running = pending.get(key)
  if (running !== undefined) return running

  const task = (async () => {
    const llm = serviceOf(services, 'llm')
    if (llm === undefined || typeof llm.stream !== 'function') {
      throw new Error('当前 DSH 没有可用的模型服务，无法生成中文摘要')
    }
    const route = defaultModelOf(services, config)
    if (route === null) throw new Error('未找到默认模型；请在插件配置里设置 provider 与 model')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS)
    try {
      const text = await streamModelText(llm, route, summaryPrompt(name, tags, body), controller.signal)
      const parsed = parseSummaryPayload(text)
      if (parsed.summary === '') throw new Error('模型没有返回摘要内容')
      const value = {
        pageId: pageId,
        title: parsed.title,
        summary: parsed.summary,
        model: route.provider + ' / ' + route.model,
        cached: false,
        empty: false,
      }
      cache.set(key, value)
      while (cache.size > SUMMARY_CACHE_LIMIT) {
        const oldest = cache.keys().next()
        if (oldest.done === true) break
        cache.delete(oldest.value)
      }
      return value
    } finally {
      clearTimeout(timer)
    }
  })()
  pending.set(key, task)
  try {
    return await task
  } finally {
    pending.delete(key)
  }
}

export async function collectMemories(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const { endpoint } = await resolveEndpoint(config)
  const limit = Math.min(Math.max(Number(payload.limit) || 40, 1), 200)
  const offset = Math.max(Number(payload.offset) || 0, 0)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (typeof payload.type === 'string' && payload.type !== '') params.set('type', payload.type)
  if (typeof payload.query === 'string' && payload.query.trim() !== '') params.set('q', payload.query.trim())
  const body = await fetchJson(endpoint, bankPath(bank) + '/memories/list?' + params.toString())
  const items = body !== null && Array.isArray(body.items) ? body.items : []
  return {
    bank,
    total: body !== null && Number.isFinite(Number(body.total)) ? Number(body.total) : items.length,
    offset,
    limit,
    items: items.map((item) => ({
      id: String(item.id || ''),
      text: String(item.text || ''),
      factType: String(item.fact_type || ''),
      date: item.date || item.mentioned_at || null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      state: String(item.state || ''),
      proofCount: Number(item.proof_count) || null,
      documentId: item.document_id || null,
    })),
  }
}

export async function collectDocuments(config = {}, payload = {}) {
  const bank = requireBank(payload)
  const { endpoint } = await resolveEndpoint(config)
  const limit = Math.min(Math.max(Number(payload.limit) || 20, 1), 100)
  const offset = Math.max(Number(payload.offset) || 0, 0)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const body = await fetchJson(endpoint, bankPath(bank) + '/documents?' + params.toString())
  const items = body !== null && Array.isArray(body.items) ? body.items : []
  return {
    bank,
    total: body !== null && Number.isFinite(Number(body.total)) ? Number(body.total) : items.length,
    offset,
    limit,
    items: items.map((item) => {
      const metadata = item.document_metadata !== null && typeof item.document_metadata === 'object'
        ? item.document_metadata
        : {}
      return {
        id: String(item.id || ''),
        createdAt: item.created_at || null,
        updatedAt: item.updated_at || null,
        textLength: Number(item.text_length) || 0,
        memoryUnitCount: Number(item.memory_unit_count) || 0,
        tags: Array.isArray(item.tags) ? item.tags : [],
        source: metadata.source || '',
        harness: metadata.harness || '',
        sessionId: metadata.session_id || '',
      }
    }),
  }
}

export function apply(ctx, config = {}) {
  const summaryCache = new Map()
  const summaryPending = new Map()
  const summaryServices = { llm: null, agentDefaultModel: null }
  ctx.inject(['llm'], (injected) => { summaryServices.llm = injected.llm })
  ctx.inject(['agentDefaultModel'], (injected) => { summaryServices.agentDefaultModel = injected.agentDefaultModel })
  const handlers = new Map([
    ['overview', async () => collectOverview(config)],
    ['probe', async () => collectProbe(config)],
    ['selfCheck', async (payload) => collectSelfCheck(config, payload)],
    ['stats', async (payload) => collectStats(config, payload)],
    ['operations', async (payload) => collectOperations(config, payload)],
    ['operationAction', async (payload) => runOperationAction(config, payload)],
    ['pages', async (payload) => collectPages(config, payload)],
    ['summarize', async (payload) => summarizePage(summaryServices, config, payload, summaryCache, summaryPending)],
    ['memories', async (payload) => collectMemories(config, payload)],
    ['documents', async (payload) => collectDocuments(config, payload)],
  ])

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST')
          res.writeHead(405)
          res.end()
          return
        }
        const rejection = webCtx.get('connection')?.requestRejection?.(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
          return
        }
        const chunks = []
        let received = 0
        for await (const chunk of req) {
          received += chunk.length
          if (received > MAX_BODY_BYTES) {
            res.writeHead(413)
            res.end('payload too large')
            return
          }
          chunks.push(chunk)
        }
        let body
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          res.writeHead(400)
          res.end('body is not JSON')
          return
        }
        const rawPath = new URL(req.url === undefined ? '/' : req.url, 'http://localhost').pathname
        const pathEndpoint = rawPath.startsWith(CHANNEL + '/')
          ? rawPath.slice(CHANNEL.length + 1)
          : ''
        const endpoint = pathEndpoint !== ''
          ? pathEndpoint
          : (typeof body.method === 'string' ? body.method : '')
        const fn = handlers.get(endpoint)
        let result
        if (fn === undefined) {
          result = { ok: false, error: { code: 'not-found', message: '未知的 RPC 端点: ' + endpoint, details: {} } }
        } else {
          try {
            const payload = body.payload === undefined || body.payload === null ? {} : body.payload
            result = { ok: true, value: await fn(payload) }
          } catch (cause) {
            result = { ok: false, error: { code: 'internal', message: String((cause && cause.message) || cause), details: {} } }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          type: 'server-response',
          rpcId: body === undefined ? undefined : body.rpcId,
          result,
        }))
      },
    }), 'dsh-hindsight-panel: ' + CHANNEL + ' rpc route')
  })
}
