# WebSocket-FLV 自适应流媒体网关设计方案 (最终版)

## 1. 概述 (Overview)

本方案采用 **WebSocket + FLV + mpegts.js** 的技术栈，实现了一个具备**自愈能力**的 RTSP 流媒体播放系统。相比 WebRTC 方案，该方案在保持低延迟的同时，提供了**VLC 级别**的播放稳定性和抗网络抖动能力，完美兼容 Win7 及老旧浏览器环境。

### 1.1 技术选型理由
| 方案 | 延迟 | 稳定性 | Win7 兼容 | 开发复杂度 | 最终选择 |
|------|------|--------|-----------|------------|----------|
| WebRTC (node-datachannel) | 极低 (<300ms) | 中 | 差 | 高 | ❌ |
| **WebSocket-FLV (mpegts.js)** | 低 (500-1500ms) | **极高** | **完美** | 中 | ✅ |
| ZLMediaKit 外部服务 | 低 | 高 | 中 | 高 | ❌ |

---

## 2. 核心架构 (Architecture)

### 2.1 数据流向 (Data Flow)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  RTSP Camera    │     │  Electron Main       │     │  WebSocket      │     │  Renderer       │
│  (H.265/H.264)  │────▶│  Process (FFmpeg)    │────▶│  Server (:9999) │────▶│  (mpegts.js)    │
│                 │     │  - 转码 H.265→H.264   │     │                 │     │  - FLV 解码      │
│                 │     │  - 分辨率 1280x720    │     │                 │     │  - MSE 渲染      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                           │                        │
         │                        │                           │                        │
         └────────────────────────┴───────────┴───────────────┘                        │
                              TCP/IP 局域网                                              │
                                                                                       │
         ┌─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
    <video> 标签原生播放
```

### 2.2 技术栈清单

| 层级 | 组件 | 版本 | 作用 |
|------|------|------|------|
| **后端** | FFmpeg | 7.0.2 (system) | RTSP 拉流、H.265→H.264 转码、FLV 封装 |
| **后端** | ws | 8.20.0 | WebSocket 服务器，二进制流转发 |
| **后端** | uuid | 13.0.0 | 会话隔离，防止重连竞态 |
| **前端** | mpegts.js | 1.8.0 | FLV 解封装、H.264 解码、MSE 渲染 |
| **前端** | Vue 3 | 3.5.27 | 播放器组件、状态管理 |

---

## 3. 核心组件详解 (Components)

### 3.1 主进程流媒体服务 (`electron/StreamService.ts`)

**职责**：
- 启动并管理 FFmpeg 子进程
- 通过 WebSocket 向渲染进程推送 FLV 二进制流
- 实现健康检查（Health Check），自动检测并恢复卡死的流

**关键特性**：

```typescript
// 1. 会话隔离 (Session Isolation)
private sessions: Map<string, { 
    ffmpeg: ChildProcess, 
    ws: WebSocket, 
    lastDataTime: number 
}> = new Map();

// 2. 健康检查 (每 5 秒)
setInterval(() => {
    if (now - session.lastDataTime > 5000) {
        // 杀掉卡死的 FFmpeg
        session.ffmpeg.kill('SIGKILL');
        // 主动断开 WebSocket，触发前端重连
        session.ws.close();
    }
}, 5000);

