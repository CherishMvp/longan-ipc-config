import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, '../package.json');

// 1. 读取当前版本
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const currentVersion = pkg.version;

// 简单的版本递增逻辑 (Patch)
const versionParts = currentVersion.split('.').map(Number);
versionParts[2] += 1;
const nextVersion = versionParts.join('.');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`\n🚀 准备发布新版本: v${currentVersion} -> v${nextVersion}`);

// 2. 获取用户输入
rl.question('📝 请输入发布描述 (Tag Message): ', (desc) => {
  if (!desc.trim()) {
    console.log('❌ 描述不能为空，已取消');
    rl.close();
    process.exit(1);
  }

  try {
    console.log('\n🔄 正在执行发布流程...');

    // 3. 更新 package.json
    pkg.version = nextVersion;
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('✅ Updated package.json version');

    // 4. Git 操作
    // 添加 package.json 变更
    execSync('git add package.json', { stdio: 'inherit' });
    
    // 提交版本变更 (使用 chore 类型)
    const commitMsg = `chore: release v${nextVersion}`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
    console.log('✅ Git commit created');

    // 打 Tag
    // -a 创建带注解的标签, -m 指定消息
    execSync(`git tag -a v${nextVersion} -m "${desc}"`, { stdio: 'inherit' });
    console.log(`✅ Git tag v${nextVersion} created`);

    // 推送
    console.log('☁️  正在推送到远程仓库 (这将触发 GitHub Actions)...');
    execSync('git push', { stdio: 'inherit' }); // 推送 commits
    execSync(`git push origin v${nextVersion}`, { stdio: 'inherit' }); // 推送 tag
    
    console.log(`\n🎉 发布成功! GitHub Actions 应该已经开始构建 v${nextVersion} 了。`);
    console.log(`🔗 查看构建状态: https://github.com/CherishMvp/longan-ipc-config/actions`);

  } catch (error) {
    console.error('\n❌ 发布失败:', error.message);
    // 可选：回滚 package.json 修改? 暂时保留以便手动检查
  } finally {
    rl.close();
  }
});
