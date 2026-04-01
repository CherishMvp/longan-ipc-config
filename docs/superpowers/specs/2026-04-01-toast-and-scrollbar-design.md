# Toast UI/UX 一致性改进、滚动条隐藏与 VideoWall Grid 优化设计文档

## 概述

本文档描述了对 Toast 组件进行 shadcn-vue 风格适配、Electron 应用全局隐藏垂直滚动条以及 VideoWall Grid 布局优化三个 UI/UX 改进的设计方案。

## 目标

1. **Toast 组件改进**：完全符合 shadcn-vue Sonner 风格设计规范，使用 lucide-vue-next 图标库
2. **滚动条隐藏**：全局隐藏右侧垂直滚动条，保留滚动功能
3. **VideoWall Grid 优化**：修复 Grid item 未撑满容器的问题，实现严格的 3x3 或 4x4 均分布局
4. **向后兼容**：保持现有 useToast API 不变，确保平滑迁移

## 整体架构

### Toast 组件架构

采用 shadcn-vue Sonner 风格设计，核心架构如下：

**组件结构：**
```
src/components/ui/toast/
├── Toast.vue              # 主容器组件
├── ToastItem.vue          # 单个 Toast 消息组件
├── index.ts               # 导出文件
└── toast.types.ts         # 类型定义（可选）
```

**设计特点：**
- **Sonner 风格动画**：从底部滑入，堆叠显示，自动消失
- **图标系统**：使用 lucide-vue-next 图标库
  - success: CheckCircle2
  - error: XCircle
  - warning: AlertTriangle
  - info: Info
- **颜色方案**：使用项目现有的 shadcn CSS 变量系统
- **响应式设计**：适配不同屏幕尺寸

### 滚动条隐藏架构

在 `src/styles/main.css` 添加全局 CSS 规则，实现跨浏览器兼容：

```css
/* 全局隐藏垂直滚动条 - Chrome/Electron */
::-webkit-scrollbar {
  width: 0;
  height: 0;
  background: transparent;
}

/* 隐藏滚动条 - Firefox */
* {
  scrollbar-width: none;
}
```

**特点：**
- 兼容多浏览器（Chrome/Electron、Firefox）
- 保持滚动功能，仅隐藏视觉
- 全局生效，无需逐个容器配置

### VideoWall Grid 优化架构

**问题分析：**
- VideoWall.vue 和 StreamPlayer.vue 都使用了 `aspect-video` 类
- `aspect-video` 强制元素保持 16:9 宽高比
- 导致 grid item 无法撑满容器，产生大量空白间距
- 无法实现严格的 3x3 或 4x4 均分布局

**解决方案：**
- 移除 StreamPlayer.vue 和 VideoWall.vue 中的 `aspect-video` 类
- 改为使用 `w-full h-full` 让每个格子撑满 grid item
- 保持现有的 grid CSS 规则（`grid-cols-3/4`, `grid-rows-3/4`）

**优化效果：**
- 每个视频格子完全撑满 grid item
- 实现严格的 3x3 或 4x4 均分布局
- 消除上下间距空白
- 保持视频内容的正确显示（使用 `object-contain`）

## 详细设计

### Toast 组件详细设计

#### Toast.vue 主容器组件

**定位与布局：**
- 固定在视口底部：`fixed bottom-4 right-4 z-[9999]`
- 使用 `TransitionGroup` 实现流畅的入场/退场动画
- 支持堆叠显示：最多 5 个消息，超过后新消息替换最旧消息
- 使用 `flex-col-reverse` 确保新消息在底部

**职责：**
- 管理消息队列（messages 数组）
- 提供全局 Toast API（success, error, warning, info）
- 控制消息生命周期（添加、移除）
- 处理堆叠逻辑和最大数量限制

#### ToastItem.vue 单消息组件

**布局结构：**
```
[图标] [消息文本] [关闭按钮]
```

**视觉设计：**
- **圆角**：`rounded-lg`（使用 --radius-lg CSS 变量）
- **阴影**：`shadow-lg`
- **背景**：根据类型使用 shadcn CSS 变量
  - success: 使用 primary 相关变量
  - error: 使用 destructive 变量
  - warning: 使用自定义 warning 变量（需要在 CSS 中定义）
  - info: 使用 accent 相关变量
- **边框**：可选的左侧彩色边框条（shadcn Sonner 风格）

**交互设计：**
- 点击关闭按钮立即消失
- 自动消失：
  - success/warning/info: 3000ms（默认）
  - error: 5000ms（更长持续时间）
- Hover 时暂停自动消失计时器
- 进度条显示剩余时间（可选功能）

**动画设计：**
- **入场动画**：从底部滑入
  ```css
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
  ```
  
- **退场动画**：向底部滑出
  ```css
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
  ```

#### useToast.ts API

