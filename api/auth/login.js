const path = require('path');
const fs = require('fs');

let serverPath = path.resolve(__dirname, '..', 'backend', 'src', 'server.js');
if (!fs.existsSync(serverPath)) {
  serverPath = path.resolve(__dirname, '..', '..', 'backend', 'src', 'server.js');
}

const app = require(serverPath);

module.exports = app;
