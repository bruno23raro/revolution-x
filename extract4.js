const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.tmp-part6.json'));
const failed = data.testResults.filter(t => t.status === 'failed');
['demo-mode.test.ts', 'jwt-forgery.test.ts'].forEach(name => {
  const t = failed.find(x => x.name.includes(name));
  if (t) {
    console.log('=== ' + name + ' ===');
    console.log('Status: ' + t.status);
    const failedTests = t.assertionResults.filter(a => a.status === 'failed');
    failedTests.forEach(a => {
      console.log('TEST: ' + a.title);
      console.log('MSG: ' + ((a.failureMessages && a.failureMessages[0]) || 'sem mensagem').split('\n')[0]);
    });
    console.log('');
  }
});