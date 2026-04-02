# WVP 设备状态统计对接方案

## 一、需求背景

将 WVP-GB28181-PRO 后端的真实设备在线/离线状态统计数据对接到前端首页展示，替代当前的本地设备统计。

## 二、现有 WVP API

根据 `swagger/wvp-gb28181-pro-api.json` 分析，WVP 已有以下可用接口：

| 接口路径 | 功能 | 请求方式 | 参数 |
|---------|------|---------|------|
| `/api/device/query/devices` | 分页查询设备 | GET | page, count, query |
| `/api/device/query/devicesAll` | 查询所有设备 | GET | onLine (true/false) |
| `/api/device/query/devices/{deviceId}/status` | 单设备状态查询 | GET | deviceId |
| `/bus/index/devicesOnlineCount` | 在线设备统计 | GET | tenantId |

**接口示例：**

```bash
# 获取所有设备
curl -H "access-token: {token}" http://wvp-host/api/device/query/devicesAll

# 获取在线设备
curl -H "access-token: {token}" http://wvp-host/api/device/query/devicesAll?onLine=true

# 获取离线设备
curl -H "access-token: {token}" http://wvp-host/api/device/query/devicesAll?onLine=false
```

## 三、对接方案对比

### 方案 A：HTTP 轮询（推荐用于首页统计）

#### 实现方式

```typescript
// src/composables/useDeviceStats.ts
export function useDeviceStats() {
  const stats = ref({
    total: 0,
    online: 0,
    offline: 0,
    lastUpdate: null as Date | null
  })
  
  const wvpStore = useWVPStore()
  
  async function fetchStats() {
    if (!wvpStore.wvpConnected) return
    
    try {
      const token = wvpStore.wvpApi.getToken()
      const baseUrl = wvpStore.wvpBaseUrl
      
      // 方式1：并发请求（利用现有接口）
      const [allRes, onlineRes] = await Promise.all([
        fetch(`${baseUrl}/api/device/query/devicesAll`, {
          headers: { 'access-token': token }
        }),
        fetch(`${baseUrl}/api/device/query/devicesAll?onLine=true`, {
          headers: { 'access-token': token }
        })
      ])
      
      const allDevices = await allRes.json()
      const onlineDevices = await onlineRes.json()
      
      stats.value = {
        total: allDevices.data?.length || 0,
        online: onlineDevices.data?.length || 0,
        offline: (allDevices.data?.length || 0) - (onlineDevices.data?.length || 0),
        lastUpdate: new Date()
      }
    } catch (e) {
      console.error('Failed to fetch device stats:', e)
    }
  }
  
  // 每 10 秒更新一次
  const interval = setInterval(fetchStats, 10000)
  
  onMounted(fetchStats)
  onUnmounted(() => clearInterval(interval))
  
  return { stats, refresh: fetchStats }
}
```

#### 使用示例

```vue
<!-- src/views/Home.vue -->
<script setup>
import { useDeviceStats } from '@/composables/useDeviceStats'

const { stats } = useDeviceStats()
</script>

<template>
  <div class="stats-grid">
    <Card>
      <CardContent>
        <p>设备总数</p>
        <span>{{ stats.total }}</span>
        <p class="text-xs text-muted-foreground">
          更新于 {{ stats.lastUpdate?.toLocaleTimeString() }}
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardContent>
        <p>在线设备</p>
        <span class="text-green-500">{{ stats.online }}</span>
      </CardContent>
    </Card>
    
    <Card>
      <CardContent>
        <p>离线设备</p>
        <span class="text-red-500">{{ stats.offline }}</span>
      </CardContent>
    </Card>
  </div>
</template>
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 无需后端新增接口 | ⚠️ 非实时（延迟 10 秒） |
| ✅ 实现简单 | ⚠️ 频繁请求增加服务器负担 |
| ✅ 兼容性好 | ⚠️ 两次请求可能有数据不一致 |
| ✅ 适合后台应用 | |

#### 适用场景

- ✅ 首页统计展示
- ✅ 设备管理页面概览
- ✅ 非实时监控场景

---

### 方案 B：WebSocket 实时推送（推荐用于实时监控）

#### 后端实现（WVP 需要新增）

```java
// WVP 后端新增 WebSocket 端点
package com.jvm.lease.module.gb28181.websocket;

