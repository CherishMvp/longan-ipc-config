# WebRTC 直出流 (RTSP to Node-datachannel) 设计方案

## 1. 概述 (Overview)
本方案旨在取代现有的 ZLMediaKit 和 WASM 解码器，利用 Electron 主进程的原生能力实现一个极轻量、高性能的媒体网关。通过 `node-datachannel` 将 RTSP 流实时推送到 WebRTC 视频轨道，实现局域网内极致低延迟（<500ms）和稳定的原生硬件解码。

## 2. 核心架构 (Architecture)
### 2.1 数据流向 (Data Flow)
`RTSP (Camera) -> FFmpeg (Binary) -> Stdout/Pipe -> Node.js (Main Process) -> Node-datachannel -> WebRTC (PeerConnection) -> Renderer Process (<video> tag)`

### 2.2 核心组件 (Components)
*   **Main Process**:
    *   `StreamManager`: 管理视频流生命周期（心跳检测、自动断开、多路复用）。
    *   `WebRTCProvider`: 封装 `node-datachannel` 库，处理 SDP 交换、ICE 候选者收集。
    *   `FFmpegWrapper`: 动态生成 FFmpeg 命令，以 `copy` 模式拉取 RTSP 数据包，最大程度减少 CPU 占用。
*   **Renderer Process**:
    *   `WebRTCPlayer.vue`: 封装原生 `RTCPeerConnection` API，负责与主进程进行 SDP 握手并播放视频。

## 3. 详细设计 (Detailed Design)
### 3.1 IPC 接口定义 (IPC Interfaces)
*   `webrtc-play(streamUrl)`: 前端发起播放请求，主进程返回 SDP Offer。
*   `webrtc-answer(sdp)`: 前端返回 SDP Answer，完成握手。
*   `webrtc-stop()`: 停止当前播放。
*   `webrtc-ice-candidate(candidate)`: 双向交换 ICE 候选者。

### 3.2 针对 Win7 的稳定性优化 (Optimization for Win7)
*   **二进制适配**: 使用针对 Win7 兼容性更好的 `ffmpeg-static` 二进制文件。
*   **硬件加速优先**: 如果探测到 H.264 编码，强制启用显卡 MSE 硬件加速。
*   **转码兜底**: 仅当摄像头为 H.265 且系统不支持解码时，由主进程 FFmpeg 执行“轻量转码” (H.265 -> H.264)，确保低配机器能流畅播放。

## 4. 预期成效 (Success Criteria)
*   延迟控制在 **300-800ms**。
*   即使在 Win7 老旧内核上，视频播放无闪烁、无卡顿。
*   相比 ZLMediaKit，减少约 **50-80MB** 的运行时内存占用。
