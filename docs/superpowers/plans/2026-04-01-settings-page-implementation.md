# 设置页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加设置页面，支持动态配置 WVP API 和 ONVIF 认证，配置持久化到 SQLite 并立即生效。

**Architecture:** 创建 Settings Store 管理 WVP/ONVIF 配置，通过 Pinia 响应式更新。设置页面使用左右分栏布局，保存时测试连接并显示全局 loading。

**Tech Stack:** Vue 3, Pinia, SQLite, TailwindCSS, radix-vue UI components

---

## 文件结构

### 新增文件
- `src/stores/settings.ts` - Settings Store，管理配置加载/保存/测试连接
- `src/views/settings/index.vue` - 设置页面，左右分栏布局
- `src/components/SettingsLoadingOverlay.vue` - 全局 Loading overlay

### 修改文件
- `src/router/index.ts` - 新增 `/settings` 路由
- `src/views/Layout.vue` - 新增设置菜单项
- `src/stores/device-store.ts` - 使用 settings store 的 WVP 配置初始化

---

## Task 1: 创建 Settings Store

**Files:**
- Create: `src/stores/settings.ts`

- [ ] **Step 1: 创建 settings store 文件**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WVPApiService } from '@/services/wvp-api'
import { useWVPStore } from './device-store'

export interface WVPConfig {
  baseUrl: string
  username: string
  password: string
  enabled: boolean
}

export interface ONVIFConfig {
  defaultUsername: string
  defaultPassword: string
}

