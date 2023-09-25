const router = require('express').Router();
const routes = require('apiUtility/routes');
const cfg = require('config.js');
const env = require('apiUtility/apiEnv').env;

router.get('/', defRes);

module.exports = router;

function defRes(req, res, next) {
    res.send(`
    <p><a href="http://${cfg.api[env.api_env].host}:${cfg.api[env.api_env].port}/loonwatch">LoonWatch Data</a></p>
    <p><a href="http://${cfg.api[env.api_env].host}:${cfg.api[env.api_env].port}/loonwatch/count">LoonWatch Summary</a></p>
    `);
}

