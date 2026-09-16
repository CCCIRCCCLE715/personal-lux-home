# Kimi 本地接管说明

项目目录：`/Users/huangshaoshuai/Desktop/3D/personal-lux-home`

## 打开网站

在项目目录执行：

```bash
./start-local.sh
```

看到 `Local: http://localhost:5178/` 后，在同一台电脑打开：

```text
http://127.0.0.1:5178/
```

脚本会在系统找不到 `node` 时自动使用本机 Codex 自带的 Node.js，解决直接执行 `pnpm dev` 时出现的 `node: not found`。

如果 Kimi 运行在独立云端或容器里，它的 `localhost` 指向 Kimi 自己的环境。此时需要让 Kimi 在上述项目目录运行脚本，或者从同一局域网访问终端显示的 `Network` 地址。

## Git 状态

这是独立本地仓库，默认分支为 `main`，没有远程仓库。开始修改前先运行：

```bash
git status
git log -1 --oneline
```

不得提交 API Key、`.env`、`*-private.json` 或 `*-provider.json`。不要修改同级的另外两个网站项目。
