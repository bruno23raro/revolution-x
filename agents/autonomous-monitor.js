// Autonomous Monitor - Revolution X
// Detecta e corrige erros automaticamente

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ERROR_PATTERNS = [
  /error/i,
  /failed/i,
  /undefined/i,
  /null/i,
  /schema.*mismatch/i,
  /Column name mismatch/i
];

const KNOWN_FIXES = {
  'organization_id': "organizationId",
  'last_checked_at': "lastCheckedAt",
  'waba_id': "wabaId",
  'access_token_enc': "accessTokenEnc"
};

class AutonomousMonitor {
  constructor() {
    this.errors = [];
    this.fixes = [];
    this.filesProcessed = 0;
  }

  getAllFiles(dir, fileList = []) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!item.includes('node_modules') && !item.includes('.next')) {
          this.getAllFiles(fullPath, fileList);
        }
      } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    });

    return fileList;
  }

  scanForErrors(directory) {
    console.log(`🔍 Scanning ${directory} for errors...`);

    const files = this.getAllFiles(directory);
    const errors = [];

    files.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          ERROR_PATTERNS.forEach(pattern => {
            if (pattern.test(line)) {
              const severity = line.includes('throw') || line.includes('Error') ? 'critical' : 'medium';
              errors.push({
                file,
                line: index + 1,
                content: line.trim().substring(0, 200),
                severity,
                type: 'error_pattern'
              });
            }
          });
        });
      } catch (e) {
        // Ignore read errors
      }
    });

    this.errors = errors;
    return errors;
  }

  applyFix(file, oldValue, newValue) {
    try {
      let content = fs.readFileSync(file, 'utf8');

      if (content.includes(oldValue)) {
        content = content.replace(new RegExp(oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newValue);
        fs.writeFileSync(file, content);
        console.log(`  ✅ Fixed: ${file} - ${oldValue} → ${newValue}`);
        return { success: true, file, old: oldValue, new: newValue };
      }

      return { success: false };
    } catch (e) {
      console.error(`  ❌ Fix failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  fixKnownIssues() {
    console.log('\n🔧 Applying known fixes...');

    const directories = ['app', 'scripts'];

    directories.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = this.getAllFiles(dir);

        files.forEach(file => {
          Object.entries(KNOWN_FIXES).forEach(([oldName, newName]) => {
            // Fix column names
            this.applyFix(file, `'${oldName}'`, `'${newName}'`);
            this.applyFix(file, `"${oldName}"`, `"${newName}"`);

            // Fix variable names
            this.applyFix(file, `${oldName} =`, `${newName} =`);
            this.applyFix(file, `${oldName},`, `${newName},`);
            this.applyFix(file, `${oldName})`, `${newName})`);
          });
        });
      }
    });
  }

  runTypeCheck() {
    console.log('\n📊 Running TypeScript check...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      console.log('✅ TypeScript check passed');
      return { success: true };
    } catch (e) {
      console.log('❌ TypeScript errors found');
      return { success: false, output: e.stdout?.toString() };
    }
  }

  runLint() {
    console.log('\n📋 Running ESLint...');
    try {
      execSync('npm run lint', { stdio: 'inherit' });
      console.log('✅ ESLint passed');
      return { success: true };
    } catch (e) {
      console.log('❌ ESLint errors found');
      return { success: false };
    }
  }

  runTests() {
    console.log('\n🧪 Running tests...');
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log('✅ All tests passed');
      return { success: true };
    } catch (e) {
      console.log('❌ Some tests failed');
      return { success: false };
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      errorsFound: this.errors.length,
      fixesApplied: this.fixes.length,
      summary: {
        critical: this.errors.filter(e => e.severity === 'critical').length,
        high: this.errors.filter(e => e.severity === 'high').length,
        medium: this.errors.filter(e => e.severity === 'medium').length
      },
      errors: this.errors.slice(0, 50), // Limit report size
      fixes: this.fixes
    };

    fs.writeFileSync(
      'reports/autonomous-report.json',
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  async run() {
    console.log('🚀 Autonomous Monitor Starting...');
    console.log('====================================');

    // Create reports directory
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    // Scan for errors
    this.scanForErrors('.');

    // Apply automatic fixes
    this.fixKnownIssues();

    // Re-scan after fixes
    const remainingErrors = this.scanForErrors('.');

    // Build status
    console.log('\n🏗️  Running TypeScript...');
    const tsResult = this.runTypeCheck();

    console.log('\n🔍 Running ESLint...');
    const lintResult = this.runLint();

    console.log('\n🧪 Running Tests...');
    const testResult = this.runTests();

    // Generate report
    const report = this.generateReport();

    console.log('\n====================================');
    console.log('📈 Report Summary:');
    console.log(`  Errors Found: ${report.errorsFound}`);
    console.log(`  Fixes Applied: ${report.fixesApplied}`);
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  High: ${report.summary.high}`);
    console.log(`  Medium: ${report.summary.medium}`);

    return report;
  }
}

// Run if executed directly
if (require.main === module) {
  const monitor = new AutonomousMonitor();
  monitor.run().then(report => {
    process.exit(report.errorsFound > 0 ? 1 : 0);
  });
}

module.exports = AutonomousMonitor;