import { forwardNonStreaming, buildStreamingResponse, forwardOpenAINonStreaming, buildOpenAIStreamingResponse, UpstreamError } from './converter';
import { getAdminHTML } from './admin';
import { pickToken, markFailed, markSuccess, getPoolStatus } from './key-pool';
import type { DispatchStrategy } from './key-pool';
import { getTokens, addToken, removeToken, toggleToken, updateToken, getEnabledTokenStrings, updateTokenStatus, autoDisableToken, tokenToId, maskToken, findTokenById } from './token-store';
import { getLogs, addLog } from './call-log';
import { checkTokenValidity } from './key-checker';
import { FAVICON_SVG } from './favicon';
import type { AnthropicRequest, OpenAIChatRequest } from './types';
import type { KeyPoolConfig } from './key-pool';

interface Env {
  KV: KVNamespace;
  GATEWAY_KEY?: string;
  ADMIN_KEY?: string;
  ZO_TOKENS?: string;
  COOLDOWN_MS?: string;
}

const ZO_MODELS = [
  { id: 'zo:anthropic/claude-opus-4-8', owned_by: 'Anthropic' },
  { id: 'zo:anthropic/claude-sonnet-4-6', owned_by: 'Anthropic' },
  { id: 'zo:openai/gpt-5.5', owned_by: 'OpenAI' },
  { id: 'zo:openai/gpt-5.4', owned_by: 'OpenAI' },
  { id: 'zo:openai/gpt-5.4-mini', owned_by: 'OpenAI' },
  { id: 'zo:deepseek/deepseek-v4-pro', owned_by: 'DeepSeek' },
  { id: 'zo:zai/glm-5', owned_by: 'Z.AI' },
  { id: 'zo:minimax/minimax-m3', owned_by: 'Minimax' },
  { id: 'zo:google/gemini-3.1-pro-preview', owned_by: 'Google' },
];

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, anthropic-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'content-type',
  };
}

function extractClientKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) return apiKey;
  return null;
}

function errorResponse(status: number, type: string, message: string): Response {
  return new Response(
    JSON.stringify({ type: 'error', error: { type, message } }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
  );
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function parseJsonObjectBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isJsonObject(body) ? body : null;
  } catch {
    return null;
  }
}

function validateOpenAIToolCallArguments(body: OpenAIChatRequest): string | null {
  for (const rawMsg of body.messages as unknown[]) {
    if (!isJsonObject(rawMsg)) {
      return 'messages[] must be JSON objects.';
    }
    if (rawMsg.tool_calls === undefined) continue;
    if (rawMsg.role !== 'assistant') continue;
    if (!Array.isArray(rawMsg.tool_calls)) {
      return 'tool_calls must be an array.';
    }
    for (const rawToolCall of rawMsg.tool_calls) {
      if (!isJsonObject(rawToolCall) || !isJsonObject(rawToolCall.function)) {
        return 'tool_calls[] must contain function objects.';
      }
      if (typeof rawToolCall.function.arguments !== 'string') {
        return 'tool_calls[].function.arguments must be a JSON string.';
      }
      try {
        const parsed = JSON.parse(rawToolCall.function.arguments);
        if (!isJsonObject(parsed)) {
          return 'tool_calls[].function.arguments must be a JSON object.';
        }
      } catch {
        return 'tool_calls[].function.arguments must be valid JSON.';
      }
    }
  }
  return null;
}

