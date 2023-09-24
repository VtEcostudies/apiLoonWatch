const os = require("os");
const process = require('process');
const config = require('../config');
const os_env = os.hostname()==config.server['prod'] ? 'prod' : (os.hostname()==config.server['dev-remote'] ? 'dev-remote' : 'dev-local');
const prc_env = process.env;
const api_env = prc_env.NODE_ENV ? prc_env.NODE_ENV : os_env;
const db_env = config.pg[api_env];

//if no explicit NODE_ENV, interpret the server context from OS hostname and set api environment from that
if (!prc_env.NODE_ENV) {
    console.log('AMBIGUOUS API SERVER CONTEXT... setting api_env = os_env...')
}

const env = {
    os_host: os.hostname(),
    os_env: os_env,
    api_env: api_env,
    db_env: db_env
}

console.log('apiEnv.js | env:', env);

module.exports = {
    env: env
}