export const useSettingsStore = defineStore('settings', () => {
  const wvpConfig = ref<WVPConfig>({
    baseUrl: 'http://192.168.2.38:18080',
    username: 'admin',
    password: 'admin',
    enabled: true
  })
  
  const onvifConfig = ref<ONVIFConfig>({
    defaultUsername: 'admin',
    defaultPassword: 'admin123'
  })
  
  const loading = ref(false)
  const loadingMessage = ref('')
  
  async function loadFromDB() {
    if (!window.electronAPI) return
    
    try {
      const config = await window.electronAPI.getConfig()
      
      if (config['settings.wvp']) {
        wvpConfig.value = { ...wvpConfig.value, ...config['settings.wvp'] }
      }
      
      if (config['settings.onvif']) {
        onvifConfig.value = { ...onvifConfig.value, ...config['settings.onvif'] }
      }
    } catch (e) {
      console.error('Failed to load settings from DB:', e)
    }
  }
  
  async function saveWVPConfig(): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API not available' }
    }
    
    loading.value = true
    loadingMessage.value = '正在测试 WVP 连接...'
    
    try {
      // 测试连接
      const api = new WVPApiService(wvpConfig.value.baseUrl)
      await api.login(wvpConfig.value.username, wvpConfig.value.password)
      
      loadingMessage.value = '正在保存配置...'
      
      // 保存到数据库
      await window.electronAPI.saveConfig({
        'settings.wvp': wvpConfig.value
      })
      
      loadingMessage.value = '正在重新初始化 WVP...'
      
      // 通知 WVP store 重新初始化
      const wvpStore = useWVPStore()
      if (wvpConfig.value.enabled && wvpStore.wvpConnected) {
        await wvpStore.initializeWVP(
          wvpConfig.value.baseUrl,
          wvpConfig.value.username,
          wvpConfig.value.password
        )
      }
      
      loading.value = false
      return { success: true }
    } catch (e: any) {
      loading.value = false
      return { success: false, error: e.message || '保存失败' }
    }
  }
  
  async function saveONVIFConfig(): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API not available' }
    }
    
    try {
      await window.electronAPI.saveConfig({
        'settings.onvif': onvifConfig.value
      })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || '保存失败' }
    }
  }
  
  // 初始化时加载配置
  loadFromDB()
  
  return {
    wvpConfig,
    onvifConfig,
    loading,
    loadingMessage,
    loadFromDB,
    saveWVPConfig,
    saveONVIFConfig
  }
})
```

- [ ] **Step 2: Commit settings store**

```bash
git add src/stores/settings.ts
git commit -m "feat: add settings store for WVP and ONVIF config"
```

---

## Task 2: 创建全局 Loading Overlay

**Files:**
- Create: `src/components/SettingsLoadingOverlay.vue`

- [ ] **Step 1: 创建 loading overlay 组件**

```vue
<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { Loader2 } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="settingsStore.loading"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div class="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg">
          <Loader2 class="w-8 h-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground">{{ settingsStore.loadingMessage }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

- [ ] **Step 2: Commit loading overlay**

```bash
git add src/components/SettingsLoadingOverlay.vue
git commit -m "feat: add settings loading overlay component"
```

---

## Task 3: 创建设置页面

**Files:**
- Create: `src/views/settings/index.vue`

- [ ] **Step 1: 创建设置页面（左右分栏布局）**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { Settings2, Wifi } from 'lucide-vue-next'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Input from '@/components/ui/input/Input.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import SettingsLoadingOverlay from '@/components/SettingsLoadingOverlay.vue'

const settingsStore = useSettingsStore()
const toast = useToast()

const activeModule = ref<'wvp' | 'onvif'>('wvp')

const modules = [
  { id: 'wvp', name: 'WVP 视频平台', icon: Settings2 },
  { id: 'onvif', name: 'ONVIF 默认认证', icon: Wifi }
]

async function handleSaveWVP() {
  const result = await settingsStore.saveWVPConfig()
  
  if (result.success) {
    toast.success('WVP 配置已保存并生效')
  } else {
    toast.error(result.error || '保存失败')
  }
}

async function handleSaveONVIF() {
  const result = await settingsStore.saveONVIFConfig()
  
  if (result.success) {
    toast.success('ONVIF 配置已保存')
  } else {
    toast.error(result.error || '保存失败')
  }
}
</script>

<template>
  <div class="flex gap-6">
    <SettingsLoadingOverlay />
    
    <!-- 左侧模块列表 -->
    <aside class="w-48 flex flex-col gap-2">
      <button
        v-for="module in modules"
        :key="module.id"
        @click="activeModule = module.id"
        class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all"
        :class="[
          activeModule === module.id
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        ]"
      >
        <component :is="module.icon" class="w-4 h-4" />
        <span>{{ module.name }}</span>
      </button>
    </aside>
    
    <!-- 右侧配置表单 -->
    <div class="flex-1">
      <!-- WVP 配置 -->
      <Card v-if="activeModule === 'wvp'">
        <CardHeader>
          <CardTitle>WVP 视频平台配置</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">API 地址</label>
            <Input
              v-model="settingsStore.wvpConfig.baseUrl"
              placeholder="http://192.168.2.38:18080"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">用户名</label>
            <Input
              v-model="settingsStore.wvpConfig.username"
              placeholder="admin"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">密码</label>
            <Input
              v-model="settingsStore.wvpConfig.password"
              type="password"
              placeholder="admin"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">启用 WVP 功能</label>
            <Switch
              :checked="settingsStore.wvpConfig.enabled"
              @update:checked="settingsStore.wvpConfig.enabled = $event"
            />
          </div>
          
          <div class="flex gap-3 mt-4">
            <Button @click="handleSaveWVP" :disabled="settingsStore.loading">
              保存并生效
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <!-- ONVIF 配置 -->
      <Card v-if="activeModule === 'onvif'">
        <CardHeader>
          <CardTitle>ONVIF 默认认证配置</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">默认用户名</label>
            <Input
              v-model="settingsStore.onvifConfig.defaultUsername"
              placeholder="admin"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">默认密码</label>
            <Input
              v-model="settingsStore.onvifConfig.defaultPassword"
              type="password"
              placeholder="admin123"
            />
          </div>
          
          <div class="flex gap-3 mt-4">
            <Button @click="handleSaveONVIF">
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit 设置页面**

