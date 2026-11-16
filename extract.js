const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.tmp-part6.json'));
const failed = data.testResults.filter(t => t.status === 'failed');
const names = failed.map(t => t.name.replace('C:\\Users\\Bruno\\claude\\Revolution\\X\\', ''));
names.forEach(n => console.log(n));