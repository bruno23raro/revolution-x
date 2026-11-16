const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.tmp-part6.json'));
const failed = data.testResults.filter(t => t.status === 'failed');
failed.forEach(t => {
  const first = t.assertionResults.find(a => a.status === 'failed');
  const msg = (first && first.failureMessages && first.failureMessages[0]) || 'sem mensagem';
  const firstLine = msg.split('\n')[0];
  console.log('=== ' + t.name.replace('C:\\Users\\Bruno\\claude\\Revolution\\X\\', '') + ' ===');
  console.log(firstLine);
  console.log('');
});