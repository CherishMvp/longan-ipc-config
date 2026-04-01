# Toast、滚动条与 VideoWall Grid 优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Toast 组件为 shadcn-vue Sonner 风格，全局隐藏滚动条，优化 VideoWall Grid 布局

**Architecture:** 采用组件分离架构（Toast.vue + ToastItem.vue），使用 lucide-vue-next 图标，通过全局 CSS 规则隐藏滚动条，移除 aspect-video 类实现严格 Grid 布局

**Tech Stack:** Vue 3 Composition API, lucide-vue-next, Tailwind CSS 4, TypeScript

---

## File Structure

### Toast 组件文件
- **创建**: `src/components/ui/toast/ToastItem.vue` - 单个 Toast 消息组件
- **修改**: `src/components/ui/toast/Toast.vue` - 主容器组件，重构为 Sonner 风格
- **修改**: `src/composables/useToast.ts` - 保持 API 向后兼容，新增可选参数

### 滚动条隐藏文件
- **修改**: `src/styles/main.css` - 添加全局滚动条隐藏 CSS 规则

### VideoWall Grid 优化文件
- **修改**: `src/components/VideoPlayer/StreamPlayer.vue` - 移除 aspect-video，改为 w-full h-full
- **修改**: `src/views/video/VideoWall.vue` - 移除空白格子的 aspect-video

### 测试文件
- **手动测试**: 启动开发服务器和 Electron 应用，验证功能

---

## Task 1: VideoWall Grid 优化 - StreamPlayer.vue

**Files:**
- Modify: `src/components/VideoPlayer/StreamPlayer.vue:173`

**Reason:** 移除 aspect-video 类，让视频容器撑满 grid item

- [ ] **Step 1: 修改 StreamPlayer.vue 根容器类名**

修改第 173 行，移除 `aspect-video`，改为 `w-full h-full`：

```vue
<div class="relative w-full h-full bg-black rounded-lg overflow-hidden border border-border group">
```

Expected: 容器完全撑满父 grid item，不再保持固定宽高比

- [ ] **Step 2: 验证视频元素样式**

确认第 177 行的视频元素已有 `object-contain` 类，确保视频内容正确显示：

```vue
<video
  ref="videoRef"
  class="w-full h-full object-contain"
  :class="{ 'opacity-50': isConnecting && retryCount > 0 }"
  muted
  playsinline
  autoplay
/>
```

Expected: 视频内容按容器尺寸适配，不变形

- [ ] **Step 3: 手动测试 - 启动开发服务器**

Run: `npm run dev`

Expected: VideoWall 页面中，视频格子完全撑满 grid item，无空白间距

- [ ] **Step 4: 提交 VideoWall StreamPlayer 优化**

```bash
git add src/components/VideoPlayer/StreamPlayer.vue
git commit -m "fix(videowall): remove aspect-video to fill grid items"
```

---

## Task 2: VideoWall Grid 优化 - VideoWall.vue

**Files:**
- Modify: `src/views/video/VideoWall.vue:230`

**Reason:** 移除空白格子的 aspect-video 类，与播放格子保持一致

- [ ] **Step 1: 修改空白格子样式**

修改第 230 行，移除 `aspect-video`，改为 `w-full h-full`：

```vue
<div
  v-for="i in (maxSlots - store.selectedChannels.length)"
  :key="`empty-${i}`"
  class="w-full h-full bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center"
>
  <span class="text-muted-foreground/50 text-sm">点击左侧添加</span>
</div>
```

Expected: 空白格子完全撑满 grid item，与视频格子一致

- [ ] **Step 2: 手动测试 - Electron 模式**

Run: `npm run dev:electron`

Expected: Electron 应用中，VideoWall 的 3x3 和 4x4 布局都正确，所有格子撑满

- [ ] **Step 3: 测试布局切换**

在 Electron 应用中：
1. 选择 3x3 布局，验证 9 个格子均分
2. 选择 4x4 布局，验证 16 个格子均分
3. 添加 1 个视频，验证撑满第一个格子
4. 添加多个视频，验证均匀分布

Expected: 所有布局模式下，格子都完全撑满容器，无空白间距

- [ ] **Step 4: 提交 VideoWall 空白格子优化**

```bash
git add src/views/video/VideoWall.vue
git commit -m "fix(videowall): remove aspect-video from empty slots to fill grid"
```

---

## Task 3: 滚动条隐藏 - 全局 CSS 规则