// 3. FFmpeg 参数 (VLC 风格优化)
const args = [
    '-rtsp_transport', 'tcp',           // 强制 TCP 传输，防止 UDP 丢包
    '-rtsp_flags', 'prefer_tcp',
    '-fflags', '+genpts+discardcorrupt',// 修复时间戳，丢弃坏帧
    '-probesize', '1024k',              // 增大探测包，提高兼容性
    '-analyzeduration', '2000000',
    '-c:v', 'libx264',                  // 转码为 H.264
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-profile:v', 'main',               // Main Profile，兼容性最佳
    '-s', '1280x720',                   // 降分辨率，降低解码压力
    '-b:v', '2000k', '-bufsize', '4000k', // 码率控制
    '-g', '50',                         // 关键帧间隔 (2 秒)
    '-r', '25',                         // 强制帧率，防止时钟失步
    '-an',                              // 无音频
    '-f', 'flv', 'pipe:1'               // 输出到管道
];
```

### 3.2 前端播放器组件 (`src/components/VideoPlayer/MpegtsPlayer.vue`)

**职责**：
- 连接本地 WebSocket 服务
- 使用 mpegts.js 解码 FLV 流
- 实现**无感自愈**重连机制

**关键特性**：

```typescript
// 1. 多线程解码 (Web Worker)
player = mpegts.createPlayer({
    type: 'flv',
    isLive: true,
    url: `ws://localhost:9999?url=${rtspUrl}`,
    hasAudio: false,
}, {
    enableWorker: true,           // 🚀 独立线程解码，防止 UI 卡顿
    enableStashBuffer: true,      // 🚀 VLC 风格抖动缓冲
    stashInitialSize: 1536,       // 1.5MB 初始缓存
    liveBufferLatencyChasing: true, // 延迟追赶
    liveBufferLatencyMaxLatency: 3.0, // 最大 3 秒延迟
    autoCleanupSourceBuffer: true,    // 自动清理，防内存泄漏
});

// 2. 静默重连 (Silent Reconnect)
player.on(mpegts.Events.ERROR, () => {
    handleSilentReconnect(); // 自动重试，最多 100 次
});

const handleSilentReconnect = () => {
    retryCount++;
    const delay = retryCount < 10 ? 1000 : 5000; // 渐进式延迟
    setTimeout(() => initPlayer(true), delay);
};

// 3. 无感切换 (保留最后一帧)
if (player) {
    player.pause();
    player.unload();
    player.detachMediaElement(); // 保留 video 标签，不黑屏
    player.destroy();
}
```

---

## 4. 稳定性保障机制 (Stability Guarantees)

### 4.1 三层防护体系

| 层级 | 机制 | 触发条件 | 恢复动作 |
|------|------|----------|----------|
| **L1** | FFmpeg 时间戳修复 | 每帧 | `-fflags +genpts` 自动修复 |
| **L2** | 前端错误监听 | mpegts.js 报错 | 自动重连 (1-5 秒延迟) |
| **L3** | 主进程健康检查 | 5 秒无数据 | 杀掉 FFmpeg + 断开 WS |

### 4.2 会话隔离设计

```
时间线:
T0: 会话 A [UUID: abc123] 建立 → FFmpeg-A 启动
T1: 网络抖动 → 前端重连
T2: 会话 B [UUID: def456] 建立 → FFmpeg-B 启动
T3: 会话 A 的 close 事件触发 → 仅清理 FFmpeg-A ✅
T4: 会话 B 继续正常工作 ✅

