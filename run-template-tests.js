
const { execFileSync } = require("child_process");
const path = require("path");

// Run tests using Jest testPathPattern (brackets need escaping for regex)
const testPathPattern = "app/api/whatsapp/templates/\\[id\\]";

const args = [
  "--experimental-vm-modules",
  "node_modules/jest/bin/jest.js",
  "--testPathPattern",
  testPathPattern,
  "--no-coverage"
];
console.log("Running:", process.execPath, args.join(" "));
try {
  const result = execFileSync(process.execPath, args, {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    cwd: process.cwd(),
    timeout: 120000
  });
  console.log("Tests completed");
} catch (e) {
  console.error("Error:", e.message);
  if (e.stdout) console.error("stdout:", e.stdout.toString());
  if (e.stderr) console.error("stderr:", e.stderr.toString());
  process.exit(e.status || 1);
}

