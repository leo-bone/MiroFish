# MiroFish · 群体智能仿真实验室

浏览器里直接跑的群体行为仿真 + AI 解读。

🌐 线上地址：https://mirofish.uichain.org
🔌 AI 后端：https://api.mirofish.uichain.org （Cloudflare Worker + DeepSeek）

## 三个仿真模型

全部为纯前端实现，零依赖、无需后端即可运行。

| 模型 | 演示什么 | 关键指标 |
|---|---|---|
| 🐟 **鱼群涌现 Boids** | 分离/对齐/聚合三条局部规则 → 全局秩序 | 极化度、平均邻居数 |
| 📈 **市场羊群效应** | 私有信号 + 邻居跟风 → 价格形成 | 羊群指数、波动率、基差 |
| 📣 **舆情扩散 SIR** | 网络传播动力学 | R₀ = β·k/γ、感染峰值 |

参数实时可调、指标实时计算。**Boids 的"对齐权重"拉回 0，整群当场散架；
SIR 的传播率从 0.06 推到 0.25，曲线从"冒个泡"变成指数级爆发** —— 涌现是看得见的。

## AI 解读（可选）

右下角「AI 解读」把当前仿真的实时指标打包发给后端，由 DeepSeek 给出机制解释和调参建议。

- **只在用户点击时触发一次**，不做轮询、不跟随帧循环
- 单次成本约 **¥0.001**（280 输入 + 286 输出 tokens）
- 输入截断 1500 字符、输出上限 800 tokens
- 边缘限流：每 IP 每 10 秒最多 5 次（Cloudflare WAF）

### 后端自检

```bash
curl https://api.mirofish.uichain.org/
```
返回 key 配置状态与账户余额，**不消耗任何 token**。

## 本地运行

```bash
python3 serve.py              # 默认 http://127.0.0.1:3000
python3 -m http.server 3000   # 等价的最小方式
```

> ⚠️ 用 `file://` 直接打开 HTML 时，浏览器会拦截跨域请求，AI 解读不可用。
> 必须通过 http 访问。

## 部署架构

**前端**（静态）走 Cloudflare Tunnel：

```
mirofish.uichain.org  →  Cloudflare Tunnel  →  localhost:3000  →  serve.py
```

因此本机需有服务监听 3000 端口，否则公网 502。安装为常驻服务：

```bash
bash install-service.sh      # 注册 launchd 服务 com.mirofish.static
```

**后端**（AI 解读）走独立的 Cloudflare Worker：

```
api.mirofish.uichain.org  →  Worker "mirofish-api"  →  DeepSeek API
```

```bash
cd workers
wrangler secret put DEEPSEEK_API_KEY    # 密钥只以加密形式存储
wrangler deploy
```

| 文件 | 说明 |
|---|---|
| `index.html` | 主页面（仿真引擎 + AI 面板） |
| `guide.html` | 使用说明 |
| `serve.py` | 静态文件服务（标准库，零依赖，多线程） |
| `install-service.sh` | 安装 launchd 常驻服务 |
| `workers/api/interpret.js` | AI 解读 Worker（CORS、截断、错误映射） |
| `workers/wrangler.toml` | Worker 配置（**不含任何密钥**） |

## 安全约定

- 密钥**只**通过 `wrangler secret put` 写入，绝不进仓库、绝不写进 `wrangler.toml`
- 仓库里的 `wrangler.toml` 不含任何凭据
- AI 调用有输入/输出上限与边缘限流，防止公开站点被批量刷
