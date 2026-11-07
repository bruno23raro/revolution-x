#!/usr/bin/env node
/**
 * Autonomous Error Scanner
 * Scans the codebase for potential errors and auto-fixes them
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Error patterns to detect
const ERROR_PATTERNS = [
  // TypeScript errors
  /Property '(\w+)' does not exist/,
  /Argument of type '(\w+)' is not assignable/,
  /Object is possibly 'undefined'/,
  /Object is possibly 'null'/,

  // Schema mismatches (snake_case vs PascalCase)
  /\.eq\(['"](\w+)['"]\)/,
  /WHERE.*['"](\w+)['"]\s*=/,
  /column.*mismatch/i,

  // Import errors
  /Cannot find module/,
  /Cannot resolve module/,

  // Runtime errors
  /undefined is not a function/,
  /Cannot read property.*of undefined/,
  /null is not an object/
];

// Known fixes
const KNOWN_FIXES = {
  'organizationId': { fix: 'organizationId', check: 'organization_id' },
  'organizationId': { fix: 'organizationId', check: 'organizationID' },
  'lastCheckedAt': { fix: 'lastCheckedAt', check: 'last_checked_at' },
  'lastError': { fix: 'lastError', check: 'last_error' },
  'rejectionReason': { fix: 'rejectionReason', check: 'rejection_reason' },
  'accessTokenEnc': { fix: 'accessTokenEnc', check: 'access_token_enc' },
  'wabaId': { fix: 'wabaId', check: 'waba_id' },
  'organizationAddress': { fix: 'organizationAddress', check: 'organization_address' }
};

class ErrorScanner {
  constructor() {
    this.errors = [];
    this.fixesApplied = [];
  }

  getAllTsFiles(dir) {
    const files = [];
    const excludes = ['node_modules', '.next', 'out', 'dist', 'public'];

    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !excludes.includes(item)) {
          walk(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      });
    };

    try {
      walk(dir);
    } catch (e) {
      // Directory doesn't exist
    }

    return files;
  }

  scanFile(filePath) {
    const errors = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        ERROR_PATTERNS.forEach((pattern, patternType) => {
          if (pattern.test(line)) {
            errors.push({
              file: filePath,
              line: index + 1,
              content: line.trim(),
              pattern: pattern.toString(),
              type: patternType,
              severity: this.getSeverity(line)
            });
          }
        });
      });
    } catch (e) {
      // Skip files that can't be read
    }

    return errors;
  }

  getSeverity(line) {
    if (line.includes('Error') || line.includes('Failed')) return 'critical';
    if (line.includes('Warning') || line.includes('nullable')) return 'high';
    return 'medium';
  }

  fixFile(filePath, fixes) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      fixes.forEach(fix => {
        const regex = new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (regex.test(content)) {
          content = content.replace(regex, fix.to);
          modified = true;
        }
      });

      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Fixed: ${filePath}`);
        return true;
      }

      return false;
    } catch (e) {
      console.error(`  ❌ Error fixing ${filePath}: ${e.message}`);
      return false;
    }
  }

  run() {
    console.log('🔍 Starting Autonomous Error Scan...\n');

    const files = this.getAllTsFiles('.');
    console.log(`📁 Found ${files.length} TypeScript files to scan\n`);

    let allErrors = [];

    files.forEach(file => {
      const errors = this.scanFile(file);
      if (errors.length > 0) {
        allErrors.push(...errors);
      }
    });

    console.log(`🐛 Found ${allErrors.length} potential issues\n`);

    // Group errors by file
    const errorsByFile = {};
    allErrors.forEach(error => {
      if (!errorsByFile[error.file]) {
        errorsByFile[error.file] = [];
      }
      errorsByFile[error.file].push(error);
    });

    // Apply automated fixes
    console.log('🔧 Applying automated fixes...\n');

    Object.entries(errorsByFile).forEach(([file, errors]) => {
      const fixes = [];

      errors.forEach(error => {
        // Check for known schema issues
        Object.entries(KNOWN_FIXES).forEach(([newName, config]) => {
          if (error.content.includes(config.check)) {
            fixes.push({ from: config.check, to: config.fix });
          }
        });
      });

      if (fixes.length > 0) {
        const fixed = this.fixFile(file, fixes);
        if (fixed) {
          this.fixesApplied.push({ file, fixes });
        }
      }
    });

    // Summary
    console.log('\n📊 Scan Complete');
    console.log('=================');
    console.log(`Errors found: ${allErrors.length}`);
    console.log(`Fixes applied: ${this.fixesApplied.length}`);

    if (allErrors.length > 0) {
      console.log('\n⚠️  Remaining issues:');
      allErrors.slice(0, 10).forEach(e => {
        console.log(`  ${e.file}:${e.line} - ${e.severity.toUpperCase()}`);
      });

      process.exit(1);
    } else {
      console.log('\n✅ No errors found!');
      process.exit(0);
    }
  }
}

// Run scanner
const scanner = new ErrorScanner();
scanner.run();