function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsStringLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/<\//g, '<\\/');
}

export function getAdminHTML(baseUrl: string): string {
  const safeBaseUrl = escapeHtmlText(baseUrl);
  const safeBaseUrlJs = escapeJsStringLiteral(baseUrl);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zo Gateway</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f4; color: #1c1917; line-height: 1.6; }

    /* Login */
    #login-view { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f4; }
    .login-card { background: #fff; border-radius: 16px; padding: 40px; width: 380px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .login-card h1 { font-size: 1.5rem; text-align: center; margin-bottom: 6px; color: #1c1917; }
    .login-card .sub { text-align: center; color: #a8a29e; margin-bottom: 28px; font-size: 0.9rem; }
    .login-card .logo { text-align: center; margin-bottom: 20px; font-size: 2.5rem; }
    .login-card .remember { display: flex; align-items: center; gap: 6px; margin: 12px 0; font-size: 0.85rem; color: #78716c; }

    /* Layout */
    #app { display: none; min-height: 100vh; }
    .sidebar { width: 220px; background: #fff; border-right: 1px solid #e7e5e4; position: fixed; top: 0; left: 0; bottom: 0; display: flex; flex-direction: column; z-index: 10; }
    .sidebar-logo { padding: 24px 20px 20px; display: flex; align-items: center; gap: 10px; font-size: 1.15rem; font-weight: 700; color: #1c1917; border-bottom: 1px solid #e7e5e4; }
    .sidebar-logo span.icon { font-size: 1.4rem; }
    .sidebar-nav { flex: 1; padding: 12px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #78716c; font-size: 0.9rem; font-weight: 500; transition: all 0.15s; margin-bottom: 2px; }
    .nav-item:hover { background: #f5f5f4; color: #1c1917; }
    .nav-item.active { background: #1c1917; color: #fff; }
    .nav-item .nav-icon { font-size: 1.1rem; width: 22px; text-align: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid #e7e5e4; }
    .sidebar-footer button { width: 100%; padding: 8px; background: none; border: 1px solid #e7e5e4; border-radius: 8px; cursor: pointer; color: #78716c; font-size: 0.85rem; transition: all 0.15s; }
    .sidebar-footer button:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }

    .main { margin-left: 220px; padding: 28px 24px 28px 24px; min-height: 100vh; width: calc(100% - 220px); display: flex; flex-direction: column; }
    .page { display: none; width: 100%; flex-direction: column; flex: 1; }
    .page.active { display: flex; }
    .page-title { font-size: 1.4rem; font-weight: 700; color: #1c1917; margin-bottom: 24px; }

    /* Cards */
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e7e5e4; width: 100%; }
    .card-fill { flex: 1; display: flex; flex-direction: column; margin-bottom: 0; }
    .card-fill .pagination { margin-top: auto; }
    .card h3 { font-size: 1rem; font-weight: 600; color: #1c1917; margin-bottom: 16px; }

    /* Strategy selector */
    .strategy-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .strategy-card h3 { margin-bottom: 0; white-space: nowrap; }
    .strategy-options { display: flex; gap: 8px; }
    .strategy-btn { padding: 8px 20px; border: 2px solid #e7e5e4; border-radius: 10px; background: #fff; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #78716c; transition: all 0.15s; display: flex; align-items: center; gap: 8px; }
    .strategy-btn:hover { border-color: #a8a29e; color: #1c1917; }
    .strategy-btn.active { border-color: #1c1917; background: #1c1917; color: #fff; }
    .strategy-desc { font-size: 0.8rem; color: #a8a29e; margin-left: auto; }

    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; width: 100%; }
    .stat-card { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; }
    .stat-card .label { font-size: 0.8rem; color: #a8a29e; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 2rem; font-weight: 700; margin-top: 4px; }
    .stat-card .value.blue { color: #3b82f6; }
    .stat-card .value.green { color: #22c55e; }
    .stat-card .value.red { color: #ef4444; }
    .stat-card .value.amber { color: #f59e0b; }
    .stat-card .value.purple { color: #8b5cf6; }

    /* Model tags */
    .model-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .model-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; border: 1px solid #e7e5e4; background: #fafaf9; }
    .model-tag .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-anthropic { background: #f97316; }
    .dot-openai { background: #10b981; }
    .dot-deepseek { background: #3b82f6; }
    .dot-zai { background: #8b5cf6; }
    .dot-minimax { background: #ec4899; }
    .dot-google { background: #eab308; }

    /* Form */
    .input-group { margin-bottom: 14px; }
    .input-group label { display: block; font-size: 0.85rem; color: #78716c; margin-bottom: 5px; font-weight: 500; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px;
      font-size: 0.9rem; color: #1c1917; background: #fff; outline: none; transition: border 0.15s;
    }
    input:focus { border-color: #1c1917; }
    textarea {
      width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px;
      font-size: 0.85rem; color: #1c1917; background: #fff; outline: none; resize: vertical;
      min-height: 100px; font-family: 'SF Mono', Monaco, monospace; transition: border 0.15s;
    }
    textarea:focus { border-color: #1c1917; }

    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600; transition: all 0.15s; }
    .btn:hover { opacity: 0.9; }
    .btn-primary { background: #1c1917; color: #fff; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-outline { background: #fff; border: 1px solid #d6d3d1; color: #78716c; }
    .btn-outline:hover { border-color: #1c1917; color: #1c1917; }
    .btn-success { background: #22c55e; color: #fff; }
    .btn-sm { padding: 6px 14px; font-size: 0.8rem; }
    .btn-block { width: 100%; }

    /* Table */
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th { text-align: left; font-size: 0.75rem; color: #a8a29e; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #e7e5e4; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    td { padding: 10px 10px; border-bottom: 1px solid #f5f5f4; font-size: 0.85rem; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    tr:hover td { background: #fafaf9; }
    .token-mono { font-family: 'SF Mono', Monaco, monospace; font-size: 0.82rem; color: #78716c; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-on { background: #dcfce7; color: #16a34a; }
    .badge-off { background: #fee2e2; color: #dc2626; }
    .badge-valid { background: #dcfce7; color: #16a34a; }
    .badge-invalid { background: #fee2e2; color: #dc2626; }
    .badge-unchecked { background: #f5f5f4; color: #a8a29e; }
    .disable-reason { font-size: 0.7rem; color: #a8a29e; margin-top: 2px; }
    .btn-warn { background: #f59e0b; color: #fff; }
    .check-actions { display: flex; gap: 8px; margin-bottom: 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinning { display: inline-block; animation: spin 1s linear infinite; }
    .actions-cell { display: flex; gap: 6px; }
    .empty-state { text-align: center; color: #a8a29e; padding: 48px; font-size: 0.9rem; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f5f5f4; }
    .pagination .info { font-size: 0.8rem; color: #a8a29e; }
    .pagination .pages { display: flex; gap: 4px; }
    .page-btn { min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; cursor: pointer; font-size: 0.85rem; color: #78716c; transition: all 0.15s; }
    .page-btn:hover { border-color: #1c1917; color: #1c1917; }
    .page-btn.active { background: #1c1917; color: #fff; border-color: #1c1917; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Add form */
    .add-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
    .add-grid .input-group { margin-bottom: 0; }

    /* Info */
    .code-box { background: #1c1917; color: #e7e5e4; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.85rem; word-break: break-all; margin: 8px 0 16px; white-space: pre-wrap; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { background: #fafaf9; border-radius: 8px; padding: 12px; border: 1px solid #e7e5e4; }
    .info-item .label { font-size: 0.75rem; color: #a8a29e; margin-bottom: 2px; }
    .info-item .val { font-size: 0.85rem; color: #1c1917; font-weight: 500; font-family: 'SF Mono', Monaco, monospace; }

    /* Bulk */
    .bulk-toggle { margin-top: 12px; }
    .bulk-box { margin-top: 12px; }
    .bulk-hint { color: #a8a29e; font-size: 0.8rem; margin-top: 4px; }
    .hidden { display: none !important; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: center; justify-content: center; }
    .modal { background: #fff; border-radius: 16px; padding: 28px; width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    /* Toast */
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 10px; font-size: 0.9rem; z-index: 1000; animation: slideIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .toast-ok { background: #dcfce7; color: #16a34a; }
    .toast-err { background: #fee2e2; color: #dc2626; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  </style>
</head>
<body>

<!-- Login -->
<div id="login-view">
  <div class="login-card">
    <div class="logo">&#9889;</div>
    <h1>Zo Gateway</h1>
    <p class="sub">\u53f7\u6c60\u7ba1\u7406\u7cfb\u7edf</p>
    <div class="input-group">
      <label>Admin Key</label>
      <input type="password" id="login-key" placeholder="\u8f93\u5165 Admin Key" autofocus>
    </div>
    <label class="remember"><input type="checkbox" id="remember-me" checked> \u4ec5\u672c\u4f1a\u8bdd\u8bb0\u4f4f\u767b\u5f55\u72b6\u6001</label>
    <button class="btn btn-primary btn-block" onclick="login()">\u767b\u5f55</button>
  </div>
</div>

<!-- App -->
<div id="app">
  <div class="sidebar">
    <div class="sidebar-logo"><span class="icon">&#9889;</span> Zo Gateway</div>
    <nav class="sidebar-nav">
      <div class="nav-item active" data-page="dashboard"><span class="nav-icon">&#9632;</span> \u4eea\u8868\u76d8</div>
      <div class="nav-item" data-page="tokens"><span class="nav-icon">&#9883;</span> \u53f7\u6c60\u7ba1\u7406</div>
      <div class="nav-item" data-page="info"><span class="nav-icon">&#8635;</span> \u63a5\u5165\u4fe1\u606f</div>
    </nav>
    <div class="sidebar-footer">
      <button onclick="logout()">\u9000\u51fa\u767b\u5f55</button>
    </div>
  </div>

  <div class="main">
    <!-- Dashboard -->
    <div class="page active" id="page-dashboard">
      <div class="page-title">\u4eea\u8868\u76d8</div>
      <div class="stats">
        <div class="stat-card"><div class="label">\u603b\u8ba1 Token</div><div class="value blue" id="s-total">0</div></div>
        <div class="stat-card"><div class="label">\u53ef\u7528</div><div class="value green" id="s-available">0</div></div>
        <div class="stat-card"><div class="label">\u5df2\u7981\u7528</div><div class="value red" id="s-disabled">0</div></div>
        <div class="stat-card"><div class="label">\u5df2\u9a8c\u8bc1\u6709\u6548</div><div class="value green" id="s-valid">0</div></div>
        <div class="stat-card"><div class="label">\u652f\u6301\u6a21\u578b</div><div class="value purple" id="s-models">9</div></div>
      </div>
      <div class="card">
        <div class="strategy-card">
          <h3>\u8c03\u5ea6\u7b56\u7565</h3>
          <div class="strategy-options">
            <button class="strategy-btn active" id="btn-round-robin" onclick="setStrategy('round-robin')">
              &#8634; \u8f6e\u8be2
            </button>
            <button class="strategy-btn" id="btn-sticky" onclick="setStrategy('sticky')">
              &#128204; \u586b\u5145\u4f18\u5148
            </button>
          </div>
          <span class="strategy-desc" id="strategy-desc">\u6bcf\u6b21\u8c03\u7528\u4f9d\u6b21\u8f6e\u8be2\u6240\u6709 Key</span>
        </div>
      </div>
      <div class="card">
        <h3>\u652f\u6301\u7684\u6a21\u578b</h3>
        <div class="model-tags" id="model-tags"></div>
      </div>
      <div class="card card-fill">
        <h3>\u6700\u8fd1\u6dfb\u52a0\u7684\u8d26\u53f7</h3>
        <div class="table-wrap" style="flex:1">
          <table>
            <thead><tr><th>\u90ae\u7bb1</th><th>Space</th><th>\u6dfb\u52a0\u65f6\u95f4</th><th>\u72b6\u6001</th></tr></thead>
            <tbody id="recent-list"></tbody>
          </table>
          <div id="recent-empty" class="empty-state hidden">\u6682\u65e0\u8d26\u53f7</div>
        </div>
        <div id="recent-pagination" class="pagination"></div>
      </div>
    </div>

    <!-- Tokens -->
    <div class="page" id="page-tokens">
      <div class="page-title">\u53f7\u6c60\u7ba1\u7406</div>
      <div class="card">
        <h3>\u72b6\u6001\u68c0\u6d4b</h3>
        <div class="check-actions">
          <button class="btn btn-primary" id="btn-check-all" onclick="checkAllTokens()">\u26a1 \u4e00\u952e\u68c0\u6d4b\u72b6\u6001</button>
          <span id="check-progress" style="font-size:0.85rem;color:#78716c;align-self:center"></span>
        </div>
      </div>
      <div class="card">
        <h3>\u6dfb\u52a0 Token</h3>
        <div class="add-grid">
          <div class="input-group"><label>\u90ae\u7bb1</label><input type="text" id="add-email" placeholder="user@example.com"></div>
          <div class="input-group"><label>Space \u540d\u79f0</label><input type="text" id="add-space" placeholder="dandyseal"></div>
          <div class="input-group"><label>Zo Access Token</label><input type="text" id="add-token" placeholder="zo_sk_..."></div>
          <button class="btn btn-primary" onclick="addToken()">\u6dfb\u52a0</button>
        </div>
        <div class="bulk-toggle">
          <button class="btn btn-outline btn-sm" onclick="toggleBulk()">\u6279\u91cf\u5bfc\u5165</button>
        </div>
        <div id="bulk-box" class="bulk-box hidden">
          <textarea id="bulk-tokens" placeholder="\u6bcf\u884c\u4e00\u4e2a\uff0c\u683c\u5f0f\uff1a\u90ae\u7bb1,Space\u540d\u79f0,Token&#10;user@example.com,dandyseal,zo_sk_xxx&#10;&#10;\u4e5f\u652f\u6301\u53ea\u586bToken\uff1a&#10;zo_sk_xxx"></textarea>
          <p class="bulk-hint">\u683c\u5f0f\uff1a\u90ae\u7bb1,Space\u540d\u79f0,Token\uff08\u90ae\u7bb1\u548cSpace\u53ef\u7701\u7565\uff09</p>
          <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="bulkAdd()">\u6279\u91cf\u6dfb\u52a0</button>
        </div>
      </div>
      <div class="card card-fill">
        <h3>Token \u5217\u8868</h3>
        <div class="table-wrap" style="flex:1">
          <table>
            <thead><tr><th>\u90ae\u7bb1</th><th>Space</th><th>Token</th><th>\u6dfb\u52a0\u65f6\u95f4</th><th>\u542f\u7528</th><th>\u6709\u6548\u6027</th><th>\u64cd\u4f5c</th></tr></thead>
            <tbody id="token-list"></tbody>
          </table>
          <div id="list-empty" class="empty-state hidden">\u8fd8\u6ca1\u6709 Token</div>
        </div>
        <div id="token-pagination" class="pagination"></div>
      </div>
    </div>

    <!-- Info -->
    <div class="page" id="page-info">
      <div class="page-title">\u63a5\u5165\u4fe1\u606f</div>
      <div class="card">
        <h3>API \u7aef\u70b9</h3>
        <div class="info-grid">
          <div class="info-item"><div class="label">Base URL</div><div class="val">${safeBaseUrl}</div></div>
          <div class="info-item"><div class="label">Anthropic \u517c\u5bb9</div><div class="val">/v1/messages</div></div>
          <div class="info-item"><div class="label">OpenAI \u517c\u5bb9</div><div class="val">/v1/chat/completions</div></div>
          <div class="info-item"><div class="label">\u6a21\u578b\u5217\u8868</div><div class="val">/v1/models</div></div>
        </div>
      </div>
      <div class="card">
        <h3>\u652f\u6301\u7684\u6a21\u578b</h3>
        <div class="info-grid">
          <div class="info-item"><div class="label">Anthropic</div><div class="val">claude-opus-4-8</div></div>
          <div class="info-item"><div class="label">Anthropic</div><div class="val">claude-sonnet-4-6</div></div>
          <div class="info-item"><div class="label">OpenAI</div><div class="val">gpt-5.4 / gpt-5.5</div></div>
          <div class="info-item"><div class="label">OpenAI</div><div class="val">gpt-5.4-mini</div></div>
          <div class="info-item"><div class="label">DeepSeek</div><div class="val">deepseek-v4-pro</div></div>
          <div class="info-item"><div class="label">Z.AI</div><div class="val">glm-5</div></div>
          <div class="info-item"><div class="label">Minimax</div><div class="val">minimax-m3</div></div>
          <div class="info-item"><div class="label">Google</div><div class="val">gemini-3.1-pro-preview</div></div>
        </div>
      </div>
      <div class="card">
        <h3>OpenAI \u683c\u5f0f (\u901a\u7528)</h3>
        <div class="code-box">curl -s ${safeBaseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -d '{
    "model": "zo:openai/gpt-5.4",
    "messages": [{"role":"user","content":"\u4f60\u597d"}]
  }'</div>
      </div>
      <div class="card">
        <h3>Anthropic \u683c\u5f0f</h3>
        <div class="code-box">curl -s ${safeBaseUrl}/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"\u4f60\u597d"}]
  }'</div>
      </div>
      <div class="card">
        <h3>Claude Code \u914d\u7f6e</h3>
        <div class="code-box">export ANTHROPIC_BASE_URL=${safeBaseUrl}
export ANTHROPIC_API_KEY=\u4f60\u7684GatewayKey

claude</div>
      </div>
      <div class="card">
        <h3>\u8fdc\u7a0b\u5bfc\u5165 Token\uff08\u811a\u672c/\u63d2\u4ef6\u7528\uff09</h3>
        <div class="code-box">curl -X POST ${safeBaseUrl}/admin/tokens \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \\
  -d '{
    "token": "zo_sk_xxx",
    "email": "user@example.com",
    "spaceName": "dandyseal"
  }'</div>
      </div>
    </div>
  </div>
</div>

<!-- Edit Modal -->
<div id="edit-modal" class="modal-overlay hidden">
  <div class="modal">
    <h3>\u7f16\u8f91\u8d26\u53f7\u4fe1\u606f</h3>
    <input type="hidden" id="edit-token-id">
    <div class="input-group">
      <label>\u90ae\u7bb1</label>
      <input type="text" id="edit-email" placeholder="user@example.com">
    </div>
    <div class="input-group">
      <label>Space \u540d\u79f0</label>
      <input type="text" id="edit-space" placeholder="dandyseal">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeEditModal()">\u53d6\u6d88</button>
      <button class="btn btn-primary" onclick="saveEdit()">\u4fdd\u5b58</button>
    </div>
  </div>
</div>

<script>
const BASE = '${safeBaseUrlJs}';
let authKey = '';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toInlineJsArg(value) {
  return escapeHtml(JSON.stringify(String(value)));
}
const PAGE_SIZE = 10;
let tokenPage = 1;
let recentPage = 1;
let allTokens = [];
let currentStrategy = 'round-robin';

const ZO_MODELS = [
  { name: 'claude-opus-4-8', provider: 'anthropic' },
  { name: 'claude-sonnet-4-6', provider: 'anthropic' },
  { name: 'gpt-5.5', provider: 'openai' },
  { name: 'gpt-5.4', provider: 'openai' },
  { name: 'gpt-5.4-mini', provider: 'openai' },
  { name: 'deepseek-v4-pro', provider: 'deepseek' },
  { name: 'glm-5', provider: 'zai' },
  { name: 'minimax-m3', provider: 'minimax' },
  { name: 'gemini-3.1-pro-preview', provider: 'google' },
];

function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function mask(t) {
  if (t.length <= 12) return t;
  return t.slice(0, 8) + '...' + t.slice(-4);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authKey } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderPagination(containerId, total, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  container.classList.remove('hidden');
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  let html = '<div class="info">\u663e\u793a ' + start + '-' + end + ' / \u5171 ' + total + ' \u6761</div><div class="pages">';
  html += '<button class="page-btn" onclick="' + onPageChange + '(' + (currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>&lt;</button>';
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
      if (i === 4 || i === totalPages - 3) html += '<span style="padding:0 6px;color:#a8a29e">...</span>';
      continue;
    }
    html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="' + onPageChange + '(' + i + ')">' + i + '</button>';
  }
  html += '<button class="page-btn" onclick="' + onPageChange + '(' + (currentPage + 1) + ')"' + (currentPage >= totalPages ? ' disabled' : '') + '>&gt;</button>';
  html += '</div>';
  container.innerHTML = html;
}

// Auto login
(function tryAutoLogin() {
  const saved = sessionStorage.getItem('zo_admin_key');
  if (saved) {
    authKey = saved;
    api('GET', '/admin/tokens').then(() => {
      document.getElementById('login-view').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadDashboard();
    }).catch(() => {
      sessionStorage.removeItem('zo_admin_key');
    });
  }
})();

async function login() {
  authKey = document.getElementById('login-key').value.trim();
  if (!authKey) return toast('\u8bf7\u8f93\u5165 Admin Key', false);
  try {
    await api('GET', '/admin/tokens');
    if (document.getElementById('remember-me').checked) {
      sessionStorage.setItem('zo_admin_key', authKey);
    } else {
      sessionStorage.removeItem('zo_admin_key');
    }
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadDashboard();
  } catch (e) { toast(e.message || '\u767b\u5f55\u5931\u8d25', false); }
}

function logout() {
  authKey = '';
  sessionStorage.removeItem('zo_admin_key');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('login-key').value = '';
}

document.getElementById('login-key').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + item.dataset.page).classList.add('active');
    if (item.dataset.page === 'dashboard') loadDashboard();
    if (item.dataset.page === 'tokens') { tokenPage = 1; loadTokens(); }
  });
});

async function loadDashboard() {
  try {
    const data = await api('GET', '/admin/tokens');
    allTokens = data.tokens;
    renderStats(data.tokens, data.pool_status);
    renderModelTags();
    recentPage = 1;
    renderRecent();
    loadStrategy();
  } catch (e) { toast('\u52a0\u8f7d\u5931\u8d25\uff1a' + e.message, false); }
}

async function loadStrategy() {
  try {
    const data = await api('GET', '/admin/strategy');
    currentStrategy = data.strategy || 'round-robin';
    updateStrategyUI();
  } catch (e) { /* ignore */ }
}

function updateStrategyUI() {
  const btnRR = document.getElementById('btn-round-robin');
  const btnSt = document.getElementById('btn-sticky');
  const desc = document.getElementById('strategy-desc');
  btnRR.classList.toggle('active', currentStrategy === 'round-robin');
  btnSt.classList.toggle('active', currentStrategy === 'sticky');
  desc.textContent = currentStrategy === 'round-robin'
    ? '\u6bcf\u6b21\u8c03\u7528\u4f9d\u6b21\u8f6e\u8be2\u6240\u6709 Key'
    : '\u4f18\u5148\u4f7f\u7528\u540c\u4e00\u4e2a Key\uff0c\u5931\u8d25\u540e\u5207\u6362';
}

async function setStrategy(strategy) {
  try {
    await api('PUT', '/admin/strategy', { strategy });
    currentStrategy = strategy;
    updateStrategyUI();
    toast(strategy === 'round-robin' ? '\u5df2\u5207\u6362\u4e3a\u8f6e\u8be2\u6a21\u5f0f' : '\u5df2\u5207\u6362\u4e3a\u586b\u5145\u4f18\u5148\u6a21\u5f0f');
  } catch (e) { toast(e.message, false); }
}

async function loadTokens() {
  try {
    const data = await api('GET', '/admin/tokens');
    allTokens = data.tokens;
    renderTokenList();
  } catch (e) { toast('\u52a0\u8f7d\u5931\u8d25\uff1a' + e.message, false); }
}

function renderStats(tokens, pool) {
  const enabled = tokens.filter(t => t.enabled).length;
  const disabled = tokens.length - enabled;
  const valid = tokens.filter(t => t.status === 'valid').length;
  document.getElementById('s-total').textContent = tokens.length;
  document.getElementById('s-available').textContent = pool.available;
  document.getElementById('s-disabled').textContent = disabled;
  document.getElementById('s-valid').textContent = valid;
  document.getElementById('s-models').textContent = ZO_MODELS.length;
}

function renderModelTags() {
  const container = document.getElementById('model-tags');
  container.innerHTML = ZO_MODELS.map(m =>
    '<span class="model-tag"><span class="dot dot-' + m.provider + '"></span>' + m.name + '</span>'
  ).join('');
}

function goRecentPage(p) {
  const sorted = allTokens.slice().sort((a, b) => b.addedAt - a.addedAt);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  recentPage = p;
  renderRecent();
}

function renderRecent() {
  const tbody = document.getElementById('recent-list');
  const empty = document.getElementById('recent-empty');
  const sorted = allTokens.slice().sort((a, b) => b.addedAt - a.addedAt);
  if (sorted.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); renderPagination('recent-pagination', 0, 1, 'goRecentPage'); return; }
  empty.classList.add('hidden');
  const start = (recentPage - 1) * PAGE_SIZE;
  const page = sorted.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = page.map(t => {
    const st = t.enabled ? '<span class="badge badge-on">\u542f\u7528</span>' : '<span class="badge badge-off">\u7981\u7528</span>';
    return \`<tr>
      <td class="token-mono">\${escapeHtml(t.email || '-')}</td>
      <td>\${escapeHtml(t.spaceName || '-')}</td>
      <td style="color:#a8a29e">\${new Date(t.addedAt).toLocaleDateString('zh-CN')}</td>
      <td>\${st}</td>
    </tr>\`;
  }).join('');
  renderPagination('recent-pagination', sorted.length, recentPage, 'goRecentPage');
}

function goTokenPage(p) {
  const totalPages = Math.ceil(allTokens.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  tokenPage = p;
  renderTokenList();
}

function statusBadge(t) {
  if (t.status === 'valid') return '<span class="badge badge-valid">\u6709\u6548</span>';
  if (t.status === 'invalid') return '<span class="badge badge-invalid">\u5931\u6548</span>' + (t.disableReason ? '<div class="disable-reason">' + escapeHtml(t.disableReason) + '</div>' : '');
  return '<span class="badge badge-unchecked">\u672a\u68c0\u6d4b</span>';
}

function lastCheckedText(t) {
  if (!t.lastChecked) return '';
  return '<div style="font-size:0.7rem;color:#a8a29e;margin-top:2px">' + new Date(t.lastChecked).toLocaleString('zh-CN') + '</div>';
}

function renderTokenList() {
  const tbody = document.getElementById('token-list');
  const empty = document.getElementById('list-empty');
  if (allTokens.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); renderPagination('token-pagination', 0, 1, 'goTokenPage'); return; }
  empty.classList.add('hidden');
  const start = (tokenPage - 1) * PAGE_SIZE;
  const page = allTokens.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = page.map(t => {
    const st = t.enabled ? '<span class="badge badge-on">\u542f\u7528</span>' : '<span class="badge badge-off">\u7981\u7528</span>';
    const tid = String(t.tokenId || '');
    const inlineTid = toInlineJsArg(tid);
    const inlineEmail = toInlineJsArg(t.email || '');
    const inlineSpaceName = toInlineJsArg(t.spaceName || '');
    const tBtn = t.enabled
      ? \`<button class="btn btn-outline btn-sm" onclick="toggleTk(\${inlineTid}, false)">\u7981\u7528</button>\`
      : \`<button class="btn btn-success btn-sm" onclick="toggleTk(\${inlineTid}, true)">\u542f\u7528</button>\`;
    return \`<tr>
      <td class="token-mono">\${escapeHtml(t.email || '-')}</td>
      <td>\${escapeHtml(t.spaceName || '-')}</td>
      <td class="token-mono">\${escapeHtml(t.maskedToken || '')}</td>
      <td style="color:#a8a29e">\${new Date(t.addedAt).toLocaleDateString('zh-CN')}</td>
      <td>\${st}</td>
      <td>\${statusBadge(t)}\${lastCheckedText(t)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="openEdit(\${inlineTid}, \${inlineEmail}, \${inlineSpaceName})">编辑</button>
        <button class="btn btn-outline btn-sm" onclick="checkSingle(\${inlineTid})">\u68c0\u6d4b</button>
        \${tBtn}
        <button class="btn btn-danger btn-sm" onclick="removeTk(\${inlineTid})">删除</button>
      </div></td>
    </tr>\`;
  }).join('');
  renderPagination('token-pagination', allTokens.length, tokenPage, 'goTokenPage');
}

async function addToken() {
  const email = document.getElementById('add-email').value.trim();
  const spaceName = document.getElementById('add-space').value.trim();
  const token = document.getElementById('add-token').value.trim();
  if (!token) return toast('\u8bf7\u8f93\u5165 Token', false);
  try {
    await api('POST', '/admin/tokens', { token, email: email || undefined, spaceName: spaceName || undefined });
    document.getElementById('add-email').value = '';
    document.getElementById('add-space').value = '';
    document.getElementById('add-token').value = '';
    toast('\u6dfb\u52a0\u6210\u529f');
    loadTokens();
  } catch (e) { toast(e.message, false); }
}

function toggleBulk() { document.getElementById('bulk-box').classList.toggle('hidden'); }

async function bulkAdd() {
  const raw = document.getElementById('bulk-tokens').value.trim();
  if (!raw) return toast('\u8bf7\u8f93\u5165 Token', false);
  const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
  let ok = 0, fail = 0;
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    let email = '', spaceName = '', token = '';
    if (parts.length >= 3) {
      email = parts[0]; spaceName = parts[1]; token = parts[2];
    } else if (parts.length === 2) {
      email = parts[0]; token = parts[1];
    } else {
      token = parts[0];
    }
    if (!token) { fail++; continue; }
    try {
      await api('POST', '/admin/tokens', { token, email: email || undefined, spaceName: spaceName || undefined });
      ok++;
    } catch { fail++; }
  }
  document.getElementById('bulk-tokens').value = '';
  toast(\`\u5bfc\u5165\u5b8c\u6210\uff1a\${ok} \u6210\u529f\${fail > 0 ? '\uff0c' + fail + ' \u5931\u8d25' : ''}\`);
  loadTokens();
}

// Edit modal
function openEdit(tokenId, email, spaceName) {
  document.getElementById('edit-token-id').value = tokenId;
  document.getElementById('edit-email').value = email;
  document.getElementById('edit-space').value = spaceName;
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
  const tokenId = document.getElementById('edit-token-id').value;
  const email = document.getElementById('edit-email').value.trim();
  const spaceName = document.getElementById('edit-space').value.trim();
  try {
    await api('PATCH', '/admin/tokens', { tokenId, email, spaceName });
    toast('\u4fdd\u5b58\u6210\u529f');
    closeEditModal();
    loadTokens();
  } catch (e) { toast(e.message, false); }
}

async function removeTk(tokenId) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\uff1f')) return;
  try { await api('DELETE', '/admin/tokens', { tokenId }); toast('\u5df2\u5220\u9664'); loadTokens(); }
  catch (e) { toast(e.message, false); }
}

async function toggleTk(tokenId, enabled) {
  try { await api('PATCH', '/admin/tokens', { tokenId, enabled }); toast(enabled ? '\u5df2\u542f\u7528' : '\u5df2\u7981\u7528'); loadTokens(); }
  catch (e) { toast(e.message, false); }
}

async function checkAllTokens() {
  const btn = document.getElementById('btn-check-all');
  const progress = document.getElementById('check-progress');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinning">\u26a1</span> \u68c0\u6d4b\u4e2d...';
  progress.textContent = '\u6b63\u5728\u68c0\u6d4b\u6240\u6709 Token \u72b6\u6001...';
  try {
    const data = await api('POST', '/admin/check-tokens');
    toast('\u68c0\u6d4b\u5b8c\u6210: ' + data.valid + ' \u6709\u6548, ' + data.invalid + ' \u5931\u6548');
    progress.textContent = '\u4e0a\u6b21\u68c0\u6d4b: ' + new Date().toLocaleString('zh-CN');
    loadTokens();
  } catch (e) {
    toast('\u68c0\u6d4b\u5931\u8d25: ' + e.message, false);
    progress.textContent = '';
  }
  btn.disabled = false;
  btn.innerHTML = '\u26a1 \u4e00\u952e\u68c0\u6d4b\u72b6\u6001';
}

async function checkSingle(tokenId) {
  toast('\u6b63\u5728\u68c0\u6d4b...');
  try {
    const data = await api('POST', '/admin/check-token', { tokenId });
    const msg = data.valid ? '\u6709\u6548' : '\u5931\u6548';
    toast('\u68c0\u6d4b\u7ed3\u679c: ' + msg, data.valid);
    loadTokens();
  } catch (e) {
    toast('\u68c0\u6d4b\u5931\u8d25: ' + e.message, false);
  }
}
</script>
</body>
</html>`;
}