function parseEnvTokens(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

const KV_STRATEGY_KEY = 'dispatch_strategy';

async function getDispatchStrategy(kv?: KVNamespace): Promise<DispatchStrategy> {
  if (!kv) return 'round-robin';
  const val = await kv.get(KV_STRATEGY_KEY);
  if (val === 'sticky') return 'sticky';
  return 'round-robin';
}

async function setDispatchStrategy(kv: KVNamespace, strategy: DispatchStrategy): Promise<void> {
  await kv.put(KV_STRATEGY_KEY, strategy);
}

async function buildPoolConfig(env: Env): Promise<KeyPoolConfig | null> {
  const cooldownMs = parseInt(env.COOLDOWN_MS || '60000', 10);
  const strategy = await getDispatchStrategy(env.KV);

  if (env.KV) {
    const kvTokens = await getEnabledTokenStrings(env.KV);
    if (kvTokens.length > 0) {
      return { tokens: kvTokens, cooldownMs, strategy };
    }
  }

  if (env.ZO_TOKENS) {
    const envTokens = parseEnvTokens(env.ZO_TOKENS);
    if (envTokens.length > 0) {
      return { tokens: envTokens, cooldownMs, strategy };
    }
  }

  return null;
}

function isGatewayMode(env: Env): boolean {
  return !!env.GATEWAY_KEY;
}

function getAdminConfigError(env: Env): string | null {
  if (!env.ADMIN_KEY) return 'Admin access is unavailable.';
  if (env.GATEWAY_KEY && env.ADMIN_KEY === env.GATEWAY_KEY) {
    return 'Admin access is unavailable.';
  }
  return null;
}

function verifyAdmin(request: Request, env: Env): Response | null {
  const configError = getAdminConfigError(env);
  if (configError) {
    return jsonResponse({ error: configError }, 503);
  }
  const key = extractClientKey(request);
  if (key !== env.ADMIN_KEY) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  return null;
}

function resolveToken(clientKey: string, env: Env, poolConfig: KeyPoolConfig | null): string | null {
  const gatewayMode = isGatewayMode(env);
  if (gatewayMode) {
    if (clientKey !== env.GATEWAY_KEY) return null;
    if (!poolConfig) return '';
    return pickToken(poolConfig);
  }
  return clientKey;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Favicon
    if ((url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico') && request.method === 'GET') {
      return new Response(FAVICON_SVG.trim(), {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=604800',
          ...corsHeaders(),
        },
      });
    }

    // Admin panel
    if ((url.pathname === '/' || url.pathname === '/admin') && request.method === 'GET') {
      const adminConfigError = getAdminConfigError(env);
      if (adminConfigError) {
        return new Response(adminConfigError, {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
        });
      }
      const baseUrl = `${url.protocol}//${url.host}`;
      return new Response(getAdminHTML(baseUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
      });
    }

    // Models list (OpenAI compatible)
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      const now = Math.floor(Date.now() / 1000);
      const data = ZO_MODELS.map((m) => ({
        id: m.id,
        object: 'model',
        created: now,
        owned_by: m.owned_by,
      }));
      return jsonResponse({ object: 'list', data });
    }

    // Admin API - tokens
    if (url.pathname === '/admin/tokens') {
      const adminAuth = verifyAdmin(request, env);
      if (adminAuth) {
        return adminAuth;
      }

      if (request.method === 'GET') {
        const tokens = await getTokens(env.KV);
        const poolConfig = await buildPoolConfig(env);
        const poolStatus = poolConfig ? getPoolStatus(poolConfig) : { total: 0, available: 0 };
        const safeTokens = tokens.map((t) => ({
          tokenId: tokenToId(t.token),
          maskedToken: maskToken(t.token),
          email: t.email || '',
          spaceName: t.spaceName || '',
          addedAt: t.addedAt,
          enabled: t.enabled,
          lastChecked: t.lastChecked || null,
          status: t.status || 'unchecked',
          disableReason: t.disableReason || '',
        }));
        return jsonResponse({ tokens: safeTokens, pool_status: poolStatus });
      }

      if (request.method === 'POST') {
        const body = await parseJsonObjectBody(request);
        if (!body) return jsonResponse({ error: 'Invalid JSON body.' }, 400);
        if (!isNonEmptyString(body.token)) return jsonResponse({ error: 'token must be a non-empty string.' }, 400);
        if (!isOptionalString(body.email) || !isOptionalString(body.spaceName)) {
          return jsonResponse({ error: 'email and spaceName must be strings.' }, 400);
        }
        try {
          const tokens = await addToken(env.KV, body.token, body.email, body.spaceName);
          return jsonResponse({ ok: true, count: tokens.length });
        } catch (e) {
          return jsonResponse({ error: (e as Error).message }, 400);
        }
      }

      if (request.method === 'DELETE') {
        const body = await parseJsonObjectBody(request);
        if (!body) return jsonResponse({ error: 'Invalid JSON body.' }, 400);
        if (body.token !== undefined && !isNonEmptyString(body.token)) {
          return jsonResponse({ error: 'token must be a non-empty string.' }, 400);
        }
        if (body.tokenId !== undefined && !isNonEmptyString(body.tokenId)) {
          return jsonResponse({ error: 'tokenId must be a non-empty string.' }, 400);
        }
        const rawToken = body.token || (body.tokenId ? await findTokenById(env.KV, body.tokenId) : null);
        if (!rawToken) return jsonResponse({ error: 'token or tokenId is required' }, 400);
        const tokens = await removeToken(env.KV, rawToken);
        return jsonResponse({ ok: true, count: tokens.length });
      }

      if (request.method === 'PATCH') {
        const body = await parseJsonObjectBody(request);
        if (!body) return jsonResponse({ error: 'Invalid JSON body.' }, 400);
        if (body.token !== undefined && !isNonEmptyString(body.token)) {
          return jsonResponse({ error: 'token must be a non-empty string.' }, 400);
        }
        if (body.tokenId !== undefined && !isNonEmptyString(body.tokenId)) {
          return jsonResponse({ error: 'tokenId must be a non-empty string.' }, 400);
        }
        if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
          return jsonResponse({ error: 'enabled must be a boolean.' }, 400);
        }
        if (!isOptionalString(body.email) || !isOptionalString(body.spaceName)) {
          return jsonResponse({ error: 'email and spaceName must be strings.' }, 400);
        }
        const rawToken = body.token || (body.tokenId ? await findTokenById(env.KV, body.tokenId) : null);
        if (!rawToken) return jsonResponse({ error: 'token or tokenId is required' }, 400);
        if (body.enabled !== undefined) {
          const tokens = await toggleToken(env.KV, rawToken, body.enabled);
          return jsonResponse({ ok: true, count: tokens.length });
        }
        if (body.email !== undefined || body.spaceName !== undefined) {
          try {
            const tokens = await updateToken(env.KV, rawToken, { email: body.email, spaceName: body.spaceName });
            return jsonResponse({ ok: true, count: tokens.length });
          } catch (e) {
            return jsonResponse({ error: (e as Error).message }, 400);
          }
        }
        return jsonResponse({ error: 'No update fields provided' }, 400);
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Admin API - check tokens (validate and auto-disable)
    if (url.pathname === '/admin/check-tokens' && request.method === 'POST') {
      const adminAuth = verifyAdmin(request, env);
      if (adminAuth) {
        return adminAuth;
      }

      const tokens = await getTokens(env.KV);
      const results: Array<{
        tokenId: string;
        maskedToken: string;
        email: string;
        valid: boolean;
        httpStatus: number;
        error?: string;
        disabled: boolean;
      }> = [];

      for (const t of tokens) {
        const check = await checkTokenValidity(t.token);
        const disabled = !check.valid;
        if (check.valid) {
          await updateTokenStatus(env.KV, t.token, 'valid');
        } else {
          await updateTokenStatus(env.KV, t.token, 'invalid', `auto-check: HTTP ${check.httpStatus}`);
        }
        results.push({
          tokenId: tokenToId(t.token),
          maskedToken: maskToken(t.token),
          email: t.email || '',
          valid: check.valid,
          httpStatus: check.httpStatus,
          error: check.error,
          disabled,
        });
      }

      const invalidCount = results.filter((r) => !r.valid).length;
      return jsonResponse({
        ok: true,
        total: results.length,
        valid: results.length - invalidCount,
        invalid: invalidCount,
        results,
      });
    }

    // Admin API - check single token
    if (url.pathname === '/admin/check-token' && request.method === 'POST') {
      const adminAuth = verifyAdmin(request, env);
      if (adminAuth) {
        return adminAuth;
      }

      const body = await parseJsonObjectBody(request);
      if (!body) return jsonResponse({ error: 'Invalid JSON body.' }, 400);
      if (body.token !== undefined && !isNonEmptyString(body.token)) {
        return jsonResponse({ error: 'token must be a non-empty string.' }, 400);
      }
      if (body.tokenId !== undefined && !isNonEmptyString(body.tokenId)) {
        return jsonResponse({ error: 'tokenId must be a non-empty string.' }, 400);
      }
      const rawToken = body.token || (body.tokenId ? await findTokenById(env.KV, body.tokenId) : null);
      if (!rawToken) return jsonResponse({ error: 'token or tokenId is required' }, 400);

      const validity = await checkTokenValidity(rawToken);

      if (validity.valid) {
        await updateTokenStatus(env.KV, rawToken, 'valid');
      } else {
        await updateTokenStatus(env.KV, rawToken, 'invalid', `auto-check: HTTP ${validity.httpStatus}`);
      }

      return jsonResponse({
        ok: true,
        valid: validity.valid,
        httpStatus: validity.httpStatus,
        error: validity.error,
      });
    }

    // Admin API - dispatch strategy
    if (url.pathname === '/admin/strategy') {
      const adminAuth = verifyAdmin(request, env);
      if (adminAuth) {
        return adminAuth;
      }

      if (request.method === 'GET') {
        const strategy = await getDispatchStrategy(env.KV);
        return jsonResponse({ strategy });
      }

      if (request.method === 'PUT') {
        const parsed = await parseJsonObjectBody(request);
        if (!parsed) return jsonResponse({ error: 'Invalid JSON body.' }, 400);
        const body = parsed as { strategy?: string };
        if (body.strategy !== 'round-robin' && body.strategy !== 'sticky') {
          return jsonResponse({ error: 'strategy must be "round-robin" or "sticky"' }, 400);
        }
        await setDispatchStrategy(env.KV, body.strategy);
        return jsonResponse({ ok: true, strategy: body.strategy });
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Admin API - logs
    if (url.pathname === '/admin/logs' && request.method === 'GET') {
      const adminAuth = verifyAdmin(request, env);
      if (adminAuth) {
        return adminAuth;
      }
      const logs = await getLogs(env.KV);
      return jsonResponse({ logs });
    }

    // Anthropic Messages endpoint
    if (url.pathname === '/v1/messages' && request.method === 'POST') {
      const clientKey = extractClientKey(request);
      if (!clientKey) {
        return errorResponse(401, 'authentication_error',
          'Missing API key. Pass it via Authorization: Bearer <token> or x-api-key header.');
      }

      const poolConfig = await buildPoolConfig(env);
      const zoToken = resolveToken(clientKey, env, poolConfig);

      if (zoToken === null) {
        return errorResponse(401, 'authentication_error', 'Invalid API key.');
      }

      if (!zoToken) {
        return errorResponse(503, 'api_error', 'No upstream tokens available.');
      }

      let body: AnthropicRequest;
      try {
        body = (await request.json()) as AnthropicRequest;
      } catch {
        return errorResponse(400, 'invalid_request_error', 'Invalid JSON body.');
      }

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        return errorResponse(400, 'invalid_request_error', 'messages is required and must be a non-empty array.');
      }
      if (!body.model) {
        return errorResponse(400, 'invalid_request_error', 'model is required.');
      }

      const maxRetries = poolConfig ? poolConfig.tokens.length : 1;
      const startTime = Date.now();

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const token = attempt === 0 ? zoToken : pickToken(poolConfig!);
        if (!token) {
          return errorResponse(503, 'api_error', 'All upstream tokens are unavailable.');
        }

        try {
          if (body.stream) {
            const resp = await buildStreamingResponse(body, token);
            markSuccess(token);
            ctx.waitUntil(addLog(env.KV, body.model, 'anthropic', 'ok', Date.now() - startTime).catch(() => {}));
            return resp;
          }

          const result = await forwardNonStreaming(body, token);
          markSuccess(token);
          ctx.waitUntil(addLog(env.KV, body.model, 'anthropic', 'ok', Date.now() - startTime).catch(() => {}));
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          });
        } catch (err) {
          const message = (err as Error).message || 'Internal server error';
          const upstreamStatus = err instanceof UpstreamError ? err.status : 0;
          const isAuthError = upstreamStatus === 401 || upstreamStatus === 403;
          const isRetryable = isAuthError || upstreamStatus === 429;

          if (isAuthError && env.KV) {
            ctx.waitUntil(autoDisableToken(env.KV, token, `request-error: ${message}`).catch(() => {}));
          }

          if (isRetryable && poolConfig) {
            markFailed(token);
            continue;
          }

          ctx.waitUntil(addLog(env.KV, body.model, 'anthropic', 'error', Date.now() - startTime, message).catch(() => {}));
          const status = upstreamStatus === 401 ? 401
            : upstreamStatus === 429 ? 429
            : upstreamStatus === 403 ? 403
            : 502;
          return errorResponse(status, 'api_error', message);
        }
      }

      ctx.waitUntil(addLog(env.KV, body.model, 'anthropic', 'error', Date.now() - startTime, 'All tokens exhausted').catch(() => {}));
      return errorResponse(503, 'api_error', 'All upstream tokens exhausted after retries.');
    }

    // OpenAI Chat Completions endpoint
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      const clientKey = extractClientKey(request);
      if (!clientKey) {
        return errorResponse(401, 'authentication_error',
          'Missing API key. Pass it via Authorization: Bearer <token> or x-api-key header.');
      }

      const poolConfig = await buildPoolConfig(env);
      const zoToken = resolveToken(clientKey, env, poolConfig);

      if (zoToken === null) {
        return errorResponse(401, 'authentication_error', 'Invalid API key.');
      }

      if (!zoToken) {
        return errorResponse(503, 'api_error', 'No upstream tokens available.');
      }

      let body: OpenAIChatRequest;
      try {
        body = (await request.json()) as OpenAIChatRequest;
      } catch {
        return errorResponse(400, 'invalid_request_error', 'Invalid JSON body.');
      }

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        return errorResponse(400, 'invalid_request_error', 'messages is required and must be a non-empty array.');
      }
      if (!body.model) {
        return errorResponse(400, 'invalid_request_error', 'model is required.');
      }
      const toolCallArgumentsError = validateOpenAIToolCallArguments(body);
      if (toolCallArgumentsError) {
        return errorResponse(400, 'invalid_request_error', toolCallArgumentsError);
      }

      const maxRetries = poolConfig ? poolConfig.tokens.length : 1;
      const startTime = Date.now();

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const token = attempt === 0 ? zoToken : pickToken(poolConfig!);
        if (!token) {
          return errorResponse(503, 'api_error', 'All upstream tokens are unavailable.');
        }

        try {
          if (body.stream) {
            const resp = await buildOpenAIStreamingResponse(body, token);
            markSuccess(token);
            ctx.waitUntil(addLog(env.KV, body.model, 'openai', 'ok', Date.now() - startTime).catch(() => {}));
            return resp;
          }

          const result = await forwardOpenAINonStreaming(body, token);
          markSuccess(token);
          addLog(env.KV, body.model, 'openai', 'ok', Date.now() - startTime).catch(() => {});
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          });
        } catch (err) {
          const message = (err as Error).message || 'Internal server error';
          const upstreamStatus = err instanceof UpstreamError ? err.status : 0;
          const isAuthError = upstreamStatus === 401 || upstreamStatus === 403;
          const isRetryable = isAuthError || upstreamStatus === 429;

          if (isAuthError && env.KV) {
            ctx.waitUntil(autoDisableToken(env.KV, token, `request-error: ${message}`).catch(() => {}));
          }

          if (isRetryable && poolConfig) {
            markFailed(token);
            continue;
          }

          ctx.waitUntil(addLog(env.KV, body.model, 'openai', 'error', Date.now() - startTime, message).catch(() => {}));
          const status = upstreamStatus === 401 ? 401
            : upstreamStatus === 429 ? 429
            : upstreamStatus === 403 ? 403
            : 502;
          return errorResponse(status, 'api_error', message);
        }
      }

      ctx.waitUntil(addLog(env.KV, body.model, 'openai', 'error', Date.now() - startTime, 'All tokens exhausted').catch(() => {}));
      return errorResponse(503, 'api_error', 'All upstream tokens exhausted after retries.');
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
