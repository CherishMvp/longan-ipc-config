# 项目开发规划 Roadmap

## 第一阶段：核心重构与基础稳固 (已完成)
- [x] **架构迁移**：Vue 3 + Vite + Electron + Pinia + TypeScript
- [x] **UI/UX 升级**：迁移至 Shadcn-Vue + Tailwind CSS v4，实现现代化 Dashboard 风格
- [x] **基础功能**：设备增删改查、批量配置、日志系统
- [x] **环境修复**：解决 npm/corepack 环境问题
- [x] **数据持久化**：集成 SQLite (better-sqlite3)，实现应用目录下数据便携存储

## 第二阶段：Electron 原生体验增强 (待启动)
- **系统托盘 (System Tray)**：支持后台运行，最小化到托盘
- **原生菜单**：快捷键支持
- **自动更新**：集成 electron-updater

## 第三阶段：GB28181 & 视频综合运维 (重点规划)
> 结合本地部署的 ZLMediaKit 和 WVP-GB28181-PRO，打造综合视频运维平台。

### 1. WVP 平台对接
- **设备同步**：通过 WVP API 拉取已注册的 GB28181 设备列表，与本地设备列表进行匹配/合并。
- **状态联动**：实时展示设备在 SIP 信令层面的注册状态（在线/离线）。
- **SIP 配置下发**：通过本工具的 HTTP 配置接口，一键修改 IPC 的 SIP Server 地址，使其指向本地 WVP 服务器。

### 2. 视频流预览
- **流媒体集成**：
  - 调用 WVP 接口请求点播 (Invite)。
  - 获取 ZLMediaKit 分发的流地址 (FLV/WebRTC)。
- **播放器集成**：
  - 集成 Jessibuca (WVP推荐) 或 EasyPlayer。
  - 在设备详情页增加“实时预览”标签页。

### 3. 高级控制
- **PTZ 云台控制**：通过调用 WVP 接口发送控制指令。
- **录像回放**：查询设备端或云端录像。

## 第四阶段：工程化与测试
- **自动化构建**：GitHub Actions
- **测试**：Vitest 单元测试
