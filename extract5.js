const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.tmp-part6.json'));
['demo-mode.test.ts', 'jwt-forgery.test.ts', 'rls.test.ts'].forEach(name => {
  const t = data.testResults.find(x => x.name.includes(name));
  if (t) {
    console.log('=== ' + name + ' ===');
    console.log('Status: ' + t.status);
    console.log('Message: ' + (t.message || 'sem mensagem'));
    console.log('Assertions: ' + t.assertionResults.length);
    console.log('');
  }
});