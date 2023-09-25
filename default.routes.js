const router = require('express').Router();
const routes = require('apiUtility/routes');
const cfg = require('config.js');
const env = require('apiUtility/apiEnv').env;

router.get('/', defRes);

module.exports = router;

function defRes(req, res, next) {
    console.log('hdr.host:', req.headers.host);
    console.log('protocol:', req.protocol);
    console.log('hostname:', req.hostname);
    let html = `
    <p><a href="${req.protocol}://${req.headers.host}/loonwatch">LoonWatch Data</a></p>
    <p><a href="${req.protocol}://${req.headers.host}/loonwatch/count">LoonWatch Summary</a></p>
    <p><a href="${req.protocol}://${req.headers.host}/info/lake">LoonWatch Survey Locations</a></p>
    <p><a href="${req.protocol}://${req.headers.host}/info/waterBody">Vermont Water Bodies</a></p>
    `;
    res.send(html);
}

