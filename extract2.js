const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.tmp-part6.json'));
const failed = data.testResults.filter(t => t.status === 'failed');
failed.forEach(t => {
  const first = t.assertionResults.find(a => a.status === 'failed');
  if (first && first.error && first.error.message) {
    const firstLine = first.error.message.split('\n')[0];
    console.log('FILE: ' + t.name.replace('C:\\Users\\Bruno\\claude\\Revolution\\X\\', ''));
    console.log('ERROR: ' + firstLine);
    console.log('---');
  }
});