#!/bin/bash
# 把 mirofish 静态服务安装为开机自启的常驻服务（launchd）。
# 用法：在「终端」里执行   bash /Users/leo/mirofish/install-service.sh
#
# 为什么需要这个脚本：
#   mirofish.uichain.org 由 Cloudflare Tunnel 转发到本机的 3000 端口，
#   所以本机必须有一个服务在 3000 端口上跑着，否则公网就 502。
#   临时起的进程会随终端/会话退出而消失，装成 launchd 服务才能长期稳定
#   （开机自启 + 崩溃自动重启）。

set -e

LABEL="com.mirofish.static"
PLIST_SRC="/Users/leo/Library/LaunchAgents/${LABEL}.plist"
UID_NUM=$(id -u)

echo "==> 安装 ${LABEL}"

# 如果已注册，先卸载，避免 Bootstrap failed: 5 的残留状态
if launchctl print "gui/${UID_NUM}/${LABEL}" >/dev/null 2>&1; then
  echo "    已存在，先卸载旧服务..."
  launchctl bootout "gui/${UID_NUM}/${LABEL}" 2>/dev/null || true
  sleep 1
fi

launchctl bootstrap "gui/${UID_NUM}" "${PLIST_SRC}"
sleep 2

echo "==> 验证"
code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/ || echo 000)
if [ "$code" = "200" ]; then
  echo "    本地 3000 端口: HTTP $code  ✅"
else
  echo "    本地 3000 端口: HTTP $code  ❌  看日志: tail -f /Users/leo/mirofish/serve.log"
  exit 1
fi

echo ""
echo "==> 完成。公网自检:"
pub=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 https://mirofish.uichain.org/ || echo 000)
echo "    https://mirofish.uichain.org -> HTTP $pub"
echo ""
echo "常用命令:"
echo "    停止:  launchctl bootout gui/\$(id -u) ${LABEL}"
echo "    重启:  launchctl kickstart -k gui/\$(id -u) ${LABEL}"
echo "    日志:  tail -f /Users/leo/mirofish/serve.log"
