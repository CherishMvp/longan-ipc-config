# WVP-GB28181-Pro 集成设计方案

## 1. 问题陈述 (Problem Statement)

**核心问题**：WVP-GB28181-Pro 原生前端使用 Jessibuca (WASM) 解码器，在长时间播放后会出现自动暂停或黑屏问题，特别是在 Win7 和旧版浏览器上。

**根本原因**：
- WASM 软解 H.265 在旧硬件上性能不足
- 缓冲区设置过小，网络抖动导致中断
- 主线程阻塞导致解码卡顿
- 缺少主动健康检查和自动恢复机制

**解决方案**：保留 WVP 的设备管理和信令控制能力，用 Electron 客户端 + mpegts.js 替换前端播放器。

---

## 2. 架构设计 (Architecture)

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    混合架构 (Hybrid Architecture)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WVP-GB28181-Pro (服务端)          Electron 客户端 (您的系统)   │
│  ┌─────────────────────┐          ┌──────────────────────┐     │
│  │  设备管理/信令控制   │◀─HTTP──▶│  业务逻辑闭环         │     │
│  │  - 设备注册/心跳     │  API     │  - 设备列表展示        │     │
│  │  - 云台控制         │          │  - 视频播放           │     │
│  │  - 录像查询         │          │  - 本地数据库         │     │
│  └─────────────────────┘          └──────────────────────┘     │
│           │                              │                       │
│  ┌─────────────────────┐          ┌──────────────────────┐     │
│  │  ZLMediaKit         │          │  播放器组件          │     │
│  │  - HTTP-FLV 输出     │──FLV/WS──▶│  - mpegts.js (MSE)  │     │
│  │  - WS-FLV 输出       │          │  - 无闪烁硬解        │     │
│  │  - WebRTC 输出       │          │  - 自动重连          │     │
│  └─────────────────────┘          └──────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
1. Electron 客户端登录 WVP → 获取 Token
2. 获取设备列表 → 展示在 UI
3. 用户点击播放 → 调用 WVP 点播 API → 获取播放地址
4. 直连 ZLMediaKit 的 HTTP-FLV/WS-FLV 流 → mpegts.js 解码 → <video> 渲染
5. 健康检查 → 发现异常 → 自动重连 (无感)
```

---

## 3. 核心组件 (Core Components)

### 3.1 WVP API 服务层 (`src/services/wvp-api.ts`)

**职责**：封装 WVP 的所有 HTTP API 调用

**关键接口**：
```typescript
interface WVPApiService {
  // 认证
  login(username: string, password: string): Promise<string>
  
  // 设备管理
  getDevices(): Promise<WVPDevice[]>
  getChannels(deviceId: string): Promise<Channel[]>
  
  // 播放控制
  getPlayUrl(deviceId: string, channelId: string, protocol: Protocol): Promise<string>
  stopPlay(deviceId: string, channelId: string): Promise<void>
  
  // 云台控制
  ptzControl(deviceId: string, channelId: string, command: PTZCommand): Promise<void>
  
  // 录像
  getRecordings(deviceId: string, channelId: string, timeRange: TimeRange): Promise<Recording[]>
}
```

### 3.2 协议管理器 (`src/services/stream-protocol-manager.ts`)

**职责**：自动选择最优播放协议，支持降级

**协议优先级**：
1. **HTTP-FLV** (首选，最稳定)
2. **WS-FLV** (备选，穿透性好)
3. **WebRTC** (兜底，延迟最低但兼容性差)

### 3.3 播放器组件 (`src/components/VideoPlayer/StreamPlayer.vue`)

**职责**：shadcn-vue 风格的视频播放器，支持无感重连

**关键特性**：
- ✅ mpegts.js + MSE 硬解
- ✅ Web Worker 多线程解码
- ✅ 动态缓冲策略 (根据并发路数调整)
- ✅ 信号质量指示器 (绿/黄/红)
- ✅ 无感重连 (保留最后一帧)
- ✅ shadcn-vue 风格 UI (Skeleton, Badge, AlertDialog)

### 3.4 健康监控服务 (`src/services/stream-health-monitor.ts`)

**职责**：实时监控所有播放流的健康状态

**监控指标**：
- 数据接收速率 (低于阈值触发重连)
- 缓冲状态 (缓冲不足时预警)
- 连接状态 (断开时自动重连)

**检查频率**：每 3 秒一次

---

## 4. UI/UX 设计 (User Interface)

### 4.1 大屏看板布局

**支持两种模式**：
- **3×3 网格** (9 路) - 适合小屏幕
- **4×4 网格** (16 路) - 适合大屏展示

**布局组件**：
```vue
<div :class="['grid gap-3', gridClass]">
  <!-- grid-cols-3 或 grid-cols-4 -->
  <StreamPlayer v-for="device in devices" ... />