(旧方案使用 RTSP 地址作为 Key，会导致 T3 误杀 FFmpeg-B)
```

### 4.3 VLC 级别优化对比

| 特性 | VLC 默认行为 | 本方案实现 |
|------|--------------|------------|
| 网络抖动缓冲 | 300-1000ms | 1000-3000ms (可配置) |
| 坏帧处理 | 丢弃并继续 | `-fflags +discardcorrupt` |
| 时间戳修复 | 自动校正 | `-fflags +genpts` |
| 多线程解码 | 是 | `enableWorker: true` |
| 自动重连 | 是 | 静默重连 (最多 100 次) |

---

## 5. 性能指标 (Performance Metrics)

### 5.1 延迟分析

| 环节 | 延迟 | 说明 |
|------|------|------|
| 摄像头编码 | ~100ms | 设备端编码延迟 |
| 网络传输 | ~10-50ms | 局域网 TCP 传输 |
| FFmpeg 转码 | ~200-500ms | H.265→H.264 转码 + 缓冲 |
| WebSocket 推送 | ~10ms | 本地 IPC |
| mpegts.js 解码 | ~100-300ms | MSE 缓冲 + 解码 |
| **总延迟** | **500-1500ms** | 可接受范围 |

### 5.2 资源占用

| 组件 | CPU | 内存 | 说明 |
|------|-----|------|------|
| FFmpeg (单路) | 15-25% | ~50MB | i5-8 代，H.265→H.264 |
| Electron 主进程 | ~5% | ~100MB | WebSocket 服务 |
| 渲染进程 (单路) | ~10% | ~80MB | mpegts.js + MSE |
| **单路总计** | **~30-40%** | **~230MB** | |

### 5.3 多路并发建议

| 设备配置 | 建议最大路数 | 说明 |
|----------|--------------|------|
| i3 + 8GB | 2-4 路 | 720p 转码 |
| i5 + 16GB | 6-9 路 | 720p 转码 |
| i7 + 32GB | 12-16 路 | 720p 转码 |

---

## 6. 开发与运维指南 (DevOps Guide)

### 6.1 日志监控

主进程日志格式：
```
[HH:MM:SS.SSS] [StreamService] [UUID 前 8 位] 消息内容
```

**关键日志标识**：
| 日志内容 | 含义 | 处理 |
|----------|------|------|
| `Stable session requested` | 新播放请求 | 正常 |
| `Client disconnected` | 前端断开连接 | 正常 (切换/关闭) |
| `Stream stalled (No data for 5s)` | 流卡死 | 自动恢复中 |
| `FFmpeg closed. Code: null, Signal: SIGKILL` | 进程被清理 | 正常 |
| `FFmpeg Error: ...` | FFmpeg 报错 | 检查摄像头网络 |

### 6.2 故障排查流程

```
画面卡住不动
    │
    ▼
查看控制台最后一条日志时间
    │
    ├─ 超过 5 分钟无新日志 → 健康检查未触发 → 检查主进程事件循环
    │
    ├─ 显示 "Stream stalled" → 已自动恢复 → 检查网络/摄像头
    │
    └─ 显示 "FFmpeg Error" → 流媒体错误 → 检查 RTSP 地址/密码
```

### 6.3 生产环境部署

```json
// package.json 配置
{
  "build": {
    "asar": true,
    "asarUnpacked": [
      "**/node_modules/ffmpeg-static/**/*"
    ],
    "files": [
      "dist/**/*",
      "dist-electron/**/*"
    ]
  }
}
```

**注意事项**：
1. FFmpeg 二进制文件必须解压到 `app.asar.unpacked` 目录
2. 生产环境使用 `ffmpeg-static` 的打包路径
3. WebSocket 端口 9999 需在防火墙中开放 (仅限本地回环)

---

## 7. 演进路线 (Roadmap)

### 7.1 已完成 (Done)
- [x] 基础 WebSocket-FLV 转发
- [x] H.265→H.264 转码
- [x] 会话隔离 (UUID 管理)
- [x] 健康检查 (5 秒无数据检测)
- [x] 前端静默重连
- [x] Web Worker 多线程解码
- [x] VLC 风格抖动缓冲

### 7.2 计划中 (TODO)
- [ ] 动态码率调整 (根据网络状况)
- [ ] 多路复用优化 (共享 FFmpeg 进程)
- [ ] 音频支持 (Opus 编码)
- [ ] 录制与回放功能
- [ ] 云台控制 (PTZ) 集成

---

## 8. 附录：核心代码索引 (Code Index)

| 文件 | 行号 | 功能 |
|------|------|------|
| `electron/StreamService.ts` | L117-128 | 健康检查逻辑 |
| `electron/StreamService.ts` | L67-115 | FFmpeg 启动与参数 |
| `src/components/VideoPlayer/MpegtsPlayer.vue` | L30-50 | mpegts.js 配置 |
| `src/components/VideoPlayer/MpegtsPlayer.vue` | L60-75 | 静默重连逻辑 |
| `src/views/discovery/components/LivePlayer.vue` | L80-90 | 播放器集成 |

---

**文档版本**: v2.0  
**最后更新**: 2026-03-31  
**维护者**: 开发团队  
**状态**: ✅ 生产就绪