**Files:**
- Modify: `src/styles/main.css:113-120`

**Reason:** 全局隐藏垂直滚动条，保留滚动功能

- [ ] **Step 1: 在 main.css 的 @layer base 中添加滚动条隐藏规则**

在 `@layer base` 块末尾（第 120 行后）添加：

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  
  /* 隐藏滚动条 - Chrome/Electron */
  ::-webkit-scrollbar {
    width: 0px;
    background: transparent;
  }
  
  /* 隐藏滚动条 - Firefox */
  body, main, aside, .scroll-container {
    scrollbar-width: none;
  }
  
  body::-webkit-scrollbar,
  main::-webkit-scrollbar,
  aside::-webkit-scrollbar {
    width: 0px;
  }
}
```

Expected: 所有主要容器（body, main, aside）的滚动条都隐藏

- [ ] **Step 2: 手动测试 - 验证滚动条隐藏**

Run: `npm run dev:electron`

在 Electron 应用中检查：
1. 侧边栏滚动条不可见
2. 主内容区滚动条不可见
3. VideoWall 侧边栏滚动条不可见
4. 鼠标滚轮滚动功能正常

Expected: 滚动条视觉隐藏，滚动功能正常

- [ ] **Step 3: 提交滚动条隐藏功能**

```bash
git add src/styles/main.css
git commit -m "feat(ui): hide scrollbar globally while preserving scroll functionality"
```

---

## Task 4: Toast 组件重构 - 创建 ToastItem.vue

**Files:**
- Create: `src/components/ui/toast/ToastItem.vue`

**Reason:** 创建单个 Toast 消息组件，符合 shadcn-vue Sonner 风格

- [ ] **Step 1: 创建 ToastItem.vue 组件文件**

创建新文件 `src/components/ui/toast/ToastItem.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import type { ToastMessage } from './Toast.vue'

const props = defineProps<{
  message: ToastMessage
}>()

const emit = defineEmits<{
  (e: 'close', id: number): void
}>()

const isPaused = ref(false)
let timer: number | null = null
let remainingTime = props.message.duration || 3000
let startTime = Date.now()

function getIcon(type: string) {
  switch (type) {
    case 'success': return CheckCircle2
    case 'error': return XCircle
    case 'warning': return AlertTriangle
    case 'info': return Info
    default: return Info
  }
}

function getIconColor(type: string) {
  switch (type) {
    case 'success': return 'text-green-500'
    case 'error': return 'text-red-500'
    case 'warning': return 'text-yellow-500'
    case 'info': return 'text-blue-500'
    default: return 'text-blue-500'
  }
}

function startTimer() {
  if (timer) clearTimeout(timer)
  startTime = Date.now()
  timer = window.setTimeout(() => {
    emit('close', props.message.id)
  }, remainingTime)
}

function pauseTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
    remainingTime -= Date.now() - startTime
  }
  isPaused.value = true
}

function resumeTimer() {
  if (isPaused.value) {
    startTimer()
    isPaused.value = false
  }
}

function handleClose() {
  if (timer) clearTimeout(timer)
  emit('close', props.message.id)
}