</div>
```

### 4.2 播放器状态设计

| 状态 | 视觉反馈 | 用户交互 |
|------|----------|----------|
| **正常播放** | 右上角绿色信号指示器 | Hover 显示设备信息 |
| **连接中** | 半透明遮罩 + Skeleton 动画 | 无 (自动重连) |
| **重连中** | 保留最后一帧 + 半透明 + "RECONNECTING #N" | 无 (自动重连) |
| **播放错误** | AlertDialog 弹窗 | "Retry Now" 按钮 |

### 4.3 信号质量指示器

```vue
<Badge :class="signalQualityClass">
  {{ signalQuality === 'good' ? '●' : '◐' : '○' }}
  {{ signalQuality.toUpperCase() }}
</Badge>
```

- **good** (绿色): 码率 > 1Mbps
- **fair** (黄色): 512Kbps - 1Mbps
- **poor** (红色): < 512Kbps

---

## 5. 稳定性保障 (Stability Guarantees)

### 5.1 零黑屏机制

| 层级 | 机制 | 触发条件 | 恢复动作 |
|------|------|----------|----------|
| **L1** | mpegts.js 自动缓冲 | 网络抖动 | 自动消耗缓冲 |
| **L2** | 播放器错误监听 | mpegts.js 报错 | 自动重连 (1-2 秒) |
| **L3** | 健康监控服务 | 3 秒无数据 | 主动重连 |
| **L4** | 协议降级 | 当前协议失败 | 切换到备用协议 |

### 5.2 动态缓冲策略

```typescript
const bufferConfig = {
  '1-4 路': { stashInitialSize: 512 },      // 0.5MB，低延迟
  '5-9 路': { stashInitialSize: 1024 },     // 1MB，平衡
  '10-16 路': { stashInitialSize: 2048 }    // 2MB，稳定性优先
}
```

### 5.3 重连策略

- **静默重连**：保留最后一帧画面，不显示全屏加载
- **渐进延迟**：第 1-5 次重连间隔 1 秒，第 6-10 次间隔 3 秒
- **最大重试**：10 次后显示错误对话框

---

## 6. 性能指标 (Performance Metrics)

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **首帧时间** | < 2 秒 | 从点击播放到画面显示 |
| **重连时间** | < 3 秒 | 从断流到恢复播放 |
| **CPU 占用** | < 60% (i7, 16 路) | 客户端主进程 + 渲染进程 |
| **内存占用** | < 3GB (16 路) | 客户端总内存 |
| **网络带宽** | ~2Mbps/路 | 720p H.264 编码 |

---

## 7. 实施路线图 (Roadmap)

### Phase 1: WVP API 对接 (2-3 天)
- [ ] 创建 `WVPApiService` 服务类
- [ ] 实现登录认证 (Token 管理)
- [ ] 实现设备列表获取
- [ ] 实现播放地址获取 (支持多协议)
- [ ] 测试 API 连通性

### Phase 2: 播放器组件开发 (3-4 天)
- [ ] 创建 `StreamPlayer.vue` 组件
- [ ] 集成 mpegts.js
- [ ] 实现 shadcn-vue 风格 UI
- [ ] 实现无感重连逻辑
- [ ] 创建健康监控服务

### Phase 3: 大屏看板集成 (2-3 天)
- [ ] 创建 `VideoWall.vue` 组件
- [ ] 实现 3×3 / 4×4 布局切换
- [ ] 集成设备状态管理 (Pinia Store)
- [ ] 移除 EasyPro 依赖

### Phase 4: 性能优化与测试 (2-3 天)
- [ ] 16 路并发压力测试
- [ ] Win7 兼容性测试
- [ ] 网络抖动模拟测试
- [ ] UI/UX 细节调优

---

## 8. 风险与缓解 (Risks & Mitigation)

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **H.265 设备兼容性** | 部分设备无法硬解 | WVP 配置 ZLM 自动转码 H.264 |
| **网络拥塞** | 16 路并发卡顿 | 实施优先级队列 |
| **WVP API 变更** | 接口不兼容 | 封装 API 服务层，便于适配 |
| **Token 过期** | 播放中断 | Token 自动刷新机制 |

---

**文档版本**: v1.0  
**创建日期**: 2026-03-31  
**状态**: 待审核
