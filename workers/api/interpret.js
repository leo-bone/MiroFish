// Cloudflare Worker - MiroFish 仿真解读后端
// 设计原则：AI 调用只能由用户显式点击触发，绝不自动/循环调用，成本可控。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const MAX_INPUT = 1500;   // 用户问题长度上限
const MAX_OUTPUT = 800;   // 回答长度上限

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // GET /  —— 自检通道，不消耗任何 token
    if (request.method === 'GET') {
      const key = env.DEEPSEEK_API_KEY || '';
      let balance = null;
      if (key) {
        try {
          const r = await fetch('https://api.deepseek.com/user/balance', {
            headers: { Authorization: `Bearer ${key}` },
          });
          const j = await r.json();
          const info = (j.balance_infos || [])[0] || {};
          balance = {
            available: j.is_available,
            currency: info.currency,
            total: Number(info.total_balance || 0).toFixed(2),
            granted: Number(info.granted_balance || 0).toFixed(2),
            topped_up: Number(info.topped_up_balance || 0).toFixed(2),
          };
        } catch (e) {
          balance = { available: false, error: String(e) };
        }
      }
      return new Response(
        JSON.stringify(
          {
            service: 'mirofish-api',
            model: 'deepseek-chat',
            api_key_configured: Boolean(key),
            api_key_prefix: key ? `${key.slice(0, 6)}...` : null,
            max_input_chars: MAX_INPUT,
            max_output_tokens: MAX_OUTPUT,
            note: 'AI 调用仅由用户显式点击触发，不存在轮询或循环调用。',
            balance,
          },
          null,
          2
        ),
        { headers: CORS }
      );
    }

    if (request.method !== 'POST' || url.pathname !== '/api/interpret') {
      return new Response(
        JSON.stringify({ error: 'Not Found', hint: '请使用 POST /api/interpret' }),
        { status: 404, headers: CORS }
      );
    }

    const key = env.DEEPSEEK_API_KEY || '';
    if (!key) {
      return json(
        {
          error: 'DEEPSEEK_API_KEY 未配置',
          detail: 'Worker -> Settings -> Variables and Secrets 里添加 DEEPSEEK_API_KEY（加密），重新部署后生效。',
        },
        500
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: '请求体不是合法 JSON' }, 400);
    }

    const question = String(payload.question || '').slice(0, MAX_INPUT).trim();
    const snapshot = String(payload.snapshot || '').slice(0, MAX_INPUT);
    const scene = String(payload.scene || '').slice(0, 60);

    if (!question) {
      return json({ error: '缺少 question 字段' }, 400);
    }

    const systemPrompt =
      '你是群体智能仿真领域的分析师。用户正在一个交互式仿真实验室里操作模型，' +
      '请你基于他给出的实时仿真数据，用中文给出简洁、具体、有洞察的解读。\n' +
      '要求：\n' +
      '1. 直接说结论，不要复述数据，不要客套，不要说"作为一个AI"。\n' +
      '2. 解释**为什么会这样**（机制层面），而不是描述现象。\n' +
      '3. 如果用户问"怎么调"，给出具体的参数方向（提高/降低哪个参数、大概到多少）。\n' +
      '4. 300 字以内，可以用短句列表。\n' +
      '5. 涉及 R₀、极化度、羊群指数这类指标时，说清楚它的临界值含义。';

    const userContent =
      `【仿真场景】${scene || '未指定'}\n` +
      `【当前实时数据】\n${snapshot || '（无）'}\n\n` +
      `【用户的问题】\n${question}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 45000);

    let upstream;
    try {
      upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          stream: false,
          temperature: 0.7,
          max_tokens: MAX_OUTPUT,
        }),
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e && e.name === 'AbortError'
        ? '上游响应超时（45 秒），请重试一次。'
        : `网络请求失败：${String(e)}`;
      return json({ error: '请求上游失败', detail: msg }, 502);
    }
    clearTimeout(timer);

    if (!upstream.ok) {
      let body = '';
      try {
        body = await upstream.text();
      } catch { /* ignore */ }
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch { /* not json */ }
      return json(
        {
          error: `DeepSeek API ${upstream.status}`,
          detail: parsed?.error?.message || body.slice(0, 300) || '上游返回错误但无具体原因。',
        },
        upstream.status === 402 ? 200 : 502
      );
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      return json({ error: '上游返回的不是合法 JSON' }, 502);
    }

    const answer = (data.choices?.[0]?.message?.content || '').trim();
    if (!answer) {
      return json({ error: '上游返回空回答' }, 502);
    }

    return json({
      answer,
      usage: data.usage || null,
      model: data.model || 'deepseek-chat',
    });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
