const dgram = require('dgram');
const ipRegex = require('ip-port-regex');
const config = require('./config');
const funcs = require('./functions');

const logger = require('./logger');

const server = dgram.createSocket('udp4');

const pStart = '\xFF\xFF\xFF\xFF\x66\x0A';
const pEnd = '\x00\x00\x00\x00\x00\x00';
const servers = [];

setInterval(funcs.an(() => {
  funcs.get_servers('all', (err, content) => {
    if (err) throw err;
    servers[0] = content;
  });
})(), config.ms.delay_default_servers_refresh * 1000);

if (config.ms.boost_servers_enabled) {
  setInterval(funcs.an(() => {
    funcs.get_servers('boost', (err, content) => {
      if (err) throw err;
      servers[1] = content;
    });
  })(), config.ms.delay_boost_servers_refresh * 1000);
}

server.on('listening', () => {
  const address = server.address();
  // console.log(`MS listening on ${address.address}:${address.port}`);
  logger.info(`MS listening on ${address.address}:${address.port}`);
});

server.on('message', (message, remote) => {
  const reqAddr = message.toString('ascii').match(ipRegex());
  if (!reqAddr) return;
  if (ipRegex().test(reqAddr[0]) === false) return;
  const allServers = servers[1].concat(servers[0]);
  let index = 0;
  if (reqAddr[0] === '0.0.0.0:0') {
    index = 0;
  } else {
    index = allServers.indexOf(reqAddr[0]) + 1;
  }
  if (allServers[index]) {
    funcs.send_reply([pStart, allServers[index]], remote, server);
  } else {
    setTimeout(() => {
      funcs.send_reply(pStart + pEnd, remote, server);
    }, config.ms.delay_end_server_list * 1000);
  }
});

server.bind(config.server.port, config.server.host);
