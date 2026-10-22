#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(frontendDir, '..');
const backendDir = path.resolve(rootDir, 'backend');

console.log('\x1b[32m%s\x1b[0m', '🚀 Memulai TB-Guard (Backend + Frontend)...');
console.log(`Backend  : ${backendDir}`);
console.log(`Frontend : ${frontendDir}\n`);

const isWin = process.platform === 'win32';

function runProcess(name, color, cmd, args, cwd) {
  const p = spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  const prefix = `${color}[${name}]\x1b[0m `;

  p.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${prefix}${line}`);
      }
    }
  });

  p.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.error(`${prefix}${line}`);
      }
    }
  });

  p.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${prefix}berhenti (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`${prefix}berhenti dengan kode ${code}`);
    }
  });

  return p;
}

// 1. Jalankan Backend Go
const backend = runProcess('backend', '\x1b[36m', 'go', ['run', './cmd/server'], backendDir);

// 2. Jalankan Frontend Next.js
const frontend = runProcess('frontend', '\x1b[35m', 'npm', ['run', 'dev'], frontendDir);

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', '🛑 Menghentikan semua service...');
  
  if (isWin) {
    if (backend.pid) spawn('taskkill', ['/pid', backend.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
    if (frontend.pid) spawn('taskkill', ['/pid', frontend.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
  } else {
    if (backend.pid) backend.kill('SIGINT');
    if (frontend.pid) frontend.kill('SIGINT');
  }

  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
