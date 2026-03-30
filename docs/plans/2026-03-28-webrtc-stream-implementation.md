# WebRTC 直出流实施计划 (2026-03-28)

## 1. 准备工作 (Preparation)
- [ ] 安装 `node-datachannel` 原生模块。
- [ ] 安装 `ffmpeg-static` 用于拉取 RTSP 流。
- [ ] 在 `electron/main.ts` 中引入所需的依赖。

## 2. 主进程媒体网关实现 (Main Process Gateway)
- [ ] 实现 `WebRTCStreamManager.ts`:
    - 管理所有活跃的 PeerConnection。
    - 处理流的开启和关闭逻辑。
- [ ] 实现 `FFmpegRTSP.ts`:
    - 启动 FFmpeg 子进程并将 RTP 数据包发送给 `node-datachannel`。
- [ ] 在 `main.ts` 中注册相关的 IPC 处理器。

## 3. 前端播放器集成 (Frontend Integration)
- [ ] 创建 `src/components/VideoPlayer/WebRTCPlayer.vue`:
    - 实现前端 WebRTC 握手逻辑。
    - 处理视频播放和状态显示（加载中、重连、报错）。
- [ ] 在 `DetailPanel.vue` 中集成新的播放器。

## 4. 验证 (Verification)
- [ ] 测试 H.264 视频流的播放稳定性。
- [ ] 验证低延迟效果（对比之前的快照轮询）。
- [ ] 检查内存和 CPU 占用情况。