onMounted(() => {
  startTimer()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div
    class="flex items-start gap-3 p-4 rounded-lg shadow-lg border bg-background text-foreground min-w-[300px] max-w-[500px] transition-all duration-300"
    :class="{
      'border-green-500/50': message.type === 'success',
      'border-red-500/50': message.type === 'error',
      'border-yellow-500/50': message.type === 'warning',
      'border-blue-500/50': message.type === 'info'
    }"
    @mouseenter="pauseTimer"
    @mouseleave="resumeTimer"
  >
    <component
      :is="getIcon(message.type)"
      class="w-5 h-5 flex-shrink-0"
      :class="getIconColor(message.type)"
    />
    
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium">{{ message.message }}</p>
      <p v-if="message.description" class="text-xs text-muted-foreground mt-1">
        {{ message.description }}
      </p>
    </div>
    
    <button
      class="flex-shrink-0 p-1 rounded-sm hover:bg-muted transition-colors"
      @click="handleClose"
    >
      <X class="w-4 h-4 text-muted-foreground hover:text-foreground" />
    </button>
  </div>
</template>
```

Expected: ToastItem 组件创建成功，使用 lucide-vue-next 图标

- [ ] **Step 2: 提交 ToastItem 组件**

```bash
git add src/components/ui/toast/ToastItem.vue
git commit -m "feat(ui): create ToastItem component with lucide icons"
```

---

## Task 5: Toast 组件重构 - 重构 Toast.vue

**Files:**
- Modify: `src/components/ui/toast/Toast.vue`

**Reason:** 重构为 shadcn-vue Sonner 风格，使用 ToastItem 子组件

- [ ] **Step 1: 重构 Toast.vue 主容器组件**

完全替换 Toast.vue 内容：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ToastItem from './ToastItem.vue'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

const messages = ref<ToastMessage[]>([])
let idCounter = 0

const MAX_MESSAGES = 5

function add(message: Omit<ToastMessage, 'id'>) {
  const id = idCounter++
  const toast: ToastMessage = { ...message, id }
  
  if (messages.value.length >= MAX_MESSAGES) {
    messages.value.shift()
  }
  
  messages.value.push(toast)
  return id
}

function remove(id: number) {
  const index = messages.value.findIndex(m => m.id === id)
  if (index > -1) {
    messages.value.splice(index, 1)
  }
}

function success(message: string, duration?: number, description?: string) {
  return add({ type: 'success', message, duration: duration || 3000, description })
}

function error(message: string, duration?: number, description?: string) {
  return add({ type: 'error', message, duration: duration || 5000, description })
}

function warning(message: string, duration?: number, description?: string) {
  return add({ type: 'warning', message, duration: duration || 3000, description })
}

function info(message: string, duration?: number, description?: string) {
  return add({ type: 'info', message, duration: duration || 3000, description })
}

defineExpose({
  add,
  remove,
  success,
  error,
  warning,
  info
})
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <ToastItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        class="pointer-events-auto"
        @close="remove"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active {
  animation: slideIn 0.3s ease-out;
}

.toast-leave-active {
  animation: slideOut 0.3s ease-in;
}

@keyframes slideIn {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}
</style>
```

Expected: Toast 组件重构为 Sonner 风格，从底部滑入，堆叠显示

- [ ] **Step 2: 手动测试 - Toast 功能**

Run: `npm run dev:electron`

在 Electron 应用中：
1. 触发 success Toast，验证图标和颜色
2. 触发 error Toast，验证图标和颜色
3. 触发 warning Toast，验证图标和颜色
4. 触发 info Toast，验证图标和颜色
5. Hover Toast，验证暂停自动消失
6. 点击关闭按钮，验证立即消失

Expected: Toast 显示正确，动画流畅，交互正常

- [ ] **Step 3: 提交 Toast 组件重构**

```bash
git add src/components/ui/toast/Toast.vue
git commit -m "refactor(ui): redesign Toast component to shadcn Sonner style"
```

---

## Task 6: Toast 组件重构 - 更新 useToast API

**Files:**
- Modify: `src/composables/useToast.ts`

**Reason:** 保持 API 向后兼容，新增可选 description 参数

- [ ] **Step 1: 更新 useToast.ts，添加 description 参数支持**

修改 useToast.ts：

```typescript
import { ref } from 'vue'

const toastRef = ref<any>(null)

export function useToast() {
  function setToastInstance(instance: any) {
    toastRef.value = instance
  }

  function success(message: string, duration?: number, description?: string) {
    toastRef.value?.success(message, duration, description)
  }

  function error(message: string, duration?: number, description?: string) {
    toastRef.value?.error(message, duration, description)
  }

  function warning(message: string, duration?: number, description?: string) {
    toastRef.value?.warning(message, duration, description)
  }

  function info(message: string, duration?: number, description?: string) {
    toastRef.value?.info(message, duration, description)
  }

  return {
    setToastInstance,
    success,
    error,
    warning,
    info
  }
}
```

Expected: API 保持向后兼容，新增可选 description 参数

- [ ] **Step 2: 手动测试 - API 向后兼容性**

Run: `npm run dev:electron`

检查现有代码调用 useToast 的地方（如 VideoWall.vue）：
1. `toast.success('WVP 连接成功')` - 无 duration，正常工作
2. `toast.error(`加载失败：${err.message}`)` - 正常工作
3. 添加新调用：`toast.success('成功', 3000, '详细描述')` - description 显示

Expected: 所有现有调用正常工作，新增 description 功能生效

- [ ] **Step 3: 提交 useToast API 更新**

```bash
git add src/composables/useToast.ts
git commit -m "feat(ui): add optional description parameter to useToast API"
```

---

## Task 7: 类型检查与构建测试

**Files:**
- Test: TypeScript type checking
- Test: Build process

**Reason:** 确保代码无类型错误，构建成功

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `vue-tsc --noEmit`

Expected: 无类型错误

- [ ] **Step 2: 运行构建测试**

Run: `npm run build`

Expected: 构建成功，无错误

- [ ] **Step 3: 提交最终验证**

```bash
git add -A
git commit -m "test: verify type checking and build success"
```

---

## Task 8: Electron 构建与最终测试

**Files:**
- Test: Electron build and runtime

**Reason:** 确保 Electron 应用打包成功，功能完整

- [ ] **Step 1: 构建 Electron 应用**

Run: `npm run build:electron`

Expected: Electron 应用打包成功

- [ ] **Step 2: 运行打包后的 Electron 应用**

运行打包后的应用（Windows: `release/longan-ipc-tools-1.0.5-win-x64.exe`）

测试所有功能：
1. **VideoWall Grid**：
   - 3x3 布局格子完全撑满
   - 4x4 布局格子完全撑满
   - 视频播放无黑边
   - 空白格子撑满
   
2. **滚动条隐藏**：
   - 侧边栏滚动条隐藏
   - 主内容区滚动条隐藏
   - 滚动功能正常
   
3. **Toast 组件**：
   - 四种类型图标正确
   - 从底部滑入动画流畅
   - Hover 暂停功能正常
   - 关闭按钮正常工作

Expected: 所有功能正常，无视觉问题

- [ ] **Step 3: 提交最终完成**

```bash
git add -A
git commit -m "feat(ui): complete Toast, scrollbar, and VideoWall grid optimization"
```

---

## Implementation Priority

按照以下顺序执行任务：

1. **高优先级**: Task 1-2 (VideoWall Grid 优化) - 最简单，立即见效
2. **高优先级**: Task 3 (滚动条隐藏) - 简单 CSS 规则
3. **高优先级**: Task 4-6 (Toast 组件重构) - 核心功能
4. **中优先级**: Task 7 (类型检查与构建)
5. **低优先级**: Task 8 (Electron 构建与最终测试)

---

## Risk Mitigation

**风险 1**: Toast API 变更导致现有代码失效
- **缓解**: Task 6 确保向后兼容，测试现有调用

**风险 2**: 滚动条隐藏影响特殊容器
- **缓解**: Task 3 使用精确选择器（body, main, aside）

**风险 3**: VideoWall Grid 优化影响视频显示
- **缓解**: Task 1 保持 object-contain，确保视频不变形

**风险 4**: Toast 动画性能问题
- **缓解**: Task 5 使用 CSS transform，限制最大消息数量

---

## Testing Checklist

执行所有任务后，确保以下功能正常：

### VideoWall Grid
- [ ] 3x3 布局格子完全撑满，无空白间距
- [ ] 4x4 布局格子完全撑满，无空白间距
- [ ] 视频内容正确显示，不变形
- [ ] 空白格子撑满，与视频格子一致

### 滚动条隐藏
- [ ] 侧边栏滚动条不可见
- [ ] 主内容区滚动条不可见
- [ ] 滚动功能正常（鼠标滚轮、键盘）
- [ ] 深色/浅色模式都隐藏

### Toast 组件
- [ ] success 图标和颜色正确（CheckCircle2, 绿色）
- [ ] error 图标和颜色正确（XCircle, 红色）
- [ ] warning 图标和颜色正确（AlertTriangle, 黄色）
- [ ] info 图标和颜色正确（Info, 蓝色）
- [ ] 从底部滑入动画流畅
- [ ] 向底部滑出动画流畅
- [ ] Hover 暂停自动消失
- [ ] 点击关闭按钮立即消失
- [ ] 自动消失时间正确（success/warning/info: 3000ms, error: 5000ms）
- [ ] 堆叠显示正常，最多 5 个
- [ ] description 参数功能生效
- [ ] API 向后兼容，现有调用正常

---

## Summary

本实现计划包含 8 个任务，按照优先级执行：

1. **VideoWall Grid 优化**（2 个任务）：移除 aspect-video，实现严格 Grid 布局
2. **滚动条隐藏**（1 个任务）：全局 CSS 规则，隐藏滚动条
3. **Toast 组件重构**（3 个任务）：创建 ToastItem，重构 Toast，更新 useToast
4. **测试与验证**（2 个任务）：类型检查、构建测试、Electron 测试

所有任务都包含详细步骤、代码示例、测试命令和提交说明。遵循 DRY、YAGNI、TDD 原则，频繁提交。