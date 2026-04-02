# 动态配置失效问题修复记录

## 问题复现

### 1. 用户报告
- 在设置页修改 WVP baseUrl（如从 `192.168.2.38` 改为 `192.168.2.110`）
- 点击"保存并生效"，提示保存成功，连接测试也成功
- 刷新页面或重启应用后，配置恢复为默认的 `192.168.2.38`
- 数据库 `config` 表没有持久化数据

### 2. 现象
```
[SETTINGS] Saving WVP config to DB: {...}
[SETTINGS] saveConfig FAILED: Error: An object could not be cloned.
```

## 根本原因分析

### 原因一：Vue Proxy 对象无法通过 IPC 序列化（主要原因）

**Electron IPC 限制：**
- IPC（Inter-Process Communication）使用"结构化克隆算法"传输数据
- Vue 的 `ref`、`reactive` 创建的是 Proxy 对象
- Proxy 对象不在结构化克隆算法支持的数据类型中
- 直接传递会导致 `Error: An object could not be cloned`

**错误代码：**
```typescript
// settings.ts（旧版）
await window.electronAPI.saveConfig({
  'settings.wvp': wvpConfig.value  // ← Proxy 对象！
})
```

**正确代码：**
```typescript
// settings.ts（修复后）
const configToSave = JSON.parse(JSON.stringify(wvpConfig.value))
await window.electronAPI.saveConfig({
  'settings.wvp': configToSave  // ← 普通对象
})
```

### 原因二：两个 store 的 config 格式冲突（次要原因）

**问题：**
- `settings.ts` 使用嵌套格式：`{'settings.wvp': {...}}`
- `device.ts` 使用平铺格式：直接传递 `gasSensorConfig.value` 的属性

**冲突流程：**
1. `device.ts` 读取 config 时合并所有 key（包括 `'settings.wvp'`）
2. 用户在 `gas-config` 页面修改参数 → 触发 `saveToStorage()`
3. 污染后的 `gasSensorConfig` 被保存，覆盖正确格式

**修复：**
- `device.ts` 改用 `'globalConfig'` 作为独立 DB key（变量已重命名为 `gasSensorConfig`）
- 读取时只读取 `config['globalConfig']`，不合并其他 key

### 原因三：VideoWall.vue 硬编码 baseUrl（配置未生效的原因）

**问题：**
即使 DB 保存了正确的配置，VideoWall 页面初始化 WVP 时使用硬编码的地址：
```typescript
// VideoWall.vue（旧版）
await store.initializeWVP('http://192.168.2.38:18080', 'admin', 'admin')
```

**修复：**
```typescript
// VideoWall.vue（修复后）
await settingsStore.loadFromDB()
await store.initializeWVP(
  settingsStore.wvpConfig.baseUrl,
  settingsStore.wvpConfig.username,
  settingsStore.wvpConfig.password
)
```

## 解决方案

### 修复一：解包所有 Proxy 对象（核心修复）

**涉及的文件和位置：**

| 文件 | 函数 | 修复内容 |
|------|------|----------|
| `settings.ts` | `saveWVPConfig()` | `JSON.parse(JSON.stringify(wvpConfig.value))` |
| `settings.ts` | `saveONVIFConfig()` | `JSON.parse(JSON.stringify(onvifConfig.value))` |
| `device.ts` | `saveConfig()` | `JSON.parse(JSON.stringify(gasSensorConfig.value))` |
| `device.ts` | `addDevice()` | `JSON.parse(JSON.stringify(device))` |
| `device.ts` | `addLog()` | `data: data ? JSON.parse(JSON.stringify(data)) : undefined` |

### 修复二：隔离 config key

**三个独立的 config key：**
- `settings.wvp`：WVP 视频平台配置（baseUrl、用户名密码、enabled）
- `settings.onvif`：ONVIF 默认认证配置
- `globalConfig`（DB key）：IPC 气体传感器配置（变量名：`gasSensorConfig`）

**修改的文件：**
- `device.ts`：变量重命名为 `gasSensorConfig`，DB key 保持为 `'globalConfig'` 以向后兼容
- `settings.ts`：继续使用 `'settings.wvp'` 和 `'settings.onvif'`

### 修复三：动态读取 DB 配置

**修改的文件：**
- `VideoWall.vue`：从 `settingsStore.wvpConfig` 读取 baseUrl，不再硬编码
- `settings.ts`：返回 `initPromise`，确保启动时加载 DB 配置

## "开启 WVP 功能"开关说明

**位置：** 设置页 → WVP 视频平台配置 → "启用 WVP 功能"开关

**用途：**
- `enabled: true`：允许 VideoWall 页面初始化 WVP 连接
- `enabled: false`：禁用 WVP 功能，VideoWall 显示提示"WVP 功能未启用"

**相关代码：**
```typescript
// VideoWall.vue
if (!settingsStore.wvpConfig.enabled) {
  toast.warning('WVP 功能未启用，请在设置中开启')
  return
}
```

## 验证步骤

### 1. 修改配置
1. 打开设置页，修改 WVP baseUrl 为 `192.168.2.110`
2. 点击"保存并生效"
3. 查看浏览器 DevTools Console：
   ```
   [SETTINGS] Saving WVP config to DB: {...}
   [SETTINGS] saveConfig returned: {success: true}
   ```

### 2. 检查数据库
```bash
sqlite3 data/kenaike-sensor.db "SELECT key, value FROM config;"
```
期望输出：
```
settings.wvp|{"baseUrl":"http://192.168.2.110:18080","username":"admin","password":"admin","enabled":true}
```

### 3. 重启验证
1. 关闭应用
2. 重新启动 `pnpm dev:electron`
3. 打开设置页，确认 baseUrl 保持为 `192.168.2.110`
4. 打开 VideoWall 页面，确认使用正确的 baseUrl（查看 Console 日志）

## 技术要点总结

### Electron IPC 序列化限制

**支持的数据类型：**
- 基本类型：Number、String、Boolean、null、undefined
- 对象：Object、Array、Map、Set、Date、RegExp、Error
- 二进制：ArrayBuffer、TypedArray、Blob、File
- 循环引用的对象

**不支持的数据类型：**
- Function、Symbol
- DOM 元素
- **Proxy 对象**（Vue 的 ref、reactive）
- 带有 getter/setter 的对象属性
- 原型链上的属性

### Vue Proxy 对象处理方式

**推荐方式：**
```typescript
// 方式一：JSON 序列化（适用于纯数据）
const plainObject = JSON.parse(JSON.stringify(proxyObject))

// 方式二：Vue 提供的工具函数（适用于保留响应式）
import { toRaw } from 'vue'
const plainObject = toRaw(proxyObject)

// 方式三：ES6 spread（浅拷贝，可能仍有 Proxy）
const plainObject = { ...proxyObject }  // 不推荐！可能仍包含 Proxy
```

### 最佳实践

1. **IPC 通信前一律解包：** 所有通过 IPC 传输的数据都先进行 `JSON.parse(JSON.stringify())`
2. **使用特定 key：** 不同模块使用独立的 config key，避免污染
3. **动态读取配置：** 不要硬编码默认值，从 DB 动态读取
4. **启动时加载：** 应用启动时先加载 DB 配置，再初始化服务

## 相关文件

- `src/stores/settings.ts`：WVP/ONVIF 配置管理
- `src/stores/device.ts`：IPC 气体配置管理
- `src/stores/device-store.ts`：WVP API 服务管理
- `src/views/video/VideoWall.vue`：视频墙页面
- `src/views/settings/index.vue`：设置页面
- `electron/main.ts`：主进程 IPC 处理
- `electron/preload.ts`：preload 脚本