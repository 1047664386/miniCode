#!/usr/bin/env bash
#
# start-opensvcode.sh
# -------------------
# 启动 code-server (Coder 维护，跨平台 VSCode 浏览器版)
# 说明：OpenVSCode-Server 已不再发布 macOS 包，故改用 code-server
# 第一次运行会自动下载 ~80MB 的 release tar 包

# 开启严格模式：遇到错误立即退出，管道中任一命令失败则整体失败
set -euo pipefail

# ===================== 配置项 =====================
# code-server 版本号，可通过环境变量 CODE_SERVER_VERSION 覆盖
VERSION="${CODE_SERVER_VERSION:-4.122.0}"
# 安装目录，可通过环境变量 CODE_SERVER_DIR 覆盖，默认存放在用户目录下
DIR="${CODE_SERVER_DIR:-$HOME/.minicodeide/code-server}"
# 监听端口，可通过环境变量 CODE_SERVER_PORT 覆盖，默认 8000
PORT="${CODE_SERVER_PORT:-8000}"
# 工作目录，可通过环境变量 WORKSPACE 覆盖，默认当前目录
WORKSPACE="${WORKSPACE:-$(pwd)}"

# ===================== 平台架构判断 =====================
# 根据操作系统和架构选择对应的 code-server 包名
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)    ARCH="macos-arm64" ;;
  Darwin-x86_64)  ARCH="macos-amd64" ;;
  Linux-x86_64)   ARCH="linux-amd64" ;;
  Linux-aarch64)  ARCH="linux-arm64" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

# 二进制文件路径：安装目录下对应版本+架构的 code-server 可执行文件
BIN_DIR="${DIR}/code-server-${VERSION}-${ARCH}"
BIN="${BIN_DIR}/bin/code-server"

# ===================== 自动下载 =====================
# 如果二进制文件不存在，执行下载和解压
if [ ! -x "$BIN" ]; then
  mkdir -p "$DIR"
  # 构建下载 URL
  URL="https://github.com/coder/code-server/releases/download/v${VERSION}/code-server-${VERSION}-${ARCH}.tar.gz"
  echo "[code-server] downloading ${URL}"
  # 下载 tar 包
  curl -fL "$URL" -o "${DIR}/code-server.tar.gz"
  # 解压到目标目录
  tar -xzf "${DIR}/code-server.tar.gz" -C "$DIR"
  # 删除临时下载文件
  rm "${DIR}/code-server.tar.gz"
fi

# ===================== 启动 code-server =====================
echo "[code-server] starting on port ${PORT}, workspace=${WORKSPACE}"
exec "$BIN" \
  --bind-addr "0.0.0.0:${PORT}" `# 监听所有网络接口，方便 Electron 内访问` \
  --auth none `# 跳过密码验证，仅本地/可信网络使用` \
  --disable-telemetry `# 关闭遥测数据上报` \
  --disable-update-check `# 禁用自动更新检查，避免后台请求` \
  --user-data-dir "${DIR}/user-data" `# 指定独立用户数据目录，避免污染本机 VSCode 配置` \
  --extensions-dir "${DIR}/extensions" `# 指定独立扩展目录，避免与本机扩展冲突` \
  "$WORKSPACE" `# 打开指定的工作目录`