import org.springframework.stereotype.Component;
import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
@ServerEndpoint("/api/device/status/websocket")
public class DeviceStatusWebSocket {
    
    private static final CopyOnWriteArraySet<DeviceStatusWebSocket> webSocketSet = new CopyOnWriteArraySet<>();
    private Session session;
    
    @OnOpen
    public void onOpen(Session session) {
        this.session = session;
        webSocketSet.add(this);
        
        // 连接建立时，推送当前状态
        sendMessage(getCurrentStats());
    }
    
    @OnClose
    public void onClose() {
        webSocketSet.remove(this);
    }
    
    @OnMessage
    public void onMessage(String message, Session session) {
        // 处理客户端订阅请求
        // 例如：订阅特定设备状态变化
    }
    
    @OnError
    public void onError(Session session, Throwable error) {
        error.printStackTrace();
    }
    
    /**
     * 设备状态变化时调用（由 SIP 事件驱动）
     */
    public static void onDeviceStatusChanged(String deviceId, boolean online) {
        broadcastStats();
    }
    
    /**
     * 广播统计信息给所有连接的客户端
     */
    private static void broadcastStats() {
        String message = getCurrentStats();
        for (DeviceStatusWebSocket webSocket : webSocketSet) {
            webSocket.sendMessage(message);
        }
    }
    
    /**
     * 计算当前统计信息
     */
    private static String getCurrentStats() {
        DeviceStats stats = deviceService.calculateStats();
        return JSON.toJSONString(stats);
    }
    
    private void sendMessage(String message) {
        try {
            this.session.getBasicRemote().sendText(message);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

/**
 * 统计数据结构
 */
@Data
public class DeviceStats {
    private Integer total;           // 设备总数
    private Integer online;          // 在线设备数
    private Integer offline;         // 离线设备数
    private List<DeviceInfo> devices; // 设备详情列表（可选）
    private Long timestamp;          // 时间戳
}

@Data
public class DeviceInfo {
    private String deviceId;
    private String name;
    private Boolean online;
    private Integer channelCount;
    private Long lastKeepalive;
}
```

#### 前端实现

```typescript
// src/composables/useDeviceStatsRealtime.ts
export function useDeviceStatsRealtime() {
  const stats = ref<DeviceStats>({
    total: 0,
    online: 0,
    offline: 0,
    devices: [],
    timestamp: Date.now()
  })
  
  const wvpStore = useWVPStore()
  let ws: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  const reconnectDelay = 5000
  
  function connect() {
    if (!wvpStore.wvpConnected) return
    
    const token = wvpStore.wvpApi.getToken()
    const wsUrl = wvpStore.wvpBaseUrl.replace('http', 'ws') + '/api/device/status/websocket'
    
    ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('[DeviceStats] WebSocket connected')
      // 发送认证信息
      ws?.send(JSON.stringify({ type: 'auth', token }))
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        stats.value = data
      } catch (e) {
        console.error('[DeviceStats] Parse error:', e)
      }
    }
    
    ws.onerror = (error) => {
      console.error('[DeviceStats] WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('[DeviceStats] WebSocket closed, reconnecting...')
      // 自动重连
      reconnectTimer = setTimeout(connect, reconnectDelay)
    }
  }
  
  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      ws.close()
      ws = null
    }
  }
  
  onMounted(connect)
  onUnmounted(disconnect)
  
