# Longan 聚合工具箱 (Longan Aggregate Tools)

## 项目简介

Longan 聚合工具箱是一个功能强大的桌面端综合工具平台，专为设备管理和配置而设计。本项目不再局限于单一的传感器配置，而是作为一个聚合体（Utility Hub），集成了多种实用的小工具，旨在提高运维和配置效率。

当前版本主要包含以下核心模块，后续将持续扩展更多实用工具：

- **IPC 气体配置 (Gas Config)**: 针对 Kenaike 等 IPC 设备的气体传感器进行专业配置，支持批量获取设备状态、设置报警阈值、校准参数等。
- **设备自动发现 (Device Discovery)**: 基于 ONVIF 及私有协议，自动扫描局域网内的在线设备，实现一键导入和快速管理。
- **更多工具**: (未来扩展...)

## 功能特性

- **多工具聚合**: 统一的入口和界面风格，集成多个独立功能的子工具。
- **现代化 UI**: 采用 Tailwind CSS + Shadcn UI 设计，提供流畅、美观的用户体验。
- **跨平台支持**: 基于 Electron 构建，支持 Windows、macOS 和 Linux 平台。
- **批量管理**: 支持对多台设备进行批量操作，大幅提升工作效率。
- **实时反馈**: 提供详细的操作日志和状态反馈，确保配置过程可控。

## 技术栈

- **核心框架**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **桌面运行时**: [Electron](https://www.electronjs.org/)
- **UI 组件库**: [Shadcn Vue](https://www.shadcn-vue.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **图标库**: [Lucide Vue Next](https://lucide.dev/)

## 开发指南

### 环境准备

确保本地已安装 Node.js (推荐 v18+) 和 pnpm。

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev:electron
```

### 构建生产包

```bash
# 构建 Windows/macOS/Linux 包
pnpm build:electron
```

## 目录结构

```
src/
├── api/            # API 接口封装
├── components/     # 公共组件
├── views/          # 页面视图
│   ├── discovery/  # 设备发现模块
│   ├── gas-config/ # 气体配置模块
│   └── ...
├── stores/         # 状态管理
├── lib/            # 工具函数
└── ...
electron/           # Electron 主进程代码
```

## 贡献

欢迎提交 Issue 或 Pull Request 来丰富这个工具箱的功能。
