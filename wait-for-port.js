const net = require('net');

const port = parseInt(process.argv[2]) || 3010;
const timeout = parseInt(process.argv[3]) || 30000;
const interval = 500;
let attempts = 0;
const maxAttempts = Math.ceil(timeout / interval);

function check() {
  const client = new net.Socket();
  client.setTimeout(2000);
  client.connect(port, '127.0.0.1', () => {
    client.destroy();
    process.exit(0);
  });
  client.on('error', () => {
    client.destroy();
    attempts++;
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-port] Timeout: port ${port} not ready after ${timeout}ms`);
      process.exit(1);
    }
    setTimeout(check, interval);
  });
  client.on('timeout', () => {
    client.destroy();
    attempts++;
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-port] Timeout: port ${port} not ready after ${timeout}ms`);
      process.exit(1);
    }
    setTimeout(check, interval);
  });
}

console.log(`[wait-for-port] Waiting for port ${port}...`);
check();
