# 设置页面设计

## 概述

为应用添加设置页面，支持动态配置 WVP API baseUrl 和 ONVIF 默认认证信息，配置持久化到 SQLite。

## 配置项

### WVP 视频平台模块
- `baseUrl`: WVP API 地址（如 `http://192.168.2.38:18080`）
- `username`: 登录用户名
- `password`: 登录密码
- `enabled`: 是否启用 WVP 功能

### ONVIF 默认认证模块
- `defaultUsername`: 默认 ONVIF 用户名
- `defaultPassword`: 默认 ONVIF 密码

## 数据存储

复用现有 SQLite `config` 表，键名：
- `settings.wvp` → JSON 字符串
- `settings.onvif` → JSON 字符串

复用现有 IPC 接口：
- `db-save-config`: 保存配置
- `db-get-config`: 加载配置

## 架构

### 新增文件
- `src/stores/settings.ts` - Settings Store
- `src/views/settings/index.vue` - 设置页面（左右分栏布局）

### 修改文件
- `src/router/index.ts` - 新增 `/settings` 路由
- `src/views/Layout.vue` - 新增设置菜单项
- `src/stores/device-store.ts` - 使用 settings store 的 WVP 配置
- `src/types/electron.d.ts` - 新增 settings 相关类型

## 数据流

1. 应用启动 → Settings Store 从 SQLite 加载配置
2. 用户在设置页修改 → Settings Store 保存到 SQLite
3. 保存 WVP 配置时 → 测试连接 → 成功则通知 WVP Store 重新初始化
4. 配置立即生效，无需重启应用

## UI 设计

### 左右分栏布局
- 左侧：模块列表（WVP 视频平台、ONVIF 默认认证）
- 右侧：选中模块的配置表单

### WVP 配置表单
- Base URL 输入框
- 用户名输入框
- 密码输入框
- 启用开关
- 测试连接按钮
- 保存按钮

### ONVIF 配置表单
- 默认用户名输入框
- 默认密码输入框
- 保存按钮

## 实现要点

1. Settings Store 使用 Pinia，响应式管理配置
2. 保存前测试 WVP 连接，失败则提示用户
3. 保存成功后立即通知 WVP Store 使用新配置重新初始化
4. 默认值：WVP baseUrl `http://192.168.2.38:18080`，用户名/密码 `admin/admin`

## 全局 Loading 效果

配置保存并生效期间，显示全局 loading 效果：
- 使用现有 Toast 组件或添加全屏 overlay
- Loading 状态由 Settings Store 管理
- 流程：测试连接 → 显示 loading → 重新初始化 WVP → 完成 → 隐藏 loading