  return { stats, reconnect: connect }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 实时性强（毫秒级） | ⚠️ 需要后端新增接口 |
| ✅ 服务端主动推送 | ⚠️ 需要维护 WS 连接状态 |
| ✅ 减少无效请求 | ⚠️ 断线重连逻辑复杂 |
| ✅ 符合 GB28181 事件驱动 | ⚠️ 调试难度较高 |

#### 适用场景

- ✅ 实时监控大屏（VideoWall）
- ✅ 设备状态实时监控
- ✅ 运维监控平台

---

### 方案 C：SSE (Server-Sent Events)

#### 后端实现（WVP 需要新增）

```java
@GetMapping("/api/device/status/stream")
public SseEmitter deviceStatusStream() {
    SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
    
    // 定时推送统计信息
    ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
        try {
            DeviceStats stats = deviceService.calculateStats();
            emitter.send(SseEmitter.event()
                .name("stats")
                .data(stats));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }, 0, 5, TimeUnit.SECONDS);
    
    emitter.onCompletion(() -> future.cancel(true));
    emitter.onTimeout(() -> future.cancel(true));
    
    return emitter;
}
```

#### 前端实现

```typescript
// src/composables/useDeviceStatsSSE.ts
export function useDeviceStatsSSE() {
  const stats = ref<DeviceStats>({
    total: 0,
    online: 0,
    offline: 0
  })
  
  const wvpStore = useWVPStore()
  let eventSource: EventSource | null = null
  
  function connect() {
    if (!wvpStore.wvpConnected) return
    
    const token = wvpStore.wvpApi.getToken()
    const url = `${wvpStore.wvpBaseUrl}/api/device/status/stream?token=${token}`
    
    eventSource = new EventSource(url)
    
    eventSource.addEventListener('stats', (event) => {
      try {
        stats.value = JSON.parse(event.data)
      } catch (e) {
        console.error('[DeviceStats] Parse error:', e)
      }
    })
    
    eventSource.onerror = (error) => {
      console.error('[DeviceStats] SSE error:', error)
      // EventSource 会自动重连
    }
  }
  
  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }
  
  onMounted(connect)
  onUnmounted(disconnect)
  
  return { stats }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 比 WebSocket 简单 | ⚠️ 单向通信 |
| ✅ 单向推送，适合统计场景 | ⚠️ 需要后端新增接口 |
| ✅ HTTP 协议，兼容性好 | ⚠️ IE 不支持 |
| ✅ 自动重连 | |

#### 适用场景

- ✅ 单向数据推送场景
- ✅ 状态监控面板
- ✅ 日志实时展示

---

## 四、推荐方案（分场景）

### 场景 1：首页统计展示（当前需求）

**推荐：方案 A（HTTP 轮询 10 秒）**

**理由：**
1. 首页统计不需要毫秒级实时性
2. 10 秒延迟完全可接受
3. 无需后端改动，立即可用
4. 实现简单，维护成本低

**实施步骤：**
1. 创建 `src/composables/useDeviceStats.ts`
2. 在 `Home.vue` 中使用 composable
3. 取消隐藏统计卡片
4. 测试验证

---

### 场景 2：实时监控大屏（VideoWall）

**推荐：方案 B（WebSocket 实时推送）**

**理由：**
1. 监控场景需要实时性
2. 设备上下线需要立即反映
3. 用户体验要求高
4. 符合 GB28181 设备状态事件驱动特性

**实施步骤：**
1. WVP 后端新增 WebSocket 端点
2. 创建 `src/composables/useDeviceStatsRealtime.ts`
3. 在 VideoWall 中集成实时统计
4. 实现断线重连机制
5. 测试压力场景（多设备上下线）

---

### 场景 3：设备管理页面

**推荐：方案 C（SSE）或 方案 A（HTTP 轮询）**

**理由：**
- 管理页面不需要毫秒级实时
- SSE 比 WebSocket 简单
- 5-10 秒延迟可接受

---

## 五、优化建议（给 WVP 后端）

### 建议 1：新增统计专用接口

```java
/**
 * 单接口返回统计信息，减少网络开销
 */
@GetMapping("/api/device/query/stats")
public WVPResult<DeviceStats> getDeviceStats() {
    DeviceStats stats = new DeviceStats();
    stats.setTotal(deviceService.count());
    stats.setOnline(deviceService.countByOnline(true));
    stats.setOffline(deviceService.countByOnline(false));
    stats.setLastUpdate(new Date());
    return WVPResult.success(stats);
}
```

**优点：**
- 一次请求获取所有统计数据
- 减少网络开销
- 数据一致性更好
- 降低服务器压力

---

### 建议 2：新增 WebSocket 推送接口

```java
/**
 * 实时推送设备状态变化
 */
@ServerEndpoint("/api/device/status/websocket")
public class DeviceStatusWebSocket {
    // 见方案 B 详细实现
}
```

**触发时机：**
1. 设备注册（SIP Register）
2. 设备注销（SIP Unregister）
3. 心跳超时（Keepalive Timeout）
4. 目录订阅更新（Catalog Update）
5. 手动刷新触发

---

### 建议 3：缓存优化

```java
/**
 * 使用 Redis 缓存统计结果
 */
@Cacheable(value = "device:stats", key = "'current'", unless = "#result == null")
public DeviceStats getDeviceStatsCached() {
    return calculateDeviceStats();
}

/**
 * 设备状态变化时清除缓存
 */
@CacheEvict(value = "device:stats", allEntries = true)
public void onDeviceStatusChanged(String deviceId, boolean online) {
    // 触发 WebSocket 推送
    deviceStatusWebSocket.broadcastStats();
}
```

---

## 六、性能对比

| 方案 | 实时性 | 服务器压力 | 实现难度 | 网络开销 | 兼容性 |
|------|--------|-----------|---------|---------|--------|
| **方案 A（轮询）** | 10s 延迟 | 中等 | ⭐ 简单 | 每分钟 6 次请求 | ✅ 最好 |
| **方案 B（WebSocket）** | 毫秒级 | 低 | ⭐⭐⭐ 复杂 | 仅状态变化时推送 | ✅ 良好 |
| **方案 C（SSE）** | 5s 延迟 | 低 | ⭐⭐ 中等 | 持续连接 | ⚠️ IE 不支持 |

---

## 七、决策矩阵

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 首页统计 | **方案 A** | 无需后端改动，立即可用 |
| VideoWall 监控 | **方案 B** | 实时性要求高 |
| 设备管理页 | **方案 A/C** | 平衡实时性与复杂度 |
| 运维监控大屏 | **方案 B** | 需要实时告警 |

---

## 八、后续工作计划

### Phase 1：首页统计集成（优先级高）

- [ ] 创建 `useDeviceStats.ts` composable
- [ ] 在 Home.vue 中集成
- [ ] 测试验证

**预计时间：** 1 小时  
**依赖：** 无

### Phase 2：WVP 后端接口优化（优先级中）

- [ ] 新增 `/api/device/query/stats` 接口
- [ ] 添加缓存优化
- [ ] API 文档更新

**预计时间：** 2 小时  
**依赖：** WVP 后端开发

### Phase 3：VideoWall 实时统计（优先级低）

- [ ] WVP 后端新增 WebSocket 端点
- [ ] 前端实现 WS 连接管理
- [ ] 断线重连机制
- [ ] 压力测试

**预计时间：** 4 小时  
**依赖：** Phase 2 完成

---

## 九、风险提示

### 风险 1：现有接口数据不一致

**现象：** `/api/device/query/devicesAll` 和 `/api/device/query/devicesAll?onLine=true` 两次请求之间可能有设备状态变化

**解决方案：**
1. 短期：接受短暂不一致（首页统计场景可接受）
2. 长期：使用新增的 `/api/device/query/stats` 单接口

### 风险 2：Token 过期

**现象：** 长时间运行后 token 过期导致请求失败

**解决方案：**
- 已有 token 自动刷新机制（WVPApiService.refreshTokenIfNeeded）

### 风险 3：WebSocket 连接断开

**现象：** 网络波动导致 WS 断开，统计数据停止更新

**解决方案：**
- 实现断线重连机制（见方案 B 实现）
- 添加心跳检测

---

## 十、参考资料

- WVP-GB28181-PRO Swagger API: `swagger/wvp-gb28181-pro-api.json`
- 现有实现: `src/services/wvp-api.ts`
- 设备 Store: `src/stores/device-store.ts`
- 首页组件: `src/views/Home.vue`

---

**文档版本：** v1.0  
**创建日期：** 2026-04-02  
**最后更新：** 2026-04-02  
**维护者：** Development Team