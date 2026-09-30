const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');
const { configureDnsServers } = require('../jobs/configureDnsServers');

test('notification worker leaves normal DNS unchanged when override is missing or blank', () => {
  const original = dns.setServers;
  const calls = [];
  dns.setServers = (servers) => calls.push(servers);
  try {
    configureDnsServers(undefined);
    configureDnsServers('');
    configureDnsServers('  ');
    configureDnsServers(' , , ');
    assert.deepEqual(calls, []);
  } finally { dns.setServers = original; }
});

test('notification worker trims comma-separated DNS servers and removes blank entries', () => {
  const original = dns.setServers;
  const calls = [];
  dns.setServers = (servers) => calls.push(servers);
  try {
    configureDnsServers(' 8.8.8.8, ,1.1.1.1,  ');
    assert.deepEqual(calls, [['8.8.8.8', '1.1.1.1']]);
  } finally { dns.setServers = original; }
});
