# 项目开发规划 Roadmap

## UI/UX & 设计规范 (Core Mandates)
*必须贯穿所有开发阶段*
- **设计系统**：严格遵循 Shadcn-Vue + Tailwind CSS v4。
- **主题**：Zinc 风格，支持完美的深色/浅色模式切换。
- **交互体验**：所有异步操作需有 Loading 反馈，危险操作需二次确认。
- **一致性**：组件复用，拒绝随意引入第三方 UI 库导致风格割裂。

---

## 🟢 第一阶段：Electron 原生体验增强 (当前重点)
> 目标：摆脱“网页套壳”感，提供真正的桌面级体验。

### 1. 系统托盘 (System Tray)
- [ ] 应用启动时最小化到托盘选项。
- [ ] 关闭窗口时仅最小化到托盘（可选）。
- [ ] 托盘右键菜单：
  - 显示在线/总设备数概览。
  - "打开主界面" / "退出应用"。
- [ ] 托盘图标闪烁提醒（当有设备掉线或批量操作失败时）。

### 2. 原生通知系统
- [ ] 批量配置任务完成时发送系统通知。
- [ ] 关键错误（如数据库写入失败）发送通知。

### 3. 应用自动更新
- [ ] 集成 `electron-updater`。
- [ ] 配置 `electron-builder.yml` 支持自动发布。
- [ ] 界面增加“检查更新”按钮和下载进度条。

---

## 🔵 第二阶段：设备自动发现与配置 (Advanced ODM Replacement)
> 目标：打造比肩 ODM (ONVIF Device Manager) 的专业设备管理工具。

### 1. 全协议扫描引擎 (Completed)
- [x] **混合探测架构**：
  - ONVIF (WS-Discovery): 标准 `Probe` + 多类型支持 (`tds:Device`, `dn:NetworkVideoTransmitter`).
  - 厂商私有协议: 模拟海康 SADP 协议 (UDP 37020)，实现 0 配置发现。
  - 定向广播 (Directed Broadcast): 解决多网卡/跨网段发现问题。
- [x] **IP 段暴力扫描**: TCP 端口探测 (80/554) 发现非标准设备。

### 2. ODM 级核心功能 (Current - 95%)
- [x] **深度信息获取**:
  - Firmware Version, Serial Number, Hardware ID, Manufacturer.
  - HTTP / RTSP Ports (via `GetNetworkProtocols`).
- [x] **网络配置管理**:
  - 修改 IP 地址、子网掩码、网关 (SOAP `SetNetworkInterfaces`).
  - DHCP 开关切换.
- [x] **设备维护**:
  - 系统重启 (`SystemReboot`).
  - 网页管理跳转.
  - 修改密码 (`SetUser`).
  - 时间同步 (`SetSystemDateAndTime`).
- [x] **实时预览**:
  - MJPEG 原生直播 (针对支持 MJPEG over HTTP 的设备).
  - 快照轮询 (针对 H.264/H.265 设备的兜底方案).

---

## 🟣 第三阶段：GB28181 国标接入与流媒体 (Next Focus)
> 核心目标：打通 "Discovery -> SIP Config -> WVP -> Play" 闭环，实现“能配则配，不能配则引流”的策略。

### 3.1 厂商适配层 (Vendor Adapters)
- [ ] **海康适配器**：实现 `ISAPI` 修改 SIP 配置 (PUT /ISAPI/System/Network/SIP)。
- [ ] **大华适配器**：实现 `CGI` 修改 SIP 配置。
- [ ] **通用引导**：针对不支持 API 的小厂设备，提供“配置参数悬浮窗”，辅助手动网页配置。

### 3.2 WVP 平台联动
- [ ] **配置同步**：设置本地 WVP 服务器地址/端口/默认国标 ID 规则。
- [ ] **状态感知**：轮询 WVP API，检测设备是否已成功注册上线。

### 3.3 高性能流媒体播放
- [ ] **播放器集成**：引入 `mpegts.js` (HTTP-FLV) 或 `Jessibuca` (WASM)。
- [ ] **点播流程**：
    1. 用户点击“播放”。
    2. 工具请求 WVP `/api/play`。
    3. WVP 指挥设备推流到 ZLM。
    4. ZLM 返回 HTTP-FLV 地址 -> 前端播放。

---

## 🏗️ 工程化与基建
- [x] **数据持久化**：SQLite (better-sqlite3) 便携式存储。
- [ ] **CI/CD**：GitHub Actions 自动构建 Windows 安装包。
- [ ] **测试**：Vitest 单元测试（重点覆盖协议解析）。
