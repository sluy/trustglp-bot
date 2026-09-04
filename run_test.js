const fs = require('fs');
let code = fs.readFileSync('test_route.js', 'utf-8');
code = code.replace('return (data.code === "000000" && data.data) ? data.data : [];', 'console.log("API Response:", JSON.stringify(data).substring(0,200)); return (data.code === "000000" && data.data) ? data.data : [];');
fs.writeFileSync('test_route3.js', code);
require('./test_route3.js');
