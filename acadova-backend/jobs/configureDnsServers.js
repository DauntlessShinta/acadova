const dns = require('node:dns');

function configureDnsServers(value) {
  const servers = typeof value === 'string' ? value.split(',').map((server) => server.trim()).filter(Boolean) : [];
  if (servers.length) dns.setServers(servers);
}

module.exports = { configureDnsServers };