**保持向后兼容：**
- 现有 API 方法保持不变：`success()`, `error()`, `warning()`, `info()`
- 参数签名保持兼容：`(message: string, duration?: number)`
- 新增可选参数：`description?: string`（详细描述文本）

**实现方式：**
```typescript
interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
  createdAt: number
}

const messages = ref<ToastMessage[]>([])
let idCounter = 0

function success(message: string, duration?: number, description?: string) {
  return add({ type: 'success', message, duration, description })
}

// error, warning, info 方法类似
```

### 滚动条隐藏详细设计

#### CSS 规则实现

在 `src/styles/main.css` 的 `@layer base` 块中添加：

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
  * {
    scrollbar-width: none;
  }
}
```

**注意**：`scrollbar-width: none` 应仅应用于需要隐藏滚动条的容器，避免全局应用导致某些特殊容器（如代码编辑器）无法显示滚动条。建议使用更精确的选择器：

```css
/* 更精确的选择器 */
body, main, aside, .scroll-container {
  scrollbar-width: none;
}

body::-webkit-scrollbar, 
main::-webkit-scrollbar, 
aside::-webkit-scrollbar {
  width: 0px;
}
```

#### 应用范围

**全局生效区域：**
- 侧边栏：设备列表、导航菜单
- 主内容区：页面主体内容
- 对话框内容区：设备详情、配置面板

**保留滚动行为：**
- 鼠标滚轮滚动
- 键盘滚动（方向键、Page Up/Down）
- 拖拽滚动
- 滚动到顶部/底部边界

### VideoWall Grid 优化详细设计

#### 问题定位

**当前代码问题：**
1. **StreamPlayer.vue 第 173 行**：
   ```vue
   <div class="relative aspect-video bg-black rounded-lg overflow-hidden border border-border group">
   ```
   使用了 `aspect-video` 类，强制容器保持 16:9 宽高比

2. **VideoWall.vue 第 230 行**（空白格子）：
   ```vue
   <div
     v-for="i in (maxSlots - store.selectedChannels.length)"
     :key="`empty-${i}`"
     class="aspect-video bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center"
   >
   ```
   同样使用了 `aspect-video` 类

**影响：**
- 每个格子不能完全撑满 grid item
- 在 3x3 或 4x4 布局中产生大量上下空白间距
- 无法实现严格的均分布局

#### 优化方案

**修改 1：StreamPlayer.vue**
- 移除 `aspect-video` 类
- 改为使用 `w-full h-full` 撑满容器
- 保持视频元素的 `object-contain` 类，确保视频内容正确显示

**修改 2：VideoWall.vue**
- 移除空白格子的 `aspect-video` 类
- 改为使用 `w-full h-full` 撑满容器
- 保持现有的 grid CSS 规则不变

#### CSS 规则验证

**现有 grid CSS 规则（正确）：**
```css
.grid {
  display: grid;
  width: 100%;
  height: 100%;
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.grid-rows-3 {
  grid-template-rows: repeat(3, 1fr);
}

.grid-rows-4 {
  grid-template-rows: repeat(4, 1fr);
}

.grid > * {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
```

**验证要点：**
- `grid-template-columns: repeat(N, 1fr)` 确保 N 列均分宽度
- `grid-template-rows: repeat(N, 1fr)` 确保 N 行均分高度
- `min-height: 0` 和 `min-width: 0` 确保 grid item 不受默认最小尺寸限制
- `overflow: hidden` 确保内容不溢出

## 数据流与错误处理

### Toast 数据流设计

**消息状态管理：**
```
useToast.ts (composable)
    ↓ 调用 Toast 方法
Toast.vue (组件实例)
    ↓ 添加消息到 messages 数组
ToastItem.vue (子组件)
    ↓ 显示单条消息
```

**生命周期：**
1. **创建阶段**：
   - 调用 useToast 方法
   - 添加到 messages 数组
   - 触发入场动画
   - 开始计时器
   
2. **显示阶段**：
   - 自动计时运行
   - Hover 时暂停计时器
   - 显示进度条（可选）
   
3. **消失阶段**：
   - 计时结束或点击关闭
   - 触发退场动画
   - 从数组移除

### 错误处理策略

**Toast 系统错误处理：**
- **防御性编程**：toastRef 为 null 时静默失败，不抛出错误
- **类型安全**：使用 TypeScript 严格类型检查
- **边界情况处理**：
  - 同时添加过多消息：限制最大数量为 5 个，超过后移除最旧消息
  - 快速连续添加：使用队列机制，确保动画流畅
  - duration 为负数或零：使用默认值（3000ms）
  - 空消息：静默失败或显示默认占位符

**滚动条隐藏注意事项：**
- **兼容性**：在不同浏览器/Electron 版本测试
- **用户体验**：确保滚动功能正常，仅隐藏视觉滚动条
- **特殊容器**：某些特殊容器（如代码编辑器）可能需要保留滚动条，使用精确选择器排除

## 测试与验证

### Toast 组件测试清单

**基础功能测试：**
1. 四种类型消息正确显示（success, error, warning, info）
2. 图标正确匹配类型（lucide-vue-next）
3. 颜色方案符合 shadcn 规范
4. 消息文本正确显示
5. 可选描述文本正确显示

**交互测试：**
1. 自动消失时间正确（success/warning/info: 3000ms, error: 5000ms）
2. 点击关闭按钮立即消失
3. Hover 暂停自动消失功能正常
4. 进度条准确显示剩余时间（如果实现）
5. 自定义 duration 参数生效

**动画测试：**
1. 入场动画流畅（从底部滑入）
2. 退场动画流畅（向底部滑出）
3. 多个消息堆叠动画协调
4. TransitionGroup 正确触发动画

**边界测试：**
1. 同时添加多个消息（测试堆叠逻辑）
2. 快速连续添加消息（测试队列机制）
3. 空消息或特殊字符（测试防御性编程）
4. 超长消息文本（测试文本截断或换行）
5. 最大数量限制生效（超过 5 个时移除最旧）

**向后兼容测试：**
1. 现有代码调用 useToast API 正常工作
2. 新增可选参数不影响现有调用
3. Toast 实例正确绑定到 toastRef

### 滚动条隐藏验证清单

**视觉验证：**
1. 所有容器滚动条不可见
2. 深色模式下滚动条隐藏
3. 浅色模式下滚动条隐藏
4. 不同内容高度时滚动条都隐藏

**功能验证：**
1. 鼠标滚轮滚动正常
2. 键盘滚动正常（方向键、Page Up/Down）
3. 拖拽滚动正常（如果支持）
4. 滚动到顶部/底部边界正确
5. 滚动位置保持正确（记忆滚动位置）

**兼容性验证：**
1. Electron 主窗口滚动条隐藏
2. Electron 对话框滚动条隐藏
3. Windows 系统测试
4. macOS 系统测试（如果支持）
5. Linux 系统测试（如果支持）

**性能验证：**
1. 滚动性能流畅（无明显卡顿）
2. 大量内容时滚动正常
3. CSS 规则不影响页面渲染性能

### VideoWall Grid 优化验证清单

**视觉验证：**
1. 3x3 布局：每个格子完全撑满 grid item，无空白间距
2. 4x4 布局：每个格子完全撑满 grid item，无空白间距
3. 混合布局：已播放视频和空白格子都撑满 grid item
4. 视频内容正确显示（使用 object-contain，不变形）

**功能验证：**
1. 视频播放正常，无黑边或溢出
2. 空白格子显示占位符文本
3. Grid 响应式布局正常
4. 切换布局（3x3 ↔ 4x4）时网格正确更新

**边界测试：**
1. 单个视频播放时撑满第一个格子
2. 多个视频播放时均匀分布
3. 最大数量视频（9 或 16）都正确显示
4. 不同分辨率视频都正确适配

**性能验证：**
1. Grid 渲染性能流畅
2. 视频播放无卡顿
3. 布局切换动画流畅

### 验证命令

**开发模式测试：**
```bash
npm run dev
```

**Electron 模式测试：**
```bash
npm run dev:electron
```

**构建后测试：**
```bash
npm run build:electron
```

**类型检查：**
```bash
vue-tsc --noEmit
```

## 实现优先级

1. **高优先级**：Toast 组件核心功能（消息显示、图标、动画）
2. **高优先级**：滚动条隐藏 CSS 规则
3. **高优先级**：VideoWall Grid 优化（移除 aspect-video）
4. **中优先级**：Toast 高级功能（hover 暂停、进度条）
5. **低优先级**：Toast 可选功能（description 参数）

## 风险与缓解

**风险 1：Toast API 变更导致现有代码失效**
- 缓解措施：保持现有 API 完全兼容，仅新增可选参数

**风险 2：滚动条隐藏影响某些特殊容器**
- 缓解措施：使用精确 CSS 选择器，排除特殊容器

**风险 3：动画性能问题**
- 缓解措施：使用 CSS 硬件加速（transform），限制最大消息数量

**风险 4：跨浏览器兼容性问题**
- 缓解措施：同时支持 Chrome/Electron 和 Firefox 的滚动条隐藏方案

**风险 5：VideoWall Grid 优化影响视频显示**
- 缓解措施：保持视频元素的 object-contain 类，确保视频内容正确显示，不变形

## 总结

本设计文档描述了完整的 Toast UI/UX 一致性改进方案、Electron 应用滚动条隐藏方案和 VideoWall Grid 布局优化方案。采用 shadcn-vue Sonner 风格设计，使用 lucide-vue-next 图标库，确保与项目现有设计系统一致。通过全局 CSS 规则实现滚动条隐藏，保持滚动功能完整。通过移除 aspect-video 类并使用 w-full h-full，实现严格的 3x3 或 4x4 均分布局。整体方案向后兼容，风险可控，测试策略完善。