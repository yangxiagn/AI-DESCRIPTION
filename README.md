# 番茄钟（Pomodoro Desktop）

基于 Electron 的桌面番茄钟应用，支持专注计时、待办任务与数据本地持久化。

## 功能

- **三种计时模式**：专注（默认 25 分钟）、短休息（5 分钟）、长休息（15 分钟）
- **圆环倒计时**：可视化剩余时间
- **待办任务**：添加、选中当前任务、完成、删除；每项显示已完成番茄数
- **番茄关联**：专注阶段结束后，为当前选中任务累计 +1 个番茄
- **统计**：今日番茄数、本轮循环（每完成 4 个专注自动进入长休息）
- **设置**：自定义各模式时长、提示音、结束后自动切换模式
- **系统通知**：阶段结束时弹出桌面通知
- **数据持久化**：使用 `electron-store` 保存进度与任务，关闭应用后自动恢复

## 环境要求

- [Node.js](https://nodejs.org/) 18+（推荐 LTS）
- Windows（开发与打包主要针对 Windows；Electron 亦可在 macOS / Linux 上运行 `npm start`）

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/yangxiagn/AI-DESCRIPTION.git
cd AI-DESCRIPTION

# 安装依赖（首次会下载 Electron，体积较大，需保持网络畅通）
npm install

# 启动开发版
npm start
```

## 打包

生成 Windows 安装包与便携版（输出在 `dist/` 目录）：

```bash
npm run build
```

## 项目结构

```
first-cc/
├── electron/
│   ├── main.js       # 主进程：窗口、IPC、持久化、系统通知
│   └── preload.js    # 预加载：暴露 pomodoroAPI
├── renderer/
│   ├── index.html    # 界面（任务侧栏 + 计时主区）
│   ├── styles.css    # 样式
│   └── app.js        # 计时与任务逻辑
├── package.json
└── README.md
```

## 技术栈

| 类别     | 选型              |
|----------|-------------------|
| 桌面框架 | Electron 28       |
| 持久化   | electron-store    |
| 前端     | 原生 HTML / CSS / JS |
| 打包     | electron-builder  |

## 常用脚本

| 命令           | 说明           |
|----------------|----------------|
| `npm start`    | 启动桌面应用   |
| `npm run build`| 打包 Windows 应用 |

## 仓库

https://github.com/yangxiagn/AI-DESCRIPTION

## 许可证

MIT
