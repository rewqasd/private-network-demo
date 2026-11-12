'use strict';
// 测试公共方法：加载 Playwright、启动本地静态服务器
const path = require('node:path');
const { spawn } = require('node:child_process');

function loadPlaywright() {
  const tries = ['playwright', process.env.PLAYWRIGHT_PATH, path.join(process.env.HOME || '', 'node_modules', 'playwright')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch { /* 继续尝试 */ } }
  console.error('未找到 Playwright。请先执行 `npm i -D playwright`，或设置 PLAYWRIGHT_PATH 指向已安装的 playwright 目录。');
  process.exit(2);
}

/** 启动 tests/serve.mjs，返回 { base, stop } */
function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'serve.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
    const timer = setTimeout(() => reject(new Error('本地服务器启动超时')), 8000);
    child.stdout.on('data', d => {
      if (String(d).includes('serving')) { clearTimeout(timer); resolve({ base: `http://localhost:${port}/private-network-demo/`, stop: () => child.kill() }); }
    });
    child.on('exit', code => { if (code) reject(new Error(`本地服务器退出（${code}），端口 ${port} 可能被占用`)); });
  });
}

async function launch(playwright, name = 'chromium') {
  const type = playwright[name];
  if (name === 'chromium') {
    try { return await type.launch({ headless: true }); } catch { return type.launch({ headless: true, channel: 'chrome' }); }
  }
  return type.launch({ headless: true });
}

module.exports = { loadPlaywright, startServer, launch };
