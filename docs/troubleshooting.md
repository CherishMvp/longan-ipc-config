# 问题排查记录

## 2026-01-27: pnpm dlx shadcn-vue 失败 (Corepack 签名验证错误)

### 问题现象
执行 `pnpm dlx shadcn-vue@latest add ...` 时报错：
```
Error: Cannot find matching keyid: {"signatures":[...]}
```
这导致无法通过 CLI 自动添加 shadcn 组件，必须手动复制代码。

### 原因分析
1. **Corepack 版本过旧**：Node.js (v20.18.0) 内置的 Corepack 版本较旧，其内置的 GPG 公钥列表可能已过期，无法验证新版 pnpm 的签名。
2. **残留的 Auth Token**：`.npmrc` 中存在失效的 `//registry.npmjs.org/:_authToken`，导致请求被拒绝或鉴权失败。
3. **混合镜像源**：使用了淘宝镜像源 (`npmmirror`) 配合过期的官方 Token，加剧了验证问题。

### 解决方案
按以下顺序执行命令修复：

1. **清理无效配置**：
   ```bash
   npm config delete "//registry.npmjs.org/:_authToken"
   ```

2. **强制升级 Corepack** (关键步骤)：
   ```bash
   npm install -g corepack@latest
   ```

3. **重新激活 pnpm**：
   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

### 验证
执行 `pnpm dlx shadcn-vue@latest add avatar` 成功，证明环境已修复。

---
