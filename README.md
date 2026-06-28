# LeonBos 1.0.1

LeonBos 是一款企业级反指纹浏览器控制台，用于多账号资产管理、会话控制、配置编排与运营监控。

## 产品定位

- 企业级浏览器资产管理
- 统一的指纹模板与代理配置
- 会话启动、关闭与审计记录
- Web 控制台与 Electron 桌面壳
- MCP Server 与插件集成中心

## 发布物料

- `src/ui/public/logo/leonbos-logo.png` - 官方品牌 logo
- `src/desktop/icons/icon.ico` - Windows 桌面、任务栏、安装包图标
- `src/desktop/icons/icon.png` - 桌面图标 PNG 资产
- `src/desktop/main.js` - Electron 主进程入口
- `src/desktop/preload.js` - Electron preload 安全桥接
- `src/ui/public/about.html` - 关于页
- `src/ui/public/index.html` - 主控制台
- `src/ui/public/integrations.js` - MCP 和插件集成中心前端
- `package.json` - 版本号与启动入口

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动 Web 控制台

```bash
npm run ui
```

打开：`http://localhost:3000`

### 启动桌面版

```bash
npm run desktop
```

### 打包 Windows 安装包

```bash
npm run dist:win
```

输出目录：`release/`

安装包：`release/LeonBos Setup 1.0.1.exe`

### 关于页

打开：`http://localhost:3000/about`

## 版本信息

- 产品名：LeonBos
- 版本：1.0.1
- 发布类型：正式版物料基线
- 桌面壳：Electron
- 打包器：electron-builder

## 目录结构

```text
LeonBos/
├── src/
│   ├── cli.js
│   ├── main.js
│   ├── core/
│   ├── desktop/
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── icons/
│   │       ├── icon.ico
│   │       └── icon.png
│   └── ui/
│       ├── server.js
│       └── public/
│           ├── index.html
│           ├── about.html
│           ├── plus.css
│           ├── plus.js
│           └── logo/
│               └── leonbos-logo.png
├── database/
│   └── schema.sql
└── package.json
```

## 说明

当前版本已统一：

- 窗口标题
- favicon
- 品牌 logo
- 关于页
- README 发布说明
- 版本号
- Electron 桌面窗口
- Windows 任务栏、托盘和安装包图标
- 关闭到托盘
- MCP Server 注册、启停、检测和删除
- 插件注册、启停、检测和删除

## 集成中心

LeonBos 现在内置 `MCPs & Plugins` 集成中心，用于管理后续扩展能力。

当前第一版支持：

- MCP Server 配置登记
- stdio / HTTP 两类 MCP 连接信息
- MCP 参数和环境变量 JSON 配置
- 插件入口、版本、分类、权限和配置登记
- 启用 / 停用
- 状态检测占位
- 删除集成项

说明：当前版本只做安全的注册表和治理界面，不直接执行外部 MCP 命令或插件代码。后续可以在此基础上增加受控运行时、权限确认、日志审计和沙箱执行。

## Windows 发布输出

构建完成后会生成：

- `release/LeonBos Setup 1.0.1.exe` - Windows 安装包
- `release/win-unpacked/LeonBos.exe` - 免安装可执行目录

如果网络访问 GitHub 不稳定，可以使用镜像执行：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npm.cmd run dist:win
```
