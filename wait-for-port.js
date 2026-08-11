const net = require('net');

const ports = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const timeout = 60000;
const interval = 500;
const targetPorts = ports.map(Number).filter(Boolean);

if (targetPorts.length === 0) {
  console.error('[wait-for-port] Usage: node wait-for-port.js <port1> [port2] ...');
  process.exit(1);
}

const results = {};
let pending = targetPorts.length;

function checkPort(port) {
  let attempts = 0;
  const maxAttempts = Math.ceil(timeout / interval);

  function tryConnect() {
    const client = new net.Socket();
    client.setTimeout(2000);
    client.connect(port, '127.0.0.1', () => {
      client.destroy();
      results[port] = true;
      pending--;
      if (pending === 0) process.exit(0);
    });
    client.on('error', () => {
      client.destroy();
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(`[wait-for-port] Timeout: port ${port} not ready after ${timeout}ms`);
        results[port] = false;
        pending--;
        if (pending === 0) process.exit(1);
        return;
      }
      setTimeout(tryConnect, interval);
    });
    client.on('timeout', () => {
      client.destroy();
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(`[wait-for-port] Timeout: port ${port} not ready after ${timeout}ms`);
        results[port] = false;
        pending--;
        if (pending === 0) process.exit(1);
        return;
      }
      setTimeout(tryConnect, interval);
    });
  }

  console.log(`[wait-for-port] Waiting for port ${port}...`);
  tryConnect();
}

targetPorts.forEach(checkPort);
