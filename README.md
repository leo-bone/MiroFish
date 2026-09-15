# MiroFish · 群体智能仿真控制台

多智能体群体行为的仿真与推演工作台，内置三个场景。纯前端静态站点，无后端依赖。

🌐 线上地址：https://mirofish.uichain.org

## 页面

| 文件 | 说明 |
|---|---|
| `index.html` | 三场景控制台主页面 |
| `guide.html` | 使用说明 |

## 本地运行

```bash
python3 serve.py          # 默认 http://127.0.0.1:3000
python3 -m http.server 3000   # 等价的最小方式
```

## 部署架构

站点通过 **Cloudflare Tunnel** 暴露到公网，隧道把 `mirofish.uichain.org`
转发到本机的 `3000` 端口：

```
mirofish.uichain.org  →  Cloudflare Tunnel  →  localhost:3000  →  serve.py
```

因此**本机必须有一个服务在 3000 端口上运行**，否则公网会返回 502。
临时启动的进程会随终端退出而消失，建议安装为常驻服务：

```bash
bash install-service.sh
```

该脚本把 `serve.py` 注册为 launchd 服务（标签 `com.mirofish.static`），
开机自启、崩溃自动重启。

常用命令：

```bash
launchctl kickstart -k gui/$(id -u) com.mirofish.static   # 重启
launchctl bootout   gui/$(id -u) com.mirofish.static      # 停止
tail -f serve.log                                          # 看日志
```

> 注意：由于依赖本机常驻进程，电脑关机或休眠时站点会不可访问。
> 若需 7×24 可用，应改为部署到 Cloudflare Pages 等静态托管。

## 文件说明

| 文件 | 说明 |
|---|---|
| `serve.py` | 静态文件服务（标准库实现，零依赖，多线程） |
| `install-service.sh` | 安装 launchd 常驻服务 |
| `serve.log` | 服务日志（安装后生成） |
