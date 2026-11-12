import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jestPath = join(__dirname, 'node_modules', 'jest', 'bin', 'jest.js');
const testPath = 'src/tests/publish-idor.test.ts';

try {
  const result = execSync(`node --experimental-vm-modules "${jestPath}" "${testPath}" --passWithNoTests`, {
    encoding: 'utf-8',
    timeout: 120000,
    env: { ...process.env, NODE_ENV: 'development', RX_DEMO_MODE: '1' }
  });
  console.log(result);
} catch (error) {
  console.error(error.stdout || error.message);
  if (error.stderr) console.error(error.stderr);
  process.exit(error.status || 1);
}