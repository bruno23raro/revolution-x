#!/usr/bin/env node
const { spawn } = require('child_process');

const args = [
  '--experimental-vm-modules',
  require.resolve('jest/bin/jest.js'),
  '--testPathPattern=refresh-token',
  '--no-coverage',
  '--forceExit',
  '--detectOpenHandles'
];

const child = spawn(process.execPath, args, {
  cwd: __dirname,
  env: { ...process.env, FORCE_COLOR: '0' },
  timeout: 60000
});

let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data.toString());
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  output += str;
  process.stderr.write(str);
});

child.on('close', (code) => {
  console.log(`\n[TEST EXIT CODE: ${code}]`);
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Spawn error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  if (child.pid) {
    child.kill();
    console.log('Timeout - process killed');
  }
}, 30000);