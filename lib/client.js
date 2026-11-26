window.__ModuleLoader__.load({
  id: 'dsh-hindsight-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const CHANNEL = '/hindsight-panel'
    const NS = 'hindsight-panel'
    // How long the recovery card keeps polling a start that is under way. A first
    // daemon start downloads the hindsight-api environment (minutes on a slow link).
    const RECOVERY_WAIT_MS = 15 * 60 * 1000
    const RECOVERY_POLL_MS = 3000
    // Opening the panel with the daemon down pulls it up by itself, after this delay
    // (and only when no other start is under way).
    const AUTO_RECOVERY_DELAY_MS = 6000
    let rpcCall = null

    const ZH = {
      title: 'Hindsight 记忆',
      subtitle: '只读观测插件记录的记忆、页面与存放位置',
      refresh: '刷新',
      refreshing: '刷新中…',
      tabsOverview: '概览',
      tabsPages: '页面',
      tabsMemories: '记忆',
      tabsDocuments: '文档',
      tabsStorage: '存储',
      loading: '读取中…',
      loadFailed: '读取失败：',
      empty: '暂无数据。',
      bankNone: '未发现记忆库',
      status: '运行形态',
      mode: '模式',
      api: 'API 地址',
      health: '健康状态',
      healthOk: '健康',
      healthBad: '不可用',
      configPath: '配置文件',
      bankTemplate: '库命名模板',
      disabled: '插件禁用',
      yes: '是',
      no: '否',
      stats: '记忆统计',
      totalNodes: '事实节点',
      observations: '观察',
      documents: '文档',
      links: '关联',
      factTypes: '事实类型',
      lastWrite: '最近写入',
      lastConsolidated: '最近整理',
      overviewPages: '五张固定页面',
      pagesGenerated: '已生成',
      pagesMissing: '未生成',
      openPages: '查看页面',
      storageSummary: '存放位置',
      database: '记忆数据库',
      storageHint: '完整的路径、大小与日志文件在「存储」页',
      pagesTitle: '记忆页面',
      pagesIntro: '插件在每个记忆库里生成五张固定页面，内容由该库的提交历史与会话记忆综合而成。',
      pageSource: '生成问句',
      pageUpdated: '更新于',
      pageEmpty: '该库还没有页面。插件在会话启动时按五类模板生成；生成后这里会显示正文。',
      customPages: '自定义 / 举措页面',
      customPagesIntro: '举措页面由 hindsight_capture_initiative 创建；自定义页面来自记忆库配置。每张页面记录一项工作的目标、范围与当前状态。',
      summaryTitle: '中文摘要',
      summaryLoading: '正在生成中文摘要…',
      summaryFailed: '中文摘要生成失败：',
      summaryRetry: '重试',
      summaryEmpty: '页面还没有正文；生成并刷新后这里会显示中文摘要。',
      summaryUnsupported: '摘要接口要重启 DSH 后才可用。',
      summaryModel: '由默认模型生成，仅供参考',
      pagePurposeComponent: '记录本项目的目录、模块与关键文件各自负责什么。',
      pagePurposeConcept: '记录项目里的关键术语、领域概念与实体，以及它们的确切含义。',
      pagePurposeConvention: '记录这个项目在测试、错误处理、命名与改动方式上的做法。',
      pagePurposeDecision: '记录做过的关键技术决策，以及当时这样选的理由。',
      pagePurposeInitiative: '记录项目推进过的举措、功能与增强，以及它们之间的联系。',
      pagePurposeCustom: '记录一项举措或自定义页面的目标、范围、涉及的对象与当前状态。',
      recover: '自检并拉起',
      recovering: '自检中…',
      starting: '启动中…',
      recoveryTitle: '记忆库自检',
      recoveryChecking: '正在检查配置、API 与数据库…',
      recoveryStarting: '守护进程正在启动，通常需要 20–60 秒；面板会自动刷新。',
      recoveryStartingFirst: '守护进程还在启动。首次启动要下载 hindsight-api 依赖时可能需要几分钟，面板会继续等待，请不要关闭页签。',
      recoveryWaiting: '已等待 ',
      recoveryReady: '记忆库已恢复。',
      recoveryTimeout: '等待超时。守护进程可能仍在启动；下面是最新的守护进程日志，稍后刷新页面即可看到最新状态。',
      recoveryFailedShort: '失败',
      recoveryReadyShort: '已恢复',
      recoveryDismiss: '关闭',
      recoveryConfig: '配置文件',
      recoveryApi: 'Hindsight API',
      recoveryDatabase: '记忆数据库',
      recoveryDaemon: '守护进程',
      recoveryLogsTitle: '最近的守护进程日志',
      recoveryLogsEmpty: '（日志为空：守护进程可能还没有输出）',
      pageUnsupported: '当前 Hindsight 服务不支持 pages 接口。',
      allTypes: '全部类型',
      typeObservation: '观察 observation',
      typeWorld: '世界 world',
      typeExperience: '经验 experience',
      searchPlaceholder: '搜索记忆内容…',
      search: '搜索',
      clear: '清空',
      shown: '显示',
      of: '/ 共',
      loadMore: '加载更多',
      memoryEmpty: '没有匹配的记忆。',
      documentsIntro: '每次会话结束时，插件把会话记录回写成文档，再从中抽取事实与观察。',
      docCreated: '写入于',
      docChars: '字符',
      docUnits: '记忆单元',
      documentsEmpty: '还没有回写的会话文档。',
      storageIntro: 'Hindsight 只在本地保存：配置、日志与嵌入式 PostgreSQL 数据目录。',
      exists: '存在',
      missing: '缺失',
      size: '大小',
      filesCount: '文件数',
      realPath: '实际位置',
      logFiles: '日志文件',
      storageNotes: '说明',
      copy: '复制路径',
      copied: '已复制',
      scopeNote: '记忆按 bank 隔离：一个仓库一个库，worktree 共用主库。',
      generatedAt: '生成于',
      facts: '条事实',
      pageComponent: '组件地图',
      pageConcept: '核心概念',
      pageConvention: '约定与模式',
      pageDecision: '关键决策与理由',
      pageInitiative: '举措与增强',
      justNow: '刚刚',
      minutesAgo: '分钟前',
      hoursAgo: '小时前',
      daysAgo: '天前',
      operations: '整理操作',
      pending: '待处理',
      failed: '失败',
      tabsOperations: '整理',
      openOperations: '查看整理操作',
      operationsIntro: '整理操作是 Hindsight 的异步任务队列：会话回写、记忆整理与页面刷新都会先排队再执行。这里只列出需要你处理的任务；无需你处理的任务只写入日志，不在面板显示。',
      operationsUnsupported: '整理操作接口要重启 DSH 后才可用。',
      operationsEmpty: '没有需要你处理的项。',
      operationsEmptyQueueLead: '队列中的 ',
      operationsEmptyQueueTail: ' 项任务会自动完成，或已被后续任务取代。',
      operationsEmptyIdle: '当前没有排队、处理中或失败的整理任务。',
      operationsNeedUser: '需要你处理',
      operationsQueue: '队列',
      operationsAutoTitle: '无需处理 · 仅记入日志',
      operationsAutoLead: '无需你处理的任务不在此列出，只记入日志；共 ',
      operationsAutoTail: ' 项。',
      operationsAutoNone: '本次没有无需处理的任务。',
      operationsLogPath: '日志文件',
      operationsLogWritten: '本次新写入 ',
      operationsLogWrittenTail: ' 条',
      operationsLogNote: '打开本页时写入；已记录过的不重复写。',
      operationsReload: '重新读取',
      operationsFetchedAt: '读取于',
      operationsRawCounts: '「记忆统计」和「整理」页使用同一份去重后的任务计数（批量任务的主/子记录只算一次）。',
      operationsDaemonHint: '队列长时间未推进时，先点顶部「自检并拉起」检查守护进程。',
      operationsTruncated: '每个状态只检查最近 100 条，更早的任务未检查。',
      operationsId: '任务号',
      operationsItems: '条数据',
      operationsRetries: '重试 ',
      operationsRetriesTail: ' 次',
      operationsNextRetry: '下次重试',
      operationsProgress: '进度',
      operationsLastHeartbeat: '最后心跳',
      operationsQueuedFor: '已排队',
      operationsDocument: '文档',
      operationsMentalModel: '页面',
      operationsUnverifiedHint: '无法确认之后是否已有同一目标的成功任务（更早的完成记录未纳入检查）；重试可能重复写入，因此只提供「删除记录」。',
      actionRetryHint: '重试会重新抽取同一份内容，可能重复写入事实；「删除记录」只移除这条任务记录，不影响已写入的记忆。',
      actionCancelHint: '取消后该任务不会再执行，也不会自动重试。',
      reasonFailed: '执行失败',
      reasonSuperseded: '后续已有同一目标的任务',
      reasonUnverified: '无法确认是否已被取代',
      reasonStuckProcessing: '长时间无进展',
      reasonStuckPending: '排队过久',
      reasonProcessing: '处理中',
      reasonQueued: '排队中',
      reasonDeferred: '等待重试',
      reasonOther: '其他',
      statusFailed: '失败',
      statusPending: '待处理',
      statusProcessing: '处理中',
      statusCancelled: '已取消',
      taskRetain: '会话回写',
      taskBatchRetain: '批量回写',
      taskConsolidation: '记忆整理',
      taskRefresh: '页面刷新',
      taskFileConvert: '文件回写',
      taskWebhook: 'Webhook 投递',
      taskGraphMaintenance: '图谱维护',
      actionRetry: '重试',
      actionDelete: '删除记录',
      actionCancel: '取消任务',
      actionConfirmDelete: '确认删除',
      actionConfirmCancel: '确认取消',
      actionDismiss: '放弃',
      actionRetrying: '重试中…',
      actionDeleting: '删除中…',
      actionCancelling: '取消中…',
      actionRetried: '已重新排队',
      actionDeleted: '记录已删除',
      actionCancelled: '任务已取消',
      actionError: '操作失败：',
      healthUnknown: '未探测',
      configMissing: '配置文件不存在或不可读，以下为默认值',
      pageEmptyHint: '页面由服务端按模板综合生成；长时间为空时查看「存储」页的插件日志。',
      pageRefreshFailed: '上次刷新失败',
      rawMarkdown: '原文（Markdown）',
      copyFailed: '复制失败',
      modified: '修改于',
      scanTruncated: '目录过大，大小按前 4000 个文件估算',
      'storage.config': '插件配置',
      'storage.config.note': 'Hindsight 编码代理插件唯一的配置文件',
      'storage.logs': '插件日志',
      'storage.logs.note': 'plugin.log / diag.jsonl / usage.jsonl',
      'storage.panelLog': '整理操作日志',
      'storage.panelLog.note': '面板写入的异步任务 JSONL：无需处理项与用户操作审计',
      'storage.database': '记忆数据库',
      'storage.database.note': '嵌入式 PostgreSQL（pg0）：所有 bank 的事实、观察、页面与文档都在这里',
      'storage.package': '插件安装目录',
      'storage.package.note': 'profile 安装的 hindsight-coding-agents 包（只有代码，不含记忆）',
      'storage.note.banks': '记忆按仓库分库（bank），例如 coding-agent::my-project；worktree 共用主库。',
      'storage.note.delete': '删除某个 bank 会清空该仓库的全部页面、事实与文档，且不可恢复。',
    }

    const EN = {
      title: 'Hindsight memory',
      subtitle: 'Read-only view of what the plugin remembered, and where it lives',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      tabsOverview: 'Overview',
      tabsPages: 'Pages',
      tabsMemories: 'Memories',
      tabsDocuments: 'Documents',
      tabsStorage: 'Storage',
      loading: 'Loading…',
      loadFailed: 'Load failed: ',
      empty: 'No data.',
      bankNone: 'No bank found',
      status: 'Runtime',
      mode: 'Mode',
      api: 'API',
      health: 'Health',
      healthOk: 'healthy',
      healthBad: 'unavailable',
      configPath: 'Config file',
      bankTemplate: 'Bank template',
      disabled: 'Plugin disabled',
      yes: 'yes',
      no: 'no',
      stats: 'Memory stats',
      totalNodes: 'Fact nodes',
      observations: 'Observations',
      documents: 'Documents',
      links: 'Links',
      factTypes: 'Fact types',
      lastWrite: 'Last write',
      lastConsolidated: 'Last consolidated',
      overviewPages: 'Fixed pages',
      pagesGenerated: 'present',
      pagesMissing: 'missing',
      openPages: 'Open pages',
      storageSummary: 'On disk',
      database: 'Memory database',
      storageHint: 'Full paths, sizes and log files are on the Storage tab',
      pagesTitle: 'Memory pages',
      pagesIntro: 'The plugin seeds five fixed pages per bank from the bank history and past conversations.',
      pageSource: 'Source question',
      pageUpdated: 'Updated',
      pageEmpty: 'This bank has no pages yet. The plugin seeds them at session start; their bodies appear here once synthesized.',
      customPages: 'Custom / initiative pages',
      customPagesIntro: 'Initiative pages are created by hindsight_capture_initiative; custom pages come from the bank configuration. Each one records a goal, its scope and its current state.',
      summaryTitle: 'Chinese summary',
      summaryLoading: 'Generating a Chinese summary…',
      summaryFailed: 'Summary failed: ',
      summaryRetry: 'Retry',
      summaryEmpty: 'This page has no body yet; a Chinese summary appears once it is generated.',
      summaryUnsupported: 'Restart DSH to enable the summary endpoint.',
      summaryModel: 'Generated by the default model; may be imperfect',
      pagePurposeComponent: 'What this project\'s directories, modules and key files are each responsible for.',
      pagePurposeConcept: 'The project\'s key terms, domain concepts and entities, and what each one means.',
      pagePurposeConvention: 'How this project tests, handles errors, names things and makes changes.',
      pagePurposeDecision: 'The significant technical decisions and the reasons behind them.',
      pagePurposeInitiative: 'The initiatives, features and enhancements the project has worked on, and how they connect.',
      pagePurposeCustom: 'The goal, scope, subjects and current state of one initiative or custom page.',
      recover: 'Self-check & start',
      recovering: 'Checking…',
      starting: 'Starting…',
      recoveryTitle: 'Memory bank self-check',
      recoveryChecking: 'Checking the config, API and database…',
      recoveryStarting: 'The daemon is starting; this usually takes 20–60 seconds and the panel refreshes automatically.',
      recoveryStartingFirst: 'The daemon is still starting. A first start may download the hindsight-api environment (minutes on a slow link); the panel keeps waiting, so keep this tab open.',
      recoveryWaiting: 'waited ',
      recoveryReady: 'The memory bank is available again.',
      recoveryTimeout: 'Timed out. The daemon may still be starting; its latest log lines are below and a refresh will pick up the new state.',
      recoveryFailedShort: 'failed',
      recoveryReadyShort: 'recovered',
      recoveryDismiss: 'Dismiss',
      recoveryConfig: 'Config file',
      recoveryApi: 'Hindsight API',
      recoveryDatabase: 'Memory database',
      recoveryDaemon: 'Daemon',
      recoveryLogsTitle: 'Latest daemon log lines',
      recoveryLogsEmpty: '(no output yet — the daemon may not have written anything)',
      pageUnsupported: 'This Hindsight server does not support the pages API.',
      allTypes: 'All types',
      typeObservation: 'observation',
      typeWorld: 'world',
      typeExperience: 'experience',
      searchPlaceholder: 'Search memory text…',
      search: 'Search',
      clear: 'Clear',
      shown: 'showing',
      of: 'of',
      loadMore: 'Load more',
      memoryEmpty: 'No matching memories.',
      documentsIntro: 'At session end the plugin writes the transcript back as a document, then extracts facts and observations.',
      docCreated: 'Written',
      docChars: 'chars',
      docUnits: 'memory units',
      documentsEmpty: 'No session documents yet.',
      storageIntro: 'Hindsight stores everything locally: config, logs, and the embedded PostgreSQL data directory.',
      exists: 'present',
      missing: 'missing',
      size: 'Size',
      filesCount: 'Files',
      realPath: 'Resolves to',
      logFiles: 'Log files',
      storageNotes: 'Notes',
      copy: 'Copy path',
      copied: 'Copied',
      scopeNote: 'Memory is isolated per bank: one per repository, shared by its worktrees.',
      generatedAt: 'Generated',
      facts: 'facts',
      pageComponent: 'Component map',
      pageConcept: 'Core concepts',
      pageConvention: 'Conventions',
      pageDecision: 'Key decisions',
      pageInitiative: 'Initiatives',
      justNow: 'just now',
      minutesAgo: 'min ago',
      hoursAgo: 'h ago',
      daysAgo: 'd ago',
      operations: 'Operations',
      pending: 'pending',
      failed: 'failed',
      tabsOperations: 'Operations',
      openOperations: 'Open operations',
      operationsIntro: 'Operations are Hindsight\'s async queue: session write-back, consolidation and page refresh run in the background. Only tasks that need you are listed here; tasks that need no action are written to the log and are not shown.',
      operationsUnsupported: 'Restart DSH to enable the operations endpoint.',
      operationsEmpty: 'Nothing needs your action.',
      operationsEmptyQueueLead: 'The ',
      operationsEmptyQueueTail: ' queued or failed task(s) will finish on their own, or were already superseded.',
      operationsEmptyIdle: 'No queued, running or failed operations right now.',
      operationsNeedUser: 'Needs your action',
      operationsQueue: 'Queue',
      operationsAutoTitle: 'No action needed · logged only',
      operationsAutoLead: 'Tasks that need no action are logged, not listed here; ',
      operationsAutoTail: ' in total.',
      operationsAutoNone: 'No auto-handled tasks this time.',
      operationsLogPath: 'Log file',
      operationsLogWritten: 'Appended ',
      operationsLogWrittenTail: ' rows',
      operationsLogNote: 'Written when this page loads; already-recorded tasks are not appended again.',
      operationsReload: 'Reload',
      operationsFetchedAt: 'Fetched',
      operationsRawCounts: 'Memory stats and this page use the same de-duplicated task counts (batch parent/child rows are counted once).',
      operationsDaemonHint: 'If the queue stops moving, use Self-check & start above to check the daemon.',
      operationsTruncated: 'Only the newest 100 tasks per status are inspected; older ones are not checked.',
      operationsId: 'Task',
      operationsItems: 'items',
      operationsRetries: 'retried ',
      operationsRetriesTail: 'x',
      operationsNextRetry: 'Next retry',
      operationsProgress: 'Progress',
      operationsLastHeartbeat: 'Last heartbeat',
      operationsQueuedFor: 'Queued for',
      operationsDocument: 'Document',
      operationsMentalModel: 'Page',
      operationsUnverifiedHint: 'Cannot confirm whether a later success already covered this target (older completed rows were not inspected); retrying could duplicate facts, so only "delete record" is offered.',
      actionRetryHint: 'Retry re-extracts the same content and may duplicate facts; "delete record" only removes this task row and leaves written memory intact.',
      actionCancelHint: 'After cancelling, this task will not run again automatically.',
      reasonFailed: 'failed',
      reasonSuperseded: 'a later task exists for the same target',
      reasonUnverified: 'cannot confirm it was superseded',
      reasonStuckProcessing: 'no progress for long',
      reasonStuckPending: 'queued too long',
      reasonProcessing: 'in progress',
      reasonQueued: 'queued',
      reasonDeferred: 'waiting to retry',
      reasonOther: 'other',
      statusFailed: 'failed',
      statusPending: 'pending',
      statusProcessing: 'processing',
      statusCancelled: 'cancelled',
      taskRetain: 'Session write-back',
      taskBatchRetain: 'Batch write-back',
      taskConsolidation: 'Consolidation',
      taskRefresh: 'Page refresh',
      taskFileConvert: 'File write-back',
      taskWebhook: 'Webhook delivery',
      taskGraphMaintenance: 'Graph maintenance',
      actionRetry: 'Retry',
      actionDelete: 'Delete record',
      actionCancel: 'Cancel task',
      actionConfirmDelete: 'Confirm delete',
      actionConfirmCancel: 'Confirm cancel',
      actionDismiss: 'Dismiss',
      actionRetrying: 'Retrying…',
      actionDeleting: 'Deleting…',
      actionCancelling: 'Cancelling…',
      actionRetried: 'Re-queued',
      actionDeleted: 'Record deleted',
      actionCancelled: 'Task cancelled',
      actionError: 'Action failed: ',
      healthUnknown: 'unchecked',
      configMissing: 'Config file is missing or unreadable; defaults shown below',
      pageEmptyHint: 'Pages are synthesized by the server from the templates; if this stays empty, check the plugin log on the Storage tab.',
      pageRefreshFailed: 'last refresh failed',
      rawMarkdown: 'Raw markdown',
      copyFailed: 'Copy failed',
      modified: 'Modified',
      scanTruncated: 'Directory too large; size estimated from the first 4000 files',
      'storage.config': 'Plugin config',
      'storage.config.note': 'The single config file of the Hindsight coding-agent plugin',
      'storage.logs': 'Plugin logs',
      'storage.logs.note': 'plugin.log / diag.jsonl / usage.jsonl',
      'storage.panelLog': 'Operations log',
      'storage.panelLog.note': 'JSONL written by the panel: skipped tasks and user-action audit rows',
      'storage.database': 'Memory database',
      'storage.database.note': 'Embedded PostgreSQL (pg0): every bank fact, observation, page and document lives here',
      'storage.package': 'Plugin install directory',
      'storage.package.note': 'Installed hindsight-coding-agents package for the profile (code only, no memory)',
      'storage.note.banks': 'Memory is isolated per repository bank (e.g. coding-agent::my-project); worktrees share the main bank.',
      'storage.note.delete': 'Deleting a bank clears every page, fact and document of that repository, irreversibly.',
    }

    const TAXONOMY = [
      { name: 'Component map', key: 'pageComponent', purposeKey: 'pagePurposeComponent' },
      { name: 'Core concepts', key: 'pageConcept', purposeKey: 'pagePurposeConcept' },
      { name: 'Conventions and patterns', key: 'pageConvention', purposeKey: 'pagePurposeConvention' },
      { name: 'Key decisions and rationale', key: 'pageDecision', purposeKey: 'pagePurposeDecision' },
      { name: 'Initiatives and enhancements', key: 'pageInitiative', purposeKey: 'pagePurposeInitiative' },
    ]

    const TASK_LABEL_KEYS = {
      retain: 'taskRetain',
      batch_retain: 'taskBatchRetain',
      consolidation: 'taskConsolidation',
      refresh_mental_model: 'taskRefresh',
      file_convert_retain: 'taskFileConvert',
      webhook_delivery: 'taskWebhook',
      graph_maintenance: 'taskGraphMaintenance',
    }
    const STATUS_LABEL_KEYS = {
      failed: 'statusFailed',
      pending: 'statusPending',
      processing: 'statusProcessing',
      cancelled: 'statusCancelled',
    }
    const REASON_LABEL_KEYS = {
      failed: 'reasonFailed',
      superseded: 'reasonSuperseded',
      unverified: 'reasonUnverified',
      'stuck-processing': 'reasonStuckProcessing',
      'stuck-pending': 'reasonStuckPending',
      processing: 'reasonProcessing',
      queued: 'reasonQueued',
      deferred: 'reasonDeferred',
    }

    function taskLabelOf(type, t) {
      const key = TASK_LABEL_KEYS[type]
      return key === undefined ? String(type) : t(key)
    }

    function statusLabelOf(status, t) {
      const key = STATUS_LABEL_KEYS[status]
      return key === undefined ? String(status) : t(key)
    }

    function reasonLabelOf(reason, t) {
      const key = REASON_LABEL_KEYS[reason]
      return key === undefined ? t('reasonOther') : t(key)
    }

    const CSS = [
      '.hsp-root{height:100%;overflow:auto;padding:20px 22px 32px;box-sizing:border-box;',
      'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);',
      'font-size:13px;line-height:1.55}',
      '.hsp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}',
      '.hsp-title{font-size:18px;font-weight:600;margin:0}',
      '.hsp-sub{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:3px;overflow-wrap:anywhere}',
      '.hsp-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.hsp-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px}',
      '.hsp-btn:hover{border-color:var(--dsw-alias-brand-primary)}',
      '.hsp-btn:disabled{opacity:.55;cursor:default}',
      '.hsp-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 8px;font-size:12px;max-width:320px}',
      '.hsp-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:16px}',
      '.hsp-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;',
      'padding:7px 12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '.hsp-tab:hover{color:var(--dsw-alias-label-primary)}',
      '.hsp-tab-on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.hsp-tiles{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}',
      '.hsp-tile{flex:1 1 140px;min-width:140px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:8px;background:var(--dsw-alias-bg-layer-1)}',
      '.hsp-tile-k{font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.hsp-tile-v{font-size:18px;font-weight:600;margin-top:2px}',
      '.hsp-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);',
      'padding:12px 14px;margin-bottom:12px}',
      '.hsp-card-h{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.hsp-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;overflow-wrap:anywhere}',
      '.hsp-badge{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);',
      'border:1px solid var(--dsw-alias-border-l2);border-radius:99px;padding:1px 8px}',
      '.hsp-badge-on{color:var(--dsw-alias-brand-primary)}',
      '.hsp-badge-off{color:var(--dsw-alias-label-secondary)}',
      '.hsp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}',
      '.hsp-field{display:flex;gap:10px;font-size:12px;margin-top:5px;flex-wrap:wrap}',
      '.hsp-field-k{color:var(--dsw-alias-label-secondary);min-width:86px}',
      '.hsp-field-v{overflow-wrap:anywhere;flex:1 1 220px}',
      '.hsp-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;',
      'color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.hsp-empty{font-size:12px;color:var(--dsw-alias-label-secondary);margin:8px 0}',
      '.hsp-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin:8px 0;overflow-wrap:anywhere}',
      '.hsp-list{margin:8px 0 0;padding:0;list-style:none}',
      '.hsp-item{border-top:1px solid var(--dsw-alias-border-l1);padding:8px 0;font-size:12px}',
      '.hsp-item:first-child{border-top:0}',
      '.hsp-item-text{overflow-wrap:anywhere;white-space:pre-wrap}',
      '.hsp-item-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px;overflow-wrap:anywhere}',
      '.hsp-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}',
      '.hsp-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;',
      'border-top:1px solid var(--dsw-alias-border-l1);margin-top:10px;padding-top:10px;max-height:520px;overflow:auto}',
      '.hsp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
      '.hsp-pagecard{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;',
      'background:var(--dsw-alias-bg-layer-1)}',
      '.hsp-pagecard-h{font-size:13px;font-weight:600}',
      '.hsp-pagecard-sub{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px;overflow-wrap:anywhere}',
      '.hsp-summary{margin-top:8px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;',
      'background:var(--dsw-alias-bg-base)}',
      '.hsp-summary-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;',
      'color:var(--dsw-alias-label-secondary);margin-bottom:4px}',
      '.hsp-summary-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:3px}',
      '.hsp-summary-text{font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap}',
      '.hsp-summary-note{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px}',
      '.hsp-summary-actions{margin-top:6px}',
      '.hsp-recover{margin:0 0 12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
      'background:var(--dsw-alias-bg-layer-1)}',
      '.hsp-recover-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:600}',
      '.hsp-recover-h .hsp-link{margin-left:auto;font-weight:400}',
      '.hsp-recover-ready{border-color:var(--dsw-alias-state-success-primary)}',
      '.hsp-recover-failed{border-color:var(--dsw-alias-state-error-primary)}',
      '.hsp-recover .hsp-list{margin-top:6px}',
      '.hsp-recover-msg{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.hsp-log{margin-top:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;',
      'background:var(--dsw-alias-bg-base);padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;',
      'font-size:11px;line-height:1.45;max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;',
      'color:var(--dsw-alias-label-secondary)}',
      '.hsp-log-h{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;font-size:11px;font-weight:600;',
      'color:var(--dsw-alias-label-secondary);margin-bottom:4px}',
      '.hsp-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}',
      '.hsp-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 10px;font-size:12px;min-width:200px;flex:1 1 220px}',
      '.hsp-chip{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:99px;padding:0 7px;margin-left:6px}',
      '.hsp-foot{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:14px}',
      '.hsp-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;background:var(--dsw-alias-state-error-primary)}',
      '.hsp-dot-on{background:var(--dsw-alias-state-success-primary)}',
      '.hsp-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:12px;cursor:pointer;padding:0}',
      '.hsp-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.hsp-btn-danger:hover{border-color:var(--dsw-alias-state-error-primary)}',
      '.hsp-notice{font-size:12px;margin:8px 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);',
      'border-radius:6px;overflow-wrap:anywhere}',
      '.hsp-notice-ok{border-color:var(--dsw-alias-state-success-primary)}',
      '.hsp-notice-error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.hsp-op{padding:10px 0}',
      '.hsp-op + .hsp-op{border-top:1px solid var(--dsw-alias-border-l1)}',
      '.hsp-op-h{font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.hsp-op-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end}',
      '.hsp-op-err{font-size:11px;color:var(--dsw-alias-state-error-primary);margin-top:5px;',
      'overflow-wrap:anywhere;white-space:pre-wrap;max-height:140px;overflow:auto}',
    ].join('')

    function fmtBytes(bytes) {
      if (!Number.isFinite(bytes)) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    }

    function fmtTime(iso) {
      if (!iso) return '—'
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return String(iso)
      const pad = (value) => String(value).padStart(2, '0')
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
        ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
    }

    function relTime(iso, t) {
      if (!iso) return '—'
      const time = Date.parse(iso)
      if (!Number.isFinite(time)) return String(iso)
      const diff = Date.now() - time
      if (diff < 0) return fmtTime(iso)
      if (diff < 60e3) return t('justNow')
      if (diff < 3600e3) return Math.floor(diff / 60e3) + ' ' + t('minutesAgo')
      if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' ' + t('hoursAgo')
      return Math.floor(diff / 86400e3) + ' ' + t('daysAgo')
    }

    function shortId(id) {
      return id.length <= 24 ? id : id.slice(0, 21) + '…'
    }

    function summaryKeyOf(page) {
      return String(page.id) + '@' + String(page.updatedAt || '') + '@' + String((page.body || '').length)
    }

    function purposeKeyForEntry(entry) {
      if (entry === null || entry === undefined) return 'pagePurposeCustom'
      if (typeof entry.purposeKey === 'string' && entry.purposeKey !== '') return entry.purposeKey
      const item = TAXONOMY.find(function (candidate) {
        return candidate.name.toLowerCase() === String(entry.name).toLowerCase()
      })
      return item === undefined ? 'pagePurposeCustom' : item.purposeKey
    }

    function Card(props) {
      return h('section', { className: 'hsp-card' }, props.children)
    }

    function Field(props) {
      return h('div', { className: 'hsp-field' },
        h('span', { className: 'hsp-field-k' }, props.label),
        h('span', { className: 'hsp-field-v' }, props.children),
      )
    }

    function CopyPath(props) {
      const [state, setState] = React.useState('idle')
      const mark = function (next) {
        setState(next)
        setTimeout(function () { setState('idle') }, 1800)
      }
      return h('div', { className: 'hsp-row', style: { marginTop: 6, gap: 10 } },
        h('div', { className: 'hsp-code', style: { flex: '1 1 320px' } }, props.path),
        h('button', {
          className: 'hsp-btn',
          type: 'button',
          onClick: function () {
            const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
            if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
              mark('failed')
              return
            }
            clipboard.writeText(props.path).then(function () {
              mark('copied')
            }).catch(function () {
              mark('failed')
            })
          },
        }, state === 'copied' ? props.t('copied') : (state === 'failed' ? props.t('copyFailed') : props.t('copy'))),
      )
    }

    function OverviewTab(props) {
      const t = props.t
      const data = props.data
      const stats = props.stats === undefined || props.stats === null
        ? { status: 'idle', value: null, error: '' }
        : props.stats
      const value = stats.status === 'ready' ? stats.value : null
      const config = data.config
      const health = data.health
      const storage = data.storage
      const dbEntry = storage === null ? null : storage.entries.find(function (entry) { return entry.key === 'database' })
      const tiles = [
        [t('totalNodes'), value === null ? '—' : String(value.totalNodes)],
        [t('observations'), value === null ? '—' : String(value.totalObservations)],
        [t('documents'), value === null ? '—' : String(value.totalDocuments)],
        [t('links'), value === null ? '—' : String(value.totalLinks)],
      ]
      return h('div', null,
        h('div', { className: 'hsp-tiles' }, tiles.map(function (tile) {
          return h('div', { key: tile[0], className: 'hsp-tile' },
            h('div', { className: 'hsp-tile-k' }, tile[0]),
            h('div', { className: 'hsp-tile-v' }, tile[1]),
          )
        })),
        h(Card, null,
          h('div', { className: 'hsp-card-h' }, t('status'),
            h('span', { className: 'hsp-badge' }, props.bank || t('bankNone')),
          ),
          h(Field, { label: t('mode') }, config === null ? '—' : config.serverMode),
          h(Field, { label: t('api') }, h('span', { className: 'hsp-code' }, config === null ? '—' : config.apiUrl)),
          h(Field, { label: t('health') },
            h('span', { className: 'hsp-dot' + (health !== null && health.status === 'healthy' ? ' hsp-dot-on' : '') }),
            health === null
              ? (data.healthError !== '' ? t('healthBad') + ' · ' + data.healthError : t('healthUnknown'))
              : ((health.status === 'healthy' ? t('healthOk') : String(health.status || t('healthBad'))) +
                  (health.database ? ' · db ' + String(health.database) : '')),
            health === null || health.status !== 'healthy'
              ? h('button', {
                  className: 'hsp-link',
                  type: 'button',
                  style: { marginLeft: 8 },
                  onClick: props.onRecover,
                }, t('recover'))
              : null,
          ),
          h(Field, { label: t('configPath') }, h('span', { className: 'hsp-code' }, config === null ? '—' : config.path)),
          h(Field, { label: t('bankTemplate') }, config === null ? '—' : (config.bankId !== '' ? config.bankId : config.bankIdTemplate)),
          h(Field, { label: t('disabled') }, config !== null && config.disabled ? t('yes') : t('no')),
          config === null || config.exists !== true
            ? h('div', { className: 'hsp-error' }, t('configMissing') + (config !== null && config.error ? ' · ' + config.error : ''))
            : null,
          data.banks.length === 0
            ? h('div', { className: 'hsp-error' }, data.banksError !== '' ? t('loadFailed') + data.banksError : t('bankNone'))
            : null,
        ),
        h(Card, null,
          h('div', { className: 'hsp-card-h' }, t('stats')),
          stats.status === 'error'
            ? h('div', { className: 'hsp-error' }, t('loadFailed') + stats.error)
            : stats.status === 'ready'
              ? h('div', null,
                  h(Field, { label: t('factTypes') }, Object.entries(stats.value.factTypes || {}).map(function (pair) {
                    return h('span', { key: pair[0], className: 'hsp-chip' }, pair[0] + ' ' + pair[1])
                  })),
                  h(Field, { label: t('lastWrite') }, fmtTime(stats.value.lastWriteAt)),
                  h(Field, { label: t('lastConsolidated') }, fmtTime(stats.value.lastConsolidatedAt)),
                  h(Field, { label: t('operations') },
                    t('pending') + ' ' + String(Number(stats.value.pendingOperations) || 0) + ' · ' +
                    t('failed') + ' ' + String(Number(stats.value.failedOperations) || 0) +
                    (Number(stats.value.processingOperations) > 0
                      ? ' · ' + t('statusProcessing') + ' ' + String(Number(stats.value.processingOperations))
                      : ''),
                    h('button', {
                      className: 'hsp-link',
                      type: 'button',
                      style: { marginLeft: 8 },
                      onClick: props.onOpenOperations,
                    }, t('openOperations') + ' →'),
                  ),
                )
              : h('div', { className: 'hsp-empty' }, props.bank === '' ? t('bankNone') : t('loading')),
        ),
        h(Card, null,
          h('div', { className: 'hsp-card-h' }, t('overviewPages')),
          h('div', { className: 'hsp-meta' }, t('pagesIntro')),
          h('div', { className: 'hsp-grid', style: { marginTop: 10 } },
            TAXONOMY.map(function (item) {
              const known = props.taxonomy === null
                ? null
                : props.taxonomy.find(function (entry) { return entry.name === item.name })
              const present = known !== null && known !== undefined && known.pageId !== null
              const badge = props.taxonomyReady === false
                ? '…'
                : (present ? t('pagesGenerated') : t('pagesMissing'))
              return h('div', { key: item.name, className: 'hsp-pagecard' },
                h('div', { className: 'hsp-pagecard-h' }, t(item.key)),
                h('div', { className: 'hsp-pagecard-sub' }, item.name),
                h('div', { className: 'hsp-pagecard-sub' }, t(item.purposeKey)),
                h('div', { className: 'hsp-pagecard-sub' },
                  h('span', { className: 'hsp-badge ' + (present ? 'hsp-badge-on' : 'hsp-badge-off') }, badge),
                  present && known.updatedAt ? ' ' + t('pageUpdated') + ' ' + relTime(known.updatedAt, t) : '',
                ),
              )
            }),
          ),
          h('div', { style: { marginTop: 10 } },
            h('button', { className: 'hsp-link', type: 'button', onClick: props.onOpenPages }, t('openPages') + ' →'),
          ),
        ),
        h(Card, null,
          h('div', { className: 'hsp-card-h' }, t('storageSummary')),
          h('div', { className: 'hsp-meta' }, t('storageHint')),
          dbEntry
            ? h('div', null,
                h(Field, { label: t('database') }, h('span', { className: 'hsp-code' }, dbEntry.path)),
                dbEntry.realPath
                  ? h(Field, { label: t('realPath') }, h('span', { className: 'hsp-code' }, dbEntry.realPath))
                  : null,
                h(Field, { label: t('size') }, fmtBytes(dbEntry.bytes) + ' · ' + String(dbEntry.files) + ' ' + t('filesCount')),
              )
            : h('div', { className: 'hsp-empty' }, t('empty')),
        ),
        h('div', { className: 'hsp-foot' }, t('scopeNote') + ' · ' + t('generatedAt') + ' ' + fmtTime(data.generatedAt)),
      )
    }

    function PagesTab(props) {
      const t = props.t
      const data = props.data
      const open = props.open
      const setOpen = props.setOpen
      const summaries = props.summaries === undefined || props.summaries === null ? {} : props.summaries
      const onRetry = props.onRetry
      if (data === null) {
        return h('div', { className: 'hsp-empty' }, props.bank === '' ? t('bankNone') : t('loading'))
      }
      if (data.supported === false) return h('div', { className: 'hsp-empty' }, t('pageUnsupported'))
      const pageById = new Map(data.pages.map(function (page) { return [page.id, page] }))
      const missing = data.taxonomy.filter(function (entry) { return entry.pageId === null })
      const presentCount = data.taxonomy.length - missing.length
      return h('div', null,
        h('div', { className: 'hsp-meta', style: { marginBottom: 12 } }, t('pagesIntro')),
        data.error !== '' ? h('div', { className: 'hsp-error' }, t('loadFailed') + data.error) : null,
        h(Card, null,
          h('div', { className: 'hsp-card-h' },
            t('pagesTitle') + ' · ' + String(presentCount) + ' / ' + String(data.taxonomy.length)),
          data.pages.length === 0 && data.error === ''
            ? h('div', { className: 'hsp-meta', style: { marginBottom: 4 } },
                t('pageEmpty') + ' ' + t('pageEmptyHint'))
            : null,
          data.taxonomy.map(function (entry) {
            const page = entry.pageId === null ? null : pageById.get(entry.pageId)
            if (page === undefined || page === null) {
              return h(MissingPageCard, { key: entry.name, entry: entry, t: t })
            }
            return h(PageCard, {
              key: page.id, page: page, entry: entry, t: t, open: open, setOpen: setOpen,
              summaries: summaries, onRetry: onRetry,
            })
          }),
        ),
        data.custom.length > 0
          ? h(Card, null,
              h('div', { className: 'hsp-card-h' }, t('customPages') + ' · ' + String(data.custom.length)),
              h('div', { className: 'hsp-meta', style: { marginBottom: 4 } }, t('customPagesIntro')),
              data.custom.map(function (page) {
                return h(PageCard, {
                  key: page.id, page: page, entry: null, t: t, open: open, setOpen: setOpen,
                  summaries: summaries, onRetry: onRetry,
                })
              }),
            )
          : null,
      )
    }

    function MissingPageCard(props) {
      const t = props.t
      const entry = props.entry
      return h('div', { className: 'hsp-pagecard', style: { marginTop: 10 } },
        h('div', { className: 'hsp-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
          h('div', { className: 'hsp-pagecard-h' }, labelForName(entry.name, t)),
          h('span', { className: 'hsp-badge hsp-badge-off' }, t('pagesMissing')),
        ),
        h('div', { className: 'hsp-pagecard-sub' }, entry.name),
        h('div', { className: 'hsp-summary' },
          h('div', { className: 'hsp-summary-h' }, t('summaryTitle')),
          h('div', { className: 'hsp-summary-text' }, t(purposeKeyForEntry(entry))),
          h('div', { className: 'hsp-summary-note' }, t('summaryEmpty')),
        ),
      )
    }

    function labelForName(name, t) {
      const item = TAXONOMY.find(function (entry) { return entry.name.toLowerCase() === String(name).toLowerCase() })
      return item === undefined ? String(name) : t(item.key)
    }

    function cleanPageBody(text) {
      if (typeof text !== 'string') return ''
      let body = text.replace(/^\uFEFF/, '')
      const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(body)
      if (frontmatter !== null) body = body.slice(frontmatter[0].length)
      body = body.replace(/^\s*_?No content yet\.?_?\s*$/im, '')
      return body.trim()
    }

    function PageCard(props) {
      const t = props.t
      const page = props.page
      const isOpen = props.open[page.id] === true
      const toggle = function () {
        const next = Object.assign({}, props.open)
        next[page.id] = !isOpen
        props.setOpen(next)
      }
      const body = cleanPageBody(page.body)
      const rawSummary = props.summaries === undefined || props.summaries === null
        ? undefined
        : props.summaries[page.id]
      const summary = rawSummary !== undefined && rawSummary.key === summaryKeyOf(page) ? rawSummary : undefined
      const purpose = t(purposeKeyForEntry(props.entry))
      const summaryBlock = h('div', { className: 'hsp-summary' },
        h('div', { className: 'hsp-summary-h' }, t('summaryTitle'),
          summary !== undefined && summary.status === 'ready' && summary.model !== ''
            ? h('span', { className: 'hsp-badge' }, summary.model)
            : null,
        ),
        summary !== undefined && summary.status === 'ready'
          ? h('div', null,
              summary.title !== '' ? h('div', { className: 'hsp-summary-title' }, summary.title) : null,
              h('div', { className: 'hsp-summary-text' }, summary.text),
              h('div', { className: 'hsp-summary-note' }, t('summaryModel')),
            )
          : (summary !== undefined && summary.status === 'loading'
              ? h('div', { className: 'hsp-summary-text' }, t('summaryLoading'))
              : (summary !== undefined && summary.status === 'error'
                  ? h('div', null,
                      h('div', { className: 'hsp-error', style: { margin: 0 } }, t('summaryFailed') + summary.error),
                      h('button', {
                        className: 'hsp-btn hsp-summary-actions',
                        type: 'button',
                        onClick: function (event) {
                          event.stopPropagation()
                          if (typeof props.onRetry === 'function') props.onRetry(page)
                        },
                      }, t('summaryRetry')),
                    )
                  : h('div', null,
                      h('div', { className: 'hsp-summary-text' }, purpose),
                      h('div', { className: 'hsp-summary-note' },
                        summary !== undefined && summary.status === 'unsupported'
                          ? t('summaryUnsupported')
                          : (body === '' ? t('summaryEmpty') : t('summaryLoading'))),
                    ))),
      )
      return h('div', { className: 'hsp-pagecard', style: { marginTop: 10 } },
        h('div', {
          className: 'hsp-toggle',
          role: 'button',
          tabIndex: 0,
          'aria-expanded': isOpen,
          onClick: toggle,
          onKeyDown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggle()
            }
          },
        },
          h('div', null,
            h('div', { className: 'hsp-pagecard-h' }, page.name,
              page.refreshFailedAt ? h('span', { className: 'hsp-badge hsp-badge-off' }, t('pageRefreshFailed')) : null,
            ),
            h('div', { className: 'hsp-pagecard-sub' },
              (props.entry !== null ? labelForName(props.entry.name, t) + ' · ' : '') +
              (page.updatedAt ? t('pageUpdated') + ' ' + relTime(page.updatedAt, t) : t('pagesGenerated')),
            ),
          ),
          h('span', { className: 'hsp-badge' }, isOpen ? '▾' : '▸'),
        ),
        summaryBlock,
        page.error
          ? h('div', { className: 'hsp-error' }, page.error)
          : null,
        page.description
          ? h('div', { className: 'hsp-pagecard-sub', style: { marginTop: 8 } },
              t('pageSource') + ': ' + page.description)
          : null,
        isOpen
          ? h('div', null,
              h('div', { className: 'hsp-meta', style: { marginTop: 10 } }, t('rawMarkdown')),
              h('div', { className: 'hsp-body' }, body === '' ? t('empty') : body),
            )
          : null,
      )
    }

    function MemoriesTab(props) {
      const t = props.t
      const state = props.state
      const onType = props.onType
      const onQuery = props.onQuery
      const onSearch = props.onSearch
      const onClear = props.onClear
      const onMore = props.onMore
      return h('div', null,
        h('div', { className: 'hsp-toolbar' },
          h('select', {
            className: 'hsp-select',
            value: state.type,
            onChange: function (event) { onType(event.target.value) },
          },
            h('option', { value: '' }, t('allTypes')),
            h('option', { value: 'observation' }, t('typeObservation')),
            h('option', { value: 'world' }, t('typeWorld')),
            h('option', { value: 'experience' }, t('typeExperience')),
          ),
          h('input', {
            className: 'hsp-input',
            type: 'search',
            placeholder: t('searchPlaceholder'),
            value: state.draft,
            onChange: function (event) { onQuery(event.target.value) },
            onKeyDown: function (event) {
              if (event.key !== 'Enter') return
              if (event.nativeEvent && event.nativeEvent.isComposing) return
              onSearch()
            },
          }),
          h('button', { className: 'hsp-btn', type: 'button', disabled: state.loading, onClick: onSearch }, t('search')),
          state.query !== '' || state.type !== ''
            ? h('button', { className: 'hsp-btn', type: 'button', onClick: onClear }, t('clear'))
            : null,
        ),
        state.error !== ''
          ? h('div', { className: 'hsp-error' }, t('loadFailed') + state.error)
          : h('div', null,
              h('div', { className: 'hsp-meta', style: { marginBottom: 8 } },
                t('shown') + ' ' + String(state.items.length) + ' ' + t('of') + ' ' + String(state.total)),
              state.items.length === 0
                ? h('div', { className: 'hsp-empty' }, state.loading ? t('loading') : t('memoryEmpty'))
                : h('ul', { className: 'hsp-list' },
                    state.items.map(function (item) {
                      return h('li', { key: item.id, className: 'hsp-item' },
                        h('div', { className: 'hsp-item-text' }, item.text),
                        h('div', { className: 'hsp-item-meta' },
                          (item.factType || '?') + ' · ' + fmtTime(item.date) +
                          (item.tags.length > 0 ? ' · ' + item.tags.join(', ') : '') +
                          (item.state !== '' && item.state !== 'valid' ? ' · ' + item.state : ''),
                        ),
                      )
                    }),
                  ),
            ),
        state.items.length < state.total
          ? h('div', { style: { marginTop: 10 } },
              h('button', { className: 'hsp-btn', type: 'button', disabled: state.loading, onClick: onMore },
                state.loading ? t('loading') : t('loadMore') + ' (' + String(state.total - state.items.length) + ')'),
            )
          : null,
      )
    }

    function DocumentsTab(props) {
      const t = props.t
      const state = props.state
      return h('div', null,
        h('div', { className: 'hsp-meta', style: { marginBottom: 8 } }, t('documentsIntro')),
        state.error !== ''
          ? h('div', { className: 'hsp-error' }, t('loadFailed') + state.error)
          : (state.items.length === 0
              ? h('div', { className: 'hsp-empty' }, state.loading ? t('loading') : t('documentsEmpty'))
              : h('div', null,
                  h('ul', { className: 'hsp-list' },
                    state.items.map(function (item) {
                      return h('li', { key: item.id, className: 'hsp-item' },
                        h('div', { className: 'hsp-item-text', title: item.id }, shortId(item.id)),
                        h('div', { className: 'hsp-item-meta' },
                          t('docCreated') + ' ' + fmtTime(item.createdAt) + ' · ' +
                          String(item.textLength) + ' ' + t('docChars') + ' · ' +
                          String(item.memoryUnitCount) + ' ' + t('docUnits') +
                          (item.source !== '' ? ' · ' + item.source : '') +
                          (item.harness !== '' ? ' · ' + item.harness : ''),
                        ),
                      )
                    }),
                  ),
                  h('div', { className: 'hsp-meta', style: { marginTop: 10, marginBottom: 8 } },
                    t('shown') + ' ' + String(state.items.length) + ' ' + t('of') + ' ' + String(state.total)),
                  state.items.length < state.total
                    ? h('button', { className: 'hsp-btn', type: 'button', disabled: state.loading, onClick: props.onMore },
                        state.loading ? t('loading') : t('loadMore'))
                    : null,
                )),
      )
    }

    function OperationsTab(props) {
      const t = props.t
      const state = props.state
      const [confirmId, setConfirmId] = React.useState('')
      const [busyId, setBusyId] = React.useState('')
      const [notice, setNotice] = React.useState({ kind: '', text: '' })
      React.useEffect(function () {
        setConfirmId('')
        setNotice({ kind: '', text: '' })
      }, [props.bank])
      React.useEffect(function () {
        if (notice.kind !== 'ok') return undefined
        const timer = setTimeout(function () { setNotice({ kind: '', text: '' }) }, 6000)
        return function () { clearTimeout(timer) }
      }, [notice])
      React.useEffect(function () {
        if (confirmId === '') return undefined
        const timer = setTimeout(function () { setConfirmId('') }, 10000)
        return function () { clearTimeout(timer) }
      }, [confirmId])
      const run = function (item, action) {
        if (busyId !== '') return
        setBusyId(item.id)
        setNotice({ kind: '', text: '' })
        Promise.resolve()
          .then(function () { return props.onAction(item, action) })
          .then(function (result) {
            if (result !== null && result !== undefined && result.success === false) {
              const reason = typeof result.message === 'string' && result.message !== ''
                ? result.message
                : ''
              setNotice({ kind: 'error', text: t('actionError') + reason })
              return
            }
            const doneKeys = { retry: 'actionRetried', delete: 'actionDeleted', cancel: 'actionCancelled' }
            const key = doneKeys[action] === undefined ? 'actionRetried' : doneKeys[action]
            const extra = result !== null && result !== undefined &&
              typeof result.message === 'string' && result.message !== ''
              ? ' · ' + result.message
              : ''
            setNotice({ kind: 'ok', text: t(key) + extra })
          })
          .catch(function (error) {
            setNotice({ kind: 'error', text: t('actionError') + String((error && error.message) || error) })
          })
          .then(function () {
            setBusyId('')
            setConfirmId('')
          })
      }
      const noticeNode = notice.text !== ''
        ? h('div', {
            className: 'hsp-notice ' + (notice.kind === 'error' ? 'hsp-notice-error' : 'hsp-notice-ok'),
            role: notice.kind === 'error' ? 'alert' : 'status',
          }, notice.text)
        : null
      if (state.status === 'unsupported') {
        return h('div', null, noticeNode, h('div', { className: 'hsp-empty' }, t('operationsUnsupported')))
      }
      if (state.status === 'error') {
        return h('div', null,
          noticeNode,
          h('div', { className: 'hsp-error' }, t('loadFailed') + state.error),
          h('div', { className: 'hsp-meta' }, t('operationsDaemonHint')),
          h('div', { style: { marginTop: 10 } },
            h('button', {
              className: 'hsp-btn',
              type: 'button',
              onClick: function () { props.onReload() },
            }, t('operationsReload')),
          ),
        )
      }
      const value = state.value
      if (value === null || value === undefined) {
        return h('div', { className: 'hsp-empty' }, props.bank === '' ? t('bankNone') : t('loading'))
      }
      if (value.supported === false) return h('div', { className: 'hsp-empty' }, t('operationsUnsupported'))
      const actionable = Array.isArray(value.actionable) ? value.actionable : []
      const auto = value.auto === undefined || value.auto === null ? { count: 0, byReason: {} } : value.auto
      const log = value.log === undefined || value.log === null ? { path: '', written: 0, error: '' } : value.log
      const byReason = auto.byReason === undefined || auto.byReason === null ? {} : auto.byReason
      const reasonPairs = Object.keys(byReason).map(function (key) { return [key, byReason[key]] })
      const counts = value.counts === undefined || value.counts === null
        ? { failed: 0, pending: 0, processing: 0 }
        : value.counts
      const actionableByReason = {}
      for (const item of actionable) {
        actionableByReason[item.reason] = (actionableByReason[item.reason] || 0) + 1
      }
      const actionableReasonPairs = Object.keys(actionableByReason)
        .map(function (key) { return [key, actionableByReason[key]] })
      const countsLine = t('operationsQueue') + ': ' +
        t('statusFailed') + ' ' + String(Number(counts.failed) || 0) + ' · ' +
        t('statusPending') + ' ' + String(Number(counts.pending) || 0) + ' · ' +
        t('statusProcessing') + ' ' + String(Number(counts.processing) || 0) + ' · ' +
        t('operationsNeedUser') + ' ' + String(actionable.length)
      const queueTotal = (Number(counts.failed) || 0) + (Number(counts.pending) || 0) + (Number(counts.processing) || 0)
      const autoSection = h('div', null,
        reasonPairs.length > 0
          ? h('div', { className: 'hsp-row', style: { marginTop: 6 } },
              reasonPairs.map(function (pair) {
                return h('span', { key: pair[0], className: 'hsp-chip' },
                  reasonLabelOf(pair[0], t) + ' ' + String(pair[1]))
              }),
            )
          : null,
        h('div', { className: 'hsp-meta', style: { marginTop: 8 } },
          t('operationsLogPath') + ' · ' + t('operationsLogWritten') +
          String(Number(log.written) || 0) + t('operationsLogWrittenTail')),
        h('div', { className: 'hsp-meta' }, t('operationsLogNote')),
        log.path ? h(CopyPath, { path: log.path, t: t }) : null,
        typeof log.error === 'string' && log.error !== ''
          ? h('div', { className: 'hsp-error' }, log.error)
          : null,
      )
      return h('div', null,
        h('div', { className: 'hsp-meta' }, t('operationsIntro')),
        h('div', { className: 'hsp-meta', style: { marginTop: 6 } }, countsLine),
        h('div', { className: 'hsp-meta', style: { marginTop: 6 } }, t('operationsRawCounts')),
        noticeNode,
        state.status === 'loading'
          ? h('div', { className: 'hsp-meta', style: { marginTop: 6 } }, t('refreshing'))
          : null,
        actionable.length === 0
          ? h(Card, null,
              h('div', { className: 'hsp-card-h' }, t('operationsEmpty')),
              h('div', { className: 'hsp-meta' }, queueTotal > 0
                ? t('operationsEmptyQueueLead') + String(queueTotal) + t('operationsEmptyQueueTail')
                : t('operationsEmptyIdle')),
              autoSection,
            )
          : h('div', null,
              h(Card, null,
                h('div', { className: 'hsp-card-h' }, t('operationsNeedUser') + ' · ' + String(actionable.length)),
                actionableReasonPairs.length > 0
                  ? h('div', { className: 'hsp-row', style: { marginTop: 6 } },
                      actionableReasonPairs.map(function (pair) {
                        return h('span', { key: pair[0], className: 'hsp-chip' },
                          reasonLabelOf(pair[0], t) + ' ' + String(pair[1]))
                      }),
                    )
                  : null,
                actionable.map(function (item) {
                  return h(OperationItem, {
                    key: item.id,
                    item: item,
                    t: t,
                    busy: busyId !== '',
                    ownBusy: busyId === item.id,
                    confirming: confirmId === item.id,
                    onConfirm: function (id) { setConfirmId(id) },
                    onRun: run,
                  })
                }),
              ),
              h(Card, null,
                h('div', { className: 'hsp-card-h' }, t('operationsAutoTitle') +
                  (auto.count > 0 ? ' · ' + String(auto.count) : '')),
                h('div', { className: 'hsp-meta' },
                  auto.count > 0
                    ? t('operationsAutoLead') + String(auto.count) + t('operationsAutoTail')
                    : t('operationsAutoNone')),
                autoSection,
              ),
            ),
        value.truncated === true ? h('div', { className: 'hsp-meta' }, t('operationsTruncated')) : null,
        h('div', { className: 'hsp-foot' }, t('operationsFetchedAt') + ' ' + fmtTime(value.fetchedAt)),
      )
    }

    function OperationItem(props) {
      const t = props.t
      const item = props.item
      const actions = Array.isArray(item.actions) ? item.actions : []
      const confirming = props.confirming === true
      const busy = props.busy === true
      const ownBusy = props.ownBusy === true
      const progress = item.progress === undefined ? null : item.progress
      const meta = []
      const metaTitle = []
      if (item.id) {
        meta.push(t('operationsId') + ' ' + shortId(String(item.id)))
        metaTitle.push(String(item.id))
      }
      if (item.itemsCount > 0) meta.push(String(item.itemsCount) + ' ' + t('operationsItems'))
      if (item.retryCount > 0) meta.push(t('operationsRetries') + String(item.retryCount) + t('operationsRetriesTail'))
      if (item.documentId) {
        meta.push(t('operationsDocument') + ' ' + shortId(String(item.documentId)))
        metaTitle.push(String(item.documentId))
      }
      if (item.mentalModelId) {
        meta.push(t('operationsMentalModel') + ' ' + shortId(String(item.mentalModelId)))
        metaTitle.push(String(item.mentalModelId))
      }
      if (item.createdAt) meta.push(fmtTime(item.createdAt))
      if (item.reason === 'stuck-processing') {
        const lastBeat = progress !== null && progress !== undefined && progress.at
          ? progress.at
          : item.updatedAt
        if (lastBeat) meta.push(t('operationsLastHeartbeat') + ' ' + relTime(lastBeat, t))
      }
      if (item.reason === 'stuck-pending' && item.createdAt) {
        meta.push(t('operationsQueuedFor') + ' ' + relTime(item.createdAt, t))
      }
      const hint = item.reason === 'failed'
        ? t('actionRetryHint')
        : (item.reason === 'unverified'
            ? t('operationsUnverifiedHint')
            : (actions.length > 0 && actions[0] === 'cancel' ? t('actionCancelHint') : ''))
      const busyLabelKeys = { retry: 'actionRetrying', delete: 'actionDeleting', cancel: 'actionCancelling' }
      const button = function (key, label, className, onClick, disabled, extra) {
        const attributes = { key: key, className: className, type: 'button', disabled: disabled === true, onClick: onClick }
        return h('button', extra === undefined ? attributes : Object.assign({}, attributes, extra), label)
      }
      const actionButtons = actions.map(function (action) {
        const busyLabelKey = busyLabelKeys[action] === undefined ? 'actionRetrying' : busyLabelKeys[action]
        const runningLabel = ownBusy ? t(busyLabelKey) : ''
        if (action === 'retry') {
          return button('retry', ownBusy ? runningLabel : t('actionRetry'), 'hsp-btn',
            function () { props.onRun(item, 'retry') }, busy)
        }
        const isDelete = action === 'delete'
        const label = isDelete ? t('actionDelete') : t('actionCancel')
        if (confirming) {
          return h('span', {
            key: action,
            className: 'hsp-row',
            onKeyDown: function (event) {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              props.onConfirm('')
            },
          },
            button('confirm', ownBusy ? runningLabel : (isDelete ? t('actionConfirmDelete') : t('actionConfirmCancel')),
              'hsp-btn hsp-btn-danger', function () { props.onRun(item, action) }, busy, { autoFocus: true }),
            button('dismiss', t('actionDismiss'), 'hsp-btn', function () { props.onConfirm('') }, busy),
          )
        }
        return button(action, label, 'hsp-btn', function () { props.onConfirm(item.id) }, busy)
      })
      return h('div', { className: 'hsp-op', 'aria-busy': ownBusy ? 'true' : undefined },
        h('div', { className: 'hsp-row', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
          h('div', { style: { flex: '1 1 240px' } },
            h('div', { className: 'hsp-op-h' },
              taskLabelOf(item.taskType, t),
              h('span', { className: 'hsp-badge' }, statusLabelOf(item.status, t)),
              item.reason === 'failed'
                ? null
                : h('span', { className: 'hsp-badge hsp-badge-off' }, reasonLabelOf(item.reason, t)),
            ),
            h('div', { className: 'hsp-item-meta', title: metaTitle.join('\n') }, meta.join(' · ')),
          ),
          h('div', { className: 'hsp-op-actions' }, actionButtons),
        ),
        typeof item.errorMessage === 'string' && item.errorMessage !== ''
          ? h('div', { className: 'hsp-op-err' }, item.errorMessage)
          : null,
        progress !== null && progress !== undefined
          ? h('div', { className: 'hsp-item-meta' },
              t('operationsProgress') + ': ' + (progress.stage || '—') +
              (progress.processed !== null && progress.processed !== undefined
                ? ' ' + String(progress.processed) +
                  (progress.total !== null && progress.total !== undefined ? '/' + String(progress.total) : '')
                : ''))
          : null,
        item.nextRetryAt
          ? h('div', { className: 'hsp-item-meta' }, t('operationsNextRetry') + ': ' + fmtTime(item.nextRetryAt))
          : null,
        item.reason === 'stuck-pending'
          ? h('div', { className: 'hsp-meta' }, t('operationsDaemonHint'))
          : null,
        hint !== '' ? h('div', { className: 'hsp-meta' }, hint) : null,
      )
    }

    function StorageTab(props) {
      const t = props.t
      const data = props.data
      if (data === null) return h('div', { className: 'hsp-empty' }, t('loading'))
      const notes = Array.isArray(data.noteKeys) && data.noteKeys.length > 0
        ? data.noteKeys.map(function (key) { return t(key) })
        : data.notes
      return h('div', null,
        h('div', { className: 'hsp-meta', style: { marginBottom: 12 } }, t('storageIntro')),
        data.entries.map(function (entry) {
          const label = entry.labelKey !== undefined ? t(entry.labelKey) : entry.label
          const note = entry.noteKey !== undefined ? t(entry.noteKey) : (entry.note || '')
          return h(Card, { key: entry.key },
            h('div', { className: 'hsp-card-h' }, label,
              h('span', { className: 'hsp-badge ' + (entry.exists ? 'hsp-badge-on' : 'hsp-badge-off') },
                entry.exists ? t('exists') : t('missing')),
              entry.bytes === null || entry.bytes === undefined
                ? null
                : h('span', { className: 'hsp-badge' }, fmtBytes(entry.bytes)),
            ),
            note !== '' ? h('div', { className: 'hsp-meta' }, note) : null,
            h(CopyPath, { path: entry.path, t: t }),
            entry.realPath
              ? h('div', null,
                  h('div', { className: 'hsp-meta', style: { marginTop: 8 } }, t('realPath')),
                  h('div', { className: 'hsp-code' }, entry.realPath),
                )
              : null,
            entry.mtime ? h(Field, { label: t('modified') }, fmtTime(entry.mtime)) : null,
            entry.truncated
              ? h('div', { className: 'hsp-meta', style: { marginTop: 6 } }, t('scanTruncated'))
              : null,
            Array.isArray(entry.files) && entry.files.length > 0 && entry.key === 'logs'
              ? h('div', { style: { marginTop: 10 } },
                  h('div', { className: 'hsp-meta' }, t('logFiles')),
                  h('ul', { className: 'hsp-list' },
                    entry.files.map(function (file) {
                      return h('li', { key: file.name, className: 'hsp-item' },
                        h('div', { className: 'hsp-item-text' },
                          h('span', { className: 'hsp-code' }, file.name) +
                          ' · ' + fmtBytes(file.bytes) + ' · ' + fmtTime(file.mtime)),
                      )
                    }),
                  ),
                )
              : null,
          )
        }),
        notes.length > 0
          ? h(Card, null,
              h('div', { className: 'hsp-card-h' }, t('storageNotes')),
              h('ul', { className: 'hsp-list' },
                notes.map(function (note, index) {
                  return h('li', { key: index, className: 'hsp-item' }, h('div', { className: 'hsp-item-text' }, note))
                }),
              ),
            )
          : null,
        h('div', { className: 'hsp-foot' }, t('scopeNote')),
      )
    }

    function Panel(props) {
      const t = props.t
      const [tab, setTab] = React.useState('overview')
      const [overview, setOverview] = React.useState(null)
      const [overviewError, setOverviewError] = React.useState('')
      const [overviewBusy, setOverviewBusy] = React.useState(false)
      const [bank, setBank] = React.useState('')
      const [statsState, setStatsState] = React.useState({ status: 'idle', value: null, error: '' })
      const [operations, setOperations] = React.useState({ status: 'idle', value: null, error: '' })
      const [pages, setPages] = React.useState(null)
      const [pageBank, setPageBank] = React.useState('')
      const [pagesFull, setPagesFull] = React.useState(false)
      const [pageOpen, setPageOpen] = React.useState({})
      const [memory, setMemory] = React.useState({
        items: [], total: 0, type: '', query: '', draft: '', loading: false, error: '',
      })
      const [documents, setDocuments] = React.useState({ items: [], total: 0, loading: false, error: '' })
      const [summaries, setSummaries] = React.useState({})
      const [recovery, setRecovery] = React.useState({ status: 'idle', message: '', checks: [], logs: [] })
      const summaryRequests = React.useRef(new Map())
      const seq = React.useRef(0)
      const memoryBank = React.useRef('')
      const documentsBank = React.useRef('')
      const pageSeq = React.useRef(0)
      const statsSeq = React.useRef(0)
      const operationsSeq = React.useRef(0)
      const documentsSeq = React.useRef(0)

      const call = React.useCallback(function (method, payload) {
        if (typeof rpcCall !== 'function') return Promise.reject(new Error('RPC 未初始化'))
        return rpcCall(method, payload === undefined ? {} : payload)
      }, [])

      const loadOverview = React.useCallback(async function () {
        setOverviewBusy(true)
        try {
          const value = await call('overview')
          setOverview(value)
          setOverviewError('')
          if (value.health === null || value.health.status !== 'healthy') {
            setRecovery(function (current) {
              return current.status === 'ready' ? { status: 'idle', message: '', checks: [], logs: [] } : current
            })
          }
          setBank(function (current) {
            if (current !== '') return current
            return value.banks.length > 0 ? value.banks[0].id : ''
          })
        } catch (error) {
          setOverviewError(String((error && error.message) || error))
        } finally {
          setOverviewBusy(false)
        }
      }, [call])

      const loadStats = React.useCallback(async function (target) {
        if (target === '') {
          setStatsState({ status: 'idle', value: null, error: '' })
          return
        }
        const requestId = statsSeq.current + 1
        statsSeq.current = requestId
        setStatsState(function (current) {
          return { status: 'loading', value: current.status === 'ready' ? current.value : null, error: '' }
        })
        try {
          const value = await call('stats', { bank: target })
          if (statsSeq.current !== requestId) return
          setStatsState({ status: 'ready', value: value, error: '' })
        } catch (error) {
          if (statsSeq.current !== requestId) return
          setStatsState({ status: 'error', value: null, error: String((error && error.message) || error) })
        }
      }, [call])

      const loadOperations = React.useCallback(async function (target) {
        if (target === '') {
          setOperations({ status: 'idle', value: null, error: '' })
          return
        }
        const requestId = operationsSeq.current + 1
        operationsSeq.current = requestId
        setOperations(function (current) {
          return { status: 'loading', value: current.value, error: '' }
        })
        try {
          const value = await call('operations', { bank: target })
          if (operationsSeq.current !== requestId) return
          setOperations({ status: 'ready', value: value, error: '' })
        } catch (error) {
          if (operationsSeq.current !== requestId) return
          const message = String((error && error.message) || error)
          const unsupported = message.indexOf('未知的 RPC 端点') >= 0 || message.indexOf('not-found') >= 0
          setOperations({ status: unsupported ? 'unsupported' : 'error', value: null, error: message })
        }
      }, [call])

      const loadPages = React.useCallback(async function (target, light) {        const requestId = pageSeq.current + 1
        pageSeq.current = requestId
        try {
          const value = await call('pages', { bank: target, light: light === true })
          if (pageSeq.current !== requestId) return
          setPages(value)
          setPageBank(target)
          setPagesFull(light !== true)
        } catch (error) {
          if (pageSeq.current !== requestId) return
          setPages({
            bank: target,
            supported: true,
            light: light === true,
            pages: [],
            taxonomy: [],
            custom: [],
            error: String((error && error.message) || error),
          })
          setPageBank(target)
          setPagesFull(light !== true)
        }
      }, [call])

      const requestSummary = React.useCallback(async function (target, page) {
        const key = summaryKeyOf(page)
        const known = summaryRequests.current.get(key)
        if (known !== undefined) return
        summaryRequests.current.set(key, 'loading')
        setSummaries(function (current) {
          return Object.assign({}, current, {
            [page.id]: { key: key, status: 'loading', title: '', text: '', model: '', error: '' },
          })
        })
        try {
          const value = await call('summarize', {
            bank: target,
            pageId: page.id,
            name: page.name,
            updatedAt: page.updatedAt === null || page.updatedAt === undefined ? '' : page.updatedAt,
            tags: page.tags,
            body: typeof page.body === 'string' ? page.body.slice(0, 60000) : '',
          })
          summaryRequests.current.set(key, 'ready')
          setSummaries(function (current) {
            return Object.assign({}, current, {
              [page.id]: {
                key: key,
                status: 'ready',
                title: typeof value.title === 'string' ? value.title : '',
                text: typeof value.summary === 'string' ? value.summary : '',
                model: typeof value.model === 'string' ? value.model : '',
                error: '',
              },
            })
          })
        } catch (error) {
          const message = String((error && error.message) || error)
          const unsupported = message.indexOf('未知的 RPC 端点') >= 0 || message.indexOf('not-found') >= 0
          summaryRequests.current.set(key, unsupported ? 'unsupported' : 'error')
          setSummaries(function (current) {
            return Object.assign({}, current, {
              [page.id]: {
                key: key,
                status: unsupported ? 'unsupported' : 'error',
                title: '',
                text: '',
                model: '',
                error: message,
              },
            })
          })
        }
      }, [call])

      const loadMemories = React.useCallback(async function (target, options) {
        const requestId = seq.current + 1
        seq.current = requestId
        const offset = options && options.append === true ? memory.items.length : 0
        setMemory(function (current) {
          return Object.assign({}, current, {
            loading: true,
            error: '',
            type: options && options.type !== undefined ? options.type : current.type,
            query: options && options.query !== undefined ? options.query : current.query,
            items: options && options.append === true ? current.items : [],
          })
        })
        try {
          const value = await call('memories', {
            bank: target,
            type: options && options.type !== undefined ? options.type : memory.type,
            query: options && options.query !== undefined ? options.query : memory.query,
            limit: 40,
            offset: offset,
          })
          if (seq.current !== requestId) return
          setMemory(function (current) {
            const items = options && options.append === true ? current.items.concat(value.items) : value.items
            return Object.assign({}, current, { items: items, total: value.total, loading: false, error: '' })
          })
        } catch (error) {
          if (seq.current !== requestId) return
          setMemory(function (current) {
            return Object.assign({}, current, { loading: false, error: String((error && error.message) || error) })
          })
        }
      }, [call, memory.items.length, memory.type, memory.query])

      const loadDocuments = React.useCallback(async function (target, append) {
        const requestId = documentsSeq.current + 1
        documentsSeq.current = requestId
        const offset = append === true ? documents.items.length : 0
        setDocuments(function (current) {
          return {
            items: append === true ? current.items : [],
            total: append === true ? current.total : 0,
            loading: true,
            error: '',
          }
        })
        try {
          const value = await call('documents', { bank: target, limit: 30, offset: offset })
          if (documentsSeq.current !== requestId) return
          setDocuments(function (current) {
            return {
              items: append === true ? current.items.concat(value.items) : value.items,
              total: value.total,
              loading: false,
              error: '',
            }
          })
        } catch (error) {
          if (documentsSeq.current !== requestId) return
          setDocuments(function (current) {
            return {
              items: append === true ? current.items : [],
              total: append === true ? current.total : 0,
              loading: false,
              error: String((error && error.message) || error),
            }
          })
        }
      }, [call, documents.items.length])

      React.useEffect(function () { loadOverview() }, [loadOverview])

      React.useEffect(function () { loadStats(bank) }, [bank, loadStats])

      React.useEffect(function () {
        if (bank === '' || pageBank === bank) return
        loadPages(bank, true)
      }, [bank, pageBank, loadPages])

      React.useEffect(function () {
        if (tab !== 'operations' || bank === '') return
        loadOperations(bank)
      }, [tab, bank, loadOperations])

      React.useEffect(function () {
        if (tab !== 'pages' || bank === '') return
        if (pageBank === bank && pagesFull) return
        loadPages(bank, false)
      }, [tab, bank, pageBank, pagesFull, loadPages])

      React.useEffect(function () {
        if (tab !== 'pages' || pages === null || pagesFull !== true || pages.supported === false) return
        if (!Array.isArray(pages.pages)) return
        for (const page of pages.pages) {
          if (typeof page.body !== 'string' || page.body.trim() === '') continue
          requestSummary(pageBank === '' ? bank : pageBank, page)
        }
      }, [tab, pages, pagesFull, pageBank, bank, requestSummary])

      React.useEffect(function () {
        if (overview === null) return undefined
        const unhealthy = overview.health === null || overview.health.status !== 'healthy'
        if (!unhealthy) return undefined
        let cancelled = false
        const timer = setInterval(async function () {
          try {
            const probe = await call('probe')
            if (!cancelled && probe !== null && probe !== undefined && probe.reachable === true) {
              loadOverview()
            }
          } catch {
            // keep polling while the daemon starts
          }
        }, 5000)
        return function () {
          cancelled = true
          clearInterval(timer)
        }
      }, [overview, call, loadOverview])

      React.useEffect(function () {
        if (tab !== 'memories' || bank === '' || memoryBank.current === bank) return
        memoryBank.current = bank
        loadMemories(bank, {})
      }, [tab, bank, loadMemories])

      React.useEffect(function () {
        if (tab !== 'documents' || bank === '' || documentsBank.current === bank) return
        documentsBank.current = bank
        loadDocuments(bank)
      }, [tab, bank, loadDocuments])

      const taxonomy = pages !== null && Array.isArray(pages.taxonomy) && pages.taxonomy.length > 0
        ? pages.taxonomy
        : TAXONOMY.map(function (item) {
            return { name: item.name, label: t(item.key), pageId: null, updatedAt: null }
          })

      const refresh = function () {
        loadOverview()
        if (bank !== '') {
          loadStats(bank)
          loadPages(bank, tab !== 'pages' && !pagesFull)
        }
        if (tab === 'memories') loadMemories(bank, {})
        if (tab === 'documents') loadDocuments(bank)
        if (tab === 'operations') loadOperations(bank)
      }

      /**
       * One recovery run. `requestStart` is false when another start already looks
       * under way (e.g. the Hindsight plugin started the daemon as the session
       * began): then only follow it, never spawn a second launcher.
       */
      const recoverWith = React.useCallback(async function (requestStart) {
        const startedAt = Date.now()
        setRecovery({ status: 'checking', message: t('recoveryChecking'), checks: [], logs: [] })
        try {
          const result = await call('selfCheck', { start: requestStart === true })
          const checks = Array.isArray(result.checks) ? result.checks : []
          const logs = Array.isArray(result.logs) ? result.logs : []
          if (result.healthy === true) {
            setRecovery({ status: 'ready', message: t('recoveryReady'), checks, logs: [] })
            refresh()
            return
          }
          if (typeof result.error === 'string' && result.error !== '') {
            setRecovery({ status: 'failed', message: result.error, checks, logs })
            return
          }
          // A cold start may have to download the hindsight-api environment first, so wait
          // minutes rather than the old fixed 120 s — that cap expired before the daemon was
          // even considered ready, so the button could only ever report a timeout.
          while (Date.now() - startedAt < RECOVERY_WAIT_MS) {
            const waitedSeconds = Math.round((Date.now() - startedAt) / 1000)
            setRecovery({
              status: 'starting',
              message: (waitedSeconds < 10 ? t('recoveryStarting') : t('recoveryStartingFirst'))
                + ' ' + t('recoveryWaiting') + waitedSeconds + 's',
              checks,
              logs,
            })
            await new Promise(function (resolve) { setTimeout(resolve, RECOVERY_POLL_MS) })
            let probe = null
            try {
              probe = await call('probe')
            } catch {
              // a failed poll only means "not ready yet"; keep waiting
            }
            if (probe !== null && probe !== undefined && probe.reachable === true) {
              let finalChecks = checks
              try {
                const final = await call('selfCheck', {})
                if (Array.isArray(final.checks)) finalChecks = final.checks
              } catch {
                // keep the start-time checklist when the follow-up check fails
              }
              setRecovery({ status: 'ready', message: t('recoveryReady'), checks: finalChecks, logs: [] })
              refresh()
              return
            }
          }
          let finalChecks = checks
          let finalLogs = logs
          try {
            const final = await call('selfCheck', {})
            if (Array.isArray(final.checks)) finalChecks = final.checks
            if (Array.isArray(final.logs)) finalLogs = final.logs
          } catch {
            // keep the start-time checklist when the follow-up check fails
          }
          setRecovery({ status: 'failed', message: t('recoveryTimeout'), checks: finalChecks, logs: finalLogs })
        } catch (error) {
          setRecovery({ status: 'failed', message: String((error && error.message) || error), checks: [], logs: [] })
        }
      }, [call, refresh, t])

      const recover = React.useCallback(function () { recoverWith(true) }, [recoverWith])

      const autoRecoveryTried = React.useRef(false)
      React.useEffect(function () {
        if (overview === null || autoRecoveryTried.current) return undefined
        if (recovery.status !== 'idle') return undefined
        const unhealthy = overview.health === null || overview.health.status !== 'healthy'
        if (!unhealthy) return undefined
        // Restarting DSH takes the daemon down with it, and the Hindsight plugin only starts
        // one at the next session start — so a freshly opened panel used to sit on 「不可用」
        // until the user pressed the button or sent a prompt. Pull it up automatically once
        // per panel mount; if a start is already under way, just follow it instead.
        // Once the timer fires the run proceeds even if the effect re-runs (the overview
        // refresh from the 5-second probe would otherwise cancel an auto-recovery already
        // marked as tried, leaving the panel on 「不可用」 for good).
        const timer = setTimeout(async function () {
          if (autoRecoveryTried.current) return
          autoRecoveryTried.current = true
          let alreadyStarting = false
          try {
            const check = await call('selfCheck', {})
            alreadyStarting = check !== null && check !== undefined && check.starting === true
          } catch {
            alreadyStarting = false
          }
          recoverWith(!alreadyStarting)
        }, AUTO_RECOVERY_DELAY_MS)
        return function () {
          clearTimeout(timer)
        }
      }, [overview, recovery.status, call, recoverWith])

      const runOperation = React.useCallback(async function (item, action) {
        const result = await call('operationAction', {
          bank: bank,
          operationId: item.id,
          action: action,
        })
        await Promise.all([loadOperations(bank), loadStats(bank)])
        return result
      }, [call, bank, loadOperations, loadStats])

      const tabButton = function (id, label) {
        return h('button', {
          key: id,
          type: 'button',
          role: 'tab',
          'aria-selected': tab === id,
          className: 'hsp-tab' + (tab === id ? ' hsp-tab-on' : ''),
          onClick: function () { setTab(id) },
        }, label)
      }

      return h('div', { className: 'hsp-root' },
        h('style', null, CSS),
        h('div', { className: 'hsp-head' },
          h('div', null,
            h('h2', { className: 'hsp-title' }, t('title')),
            h('div', { className: 'hsp-sub' },
              (bank === '' ? (overview === null ? '…' : t('bankNone')) : bank) +
              (overview !== null && overview.config !== null ? ' · ' + overview.config.serverMode + ' · ' + overview.config.apiUrl : '') +
              ' · ' + t('subtitle')),
          ),
          h('div', { className: 'hsp-head-actions' },
            overview !== null && overview.banks.length > 0
              ? h('select', {
                  className: 'hsp-select',
                  value: bank,
                  onChange: function (event) {
                    pageSeq.current = pageSeq.current + 1
                    statsSeq.current = statsSeq.current + 1
                    documentsSeq.current = documentsSeq.current + 1
                    setBank(event.target.value)
                    setPages(null)
                    setPageBank('')
                    setPagesFull(false)
                    setPageOpen({})
                    setStatsState({ status: 'idle', value: null, error: '' })
                    setOperations({ status: 'idle', value: null, error: '' })
                    operationsSeq.current = operationsSeq.current + 1
                    setMemory({ items: [], total: 0, type: '', query: '', draft: '', loading: false, error: '' })
                    setDocuments({ items: [], total: 0, loading: false, error: '' })
                    summaryRequests.current = new Map()
                    setSummaries({})
                  },
                },
                  overview.banks.map(function (item) {
                    return h('option', { key: item.id, value: item.id },
                      item.name + ' · ' + item.factCount + ' ' + t('facts'))
                  }),
                )
              : null,
            h('button', {
              className: 'hsp-btn',
              type: 'button',
              disabled: recovery.status === 'checking' || recovery.status === 'starting',
              onClick: recover,
            }, recovery.status === 'checking' ? t('recovering') : (recovery.status === 'starting' ? t('starting') : t('recover'))),
            h('button', { className: 'hsp-btn', type: 'button', disabled: overviewBusy, onClick: refresh },
              overviewBusy ? t('refreshing') : t('refresh')),
          ),
        ),
        h('div', { className: 'hsp-tabs', role: 'tablist' },
          tabButton('overview', t('tabsOverview')),
          tabButton('pages', t('tabsPages')),
          tabButton('memories', t('tabsMemories')),
          tabButton('documents', t('tabsDocuments')),
          tabButton('operations', t('tabsOperations')),
          tabButton('storage', t('tabsStorage')),
        ),
        recovery.status !== 'idle'
          ? h('div', { className: 'hsp-recover hsp-recover-' + recovery.status },
              h('div', { className: 'hsp-recover-h' },
                h('span', null, t('recoveryTitle')),
                h('span', { className: 'hsp-badge' },
                  recovery.status === 'checking'
                    ? t('recovering')
                    : (recovery.status === 'starting'
                        ? t('starting')
                        : (recovery.status === 'ready' ? t('recoveryReadyShort') : t('recoveryFailedShort')))),
                h('button', {
                  className: 'hsp-link',
                  type: 'button',
                  onClick: function () { setRecovery({ status: 'idle', message: '', checks: [], logs: [] }) },
                }, t('recoveryDismiss')),
              ),
              h('div', { className: 'hsp-recover-msg', style: { marginTop: 4 } }, recovery.message),
              recovery.checks.length > 0
                ? h('ul', { className: 'hsp-list' },
                    recovery.checks.map(function (check) {
                      const labelKeys = {
                        config: 'recoveryConfig',
                        api: 'recoveryApi',
                        database: 'recoveryDatabase',
                        daemon: 'recoveryDaemon',
                      }
                      const labelKey = labelKeys[check.key]
                      return h('li', { key: check.key, className: 'hsp-item' },
                        h('div', { className: 'hsp-item-text' },
                          (check.ok === true ? '✓ ' : '✗ ') +
                          (labelKey === undefined ? check.label : t(labelKey)) +
                          ' · ' + check.detail),
                      )
                    }))
                : null,
              recovery.status === 'failed' && Array.isArray(recovery.logs) && recovery.logs.length > 0
                ? h('div', null,
                    recovery.logs.map(function (log) {
                      return h('div', { key: log.key },
                        h('div', { className: 'hsp-log-h' },
                          h('span', null, t('recoveryLogsTitle')),
                          h('span', { className: 'hsp-code' }, log.path),
                        ),
                        h('pre', { className: 'hsp-log' }, log.tail === '' ? t('recoveryLogsEmpty') : log.tail),
                      )
                    }))
                : null,
            )
          : null,
        overviewError !== '' ? h('div', { className: 'hsp-error' }, t('loadFailed') + overviewError) : null,
        overview === null
          ? h('div', { className: 'hsp-empty' }, overviewBusy ? t('loading') : t('empty'))
          : (tab === 'overview'
              ? h(OverviewTab, {
                  t: t, data: overview, stats: statsState, bank: bank, taxonomy: taxonomy,
                  taxonomyReady: pages !== null,
                  onOpenPages: function () { setTab('pages') },
                  onOpenOperations: function () { setTab('operations') },
                  onRecover: recover,
                })
              : null),
        overview !== null && tab === 'pages'
          ? h(PagesTab, {
              t: t, data: pages, open: pageOpen, setOpen: setPageOpen, bank: bank,
              summaries: summaries,
              onRetry: function (page) {
                summaryRequests.current.delete(summaryKeyOf(page))
                requestSummary(pageBank === '' ? bank : pageBank, page)
              },
            })
          : null,
        overview !== null && tab === 'memories'
          ? h(MemoriesTab, {
              t: t,
              state: memory,
              onType: function (value) {
                setMemory(function (current) { return Object.assign({}, current, { type: value }) })
                loadMemories(bank, { type: value })
              },
              onQuery: function (value) {
                setMemory(function (current) { return Object.assign({}, current, { draft: value }) })
              },
              onSearch: function () {
                loadMemories(bank, { query: memory.draft, type: memory.type })
              },
              onClear: function () {
                setMemory(function (current) { return Object.assign({}, current, { draft: '' }) })
                loadMemories(bank, { query: '', type: '' })
              },
              onMore: function () {
                loadMemories(bank, { append: true })
              },
            })
          : null,
        overview !== null && tab === 'documents'
          ? h(DocumentsTab, {
              t: t, state: documents,
              onMore: function () { loadDocuments(bank, true) },
            })
          : null,
        overview !== null && tab === 'operations'
          ? h(OperationsTab, {
              t: t, state: operations, bank: bank,
              onAction: runOperation,
              onReload: function () { loadOperations(bank) },
            })
          : null,
        overview !== null && tab === 'storage'
          ? h(StorageTab, { t: t, data: overview.storage })
          : null,
      )
    }

    // Sidebar row glyph: a memory bank read as a database cylinder, drawn with
    // currentColor so it follows the sidebar's own text and selected colors.
    function HindsightIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 18
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.55,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('ellipse', { cx: 12, cy: 6.2, rx: 7, ry: 2.7 }),
        h('path', { d: 'M5 6.2v11.6c0 1.5 3.13 2.7 7 2.7s7-1.2 7-2.7V6.2' }),
        h('path', { d: 'M5 12c0 1.5 3.13 2.7 7 2.7s7-1.2 7-2.7' }),
      )
    }

    return {
      inject: ['slots', 'connection', 'locale'],
      apply(ctx) {
        const connection = ctx.get('connection')
        const callRpc = function (endpoint, payload) {
          if (connection === undefined || connection.rpc === undefined) {
            return Promise.reject(new Error('connection 服务不可用'))
          }
          return connection.rpc.call(CHANNEL, String(endpoint), payload === undefined ? {} : payload)
            .then(function (outer) {
              if (!outer || outer.ok !== true) {
                const failure = outer && outer.error
                throw new Error(failure && failure.message ? failure.message : 'RPC 失败')
              }
              return outer.value
            })
        }
        rpcCall = callRpc

        let translate = function (key) { return ZH[key] || key }
        let locale
        try {
          locale = ctx.get('locale')
        } catch {
          locale = undefined
        }
        if (locale !== undefined && locale !== null && typeof locale.register === 'function') {
          ctx.effect(function () {
            const disposers = []
            for (const language of ['zh', 'en']) {
              try {
                const dispose = locale.register(NS, language, language === 'zh' ? ZH : EN)
                if (typeof dispose === 'function') disposers.push(dispose)
              } catch {
                // keep the built-in Chinese table when this locale id is rejected
              }
            }
            try {
              const bound = locale.bind(NS)
              if (typeof bound === 'function') {
                translate = function (key) {
                  let text = ''
                  try {
                    text = bound(key)
                  } catch {
                    text = ''
                  }
                  return text || ZH[key] || key
                }
              }
            } catch {
              translate = function (key) { return ZH[key] || key }
            }
            return function () {
              for (const dispose of disposers) {
                try {
                  dispose()
                } catch {
                  // one dictionary failing to unregister must not block the others
                }
              }
            }
          }, 'dsh-hindsight-panel: locale dictionaries')
        }

        // Sidebar entry plus a full page, shaped like dsh-sleuth-canvas's
        // 诊断画布: one id addresses both the sidebar.panellist row and the
        // layout's keyed `main` panel, so selecting the row renders this page.
        // A main key other than `conversation` receives no Session binding,
        // and the page needs none.
        ctx.effect(function () {
          const disposers = []
          try {
            disposers.push(ctx.slots.inject('main', () => ctx.slots.register(
              { name: 'main', key: 'hindsight-memory' },
              function () {
                return h(Panel, { key: 'hindsight-memory', t: translate })
              },
            )))
            disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
              { name: 'sidebar.panellist', id: 'hindsight-memory', order: 40, label: translate('title') },
              HindsightIcon,
            )))
          } catch (error) {
            console.error('[dsh-hindsight-panel] 侧栏注册失败: ' + String((error && error.message) || error))
          }
          return function () {
            for (const dispose of disposers) {
              try {
                if (typeof dispose === 'function') dispose()
              } catch {
                // one failing disposer must not block the others
              }
            }
          }
        }, 'dsh-hindsight-panel: sidebar page + panel list row')
      },
    }
  },
})
