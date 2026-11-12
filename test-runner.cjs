const { execSync } = require('child_process');
const path = require('path');

process.chdir(path.resolve('.'));

const args = [
  '--experimental-vm-modules',
  './node_modules/.bin/jest',
  '--testPathPattern=refresh-token',
  '--no-coverage',
  '--forceExit',
  '--detectOpenHandles',
  '--testTimeout=10000'
];

try {
  const result = execSync(args.join(' '), { 
    encoding: 'utf8',
    timeout: 120000
  });
  console.log(result);
  process.exit(0);
} catch (err) {
  console.error(err.stderr || err.message);
  process.exit(1);
}