```bash
git add src/views/settings/index.vue
git commit -m "feat: add settings page with WVP and ONVIF config"
```

---

## Task 4: 新增路由

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: 在路由配置中添加 settings 路由**

找到 `src/router/index.ts` 的 `children` 数组，在现有路由后添加：

```typescript
{
  path: 'settings',
  name: 'Settings',
  component: () => import('@/views/settings/index.vue'),
  meta: { title: '设置' }
}
```

完整修改后的 `routes` 数组：

```typescript
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'gas-config',
        name: 'GasConfig',
        component: () => import('@/views/gas-config/index.vue'),
        meta: { title: 'IPC气体配置' }
      },
      {
        path: 'discovery',
        name: 'DeviceDiscovery',
        component: () => import('@/views/discovery/index.vue'),
        meta: { title: '设备自动发现' }
      },
      {
        path: 'video-wall',
        name: 'VideoWall',
        component: () => import('@/views/video/VideoWall.vue'),
        meta: { title: '监控大屏' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '设置' }
      }
    ]
  }
]
```

- [ ] **Step 2: Commit 路由修改**

```bash
git add src/router/index.ts
git commit -m "feat: add settings route"
```

---

## Task 5: 新增菜单项

**Files:**
- Modify: `src/views/Layout.vue`

- [ ] **Step 1: 在 Layout.vue 添加设置菜单项**

修改 `menuItems` 数组，添加 Settings 菜单项：

```typescript
const menuItems = [
  { path: '/', name: '首页', icon: Home },
  { path: '/video-wall', name: '监控大屏', icon: MonitorPlay },
  { path: '/discovery', name: '设备自动发现', icon: Wifi },
  { path: '/gas-config', name: 'IPC 气体配置', icon: Settings2 },
  { path: '/settings', name: '设置', icon: Settings }
]
```

同时需要在 import 中添加 `Settings` 图标：

```typescript
import { Home, Settings2, Wifi, MonitorPlay, Settings } from 'lucide-vue-next'
```

- [ ] **Step 2: Commit Layout 修改**

```bash
git add src/views/Layout.vue
git commit -m "feat: add settings menu item"
```

---

## Task 6: 修改 device-store 使用 settings

**Files:**
- Modify: `src/stores/device-store.ts`

- [ ] **Step 1: 让 WVP store 使用 settings store 的配置初始化**

修改 `src/stores/device-store.ts` 的 `initializeWVP` 函数：

在文件顶部添加 import：

```typescript
import { useSettingsStore } from './settings'
```

修改 `initializeWVP` 函数，使其可以从 settings store 获取默认配置：

```typescript
async function initializeWVP(baseUrl?: string, username?: string, password?: string) {
  const settingsStore = useSettingsStore()
  
  // 使用传入的参数或从 settings store 获取
  const finalBaseUrl = baseUrl || settingsStore.wvpConfig.baseUrl
  const finalUsername = username || settingsStore.wvpConfig.username
  const finalPassword = password || settingsStore.wvpConfig.password
  
  wvpBaseUrl.value = finalBaseUrl
  wvpApi.value = new WVPApiService(finalBaseUrl)
  
  const token = await wvpApi.value.login(finalUsername, finalPassword)
  wvpConnected.value = true
  
  console.log('WVP initialized, token:', token)
}
```

- [ ] **Step 2: Commit device-store 修改**

```bash
git add src/stores/device-store.ts
git commit -m "feat: make WVP store use settings config"
```

---

## Task 7: 验证和最终提交

- [ ] **Step 1: 运行开发服务器测试**

```bash
pnpm dev
```

手动测试：
1. 导航到设置页面
2. 修改 WVP 配置
3. 点击保存，观察 loading 效果
4. 检查配置是否生效
5. 测试 ONVIF 配置保存

- [ ] **Step 2: 类型检查**

```bash
pnpm build
```

确保没有类型错误。

- [ ] **Step 3: 最终提交（如果前面步骤都成功）**

所有功能已实现，分支完成。