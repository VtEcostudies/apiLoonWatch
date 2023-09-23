const express = require('express');
const router = express.Router();
const routes = require('apiUtility/routes');
const vtInfoService = require('./vtInfo.service');

// routes
router.get('/routes', getRoutes);
router.get('/counties', getCounties);
router.get('/county/:id', getCounty);
router.get('/towns', getTowns);
router.get('/town/:id', getTown);
router.get('/lake', getLake);
router.get('/waterBody', getBody);

module.exports = router;

function getRoutes(req, res, next) {
    res.json(routes(router));
}

function getCounties(req, res, next) {
	console.log('getCounties', req.query);
    vtInfoService.getCounties(req.query)
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}

function getCounty(req, res, next) {
    vtInfoService.getCounty(req.params.id)
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}

function getTowns(req, res, next) {
	console.log('getTowns', req.query);
    vtInfoService.getTowns(req.query)
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}

function getTown(req, res, next) {
    vtInfoService.getTown(req.params.id)
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}

function getLake(req, res, next) {
	console.log('getLake', req.query);
    vtInfoService.getTable(req.query, 'vt_loon_locations')
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}

function getBody(req, res, next) {
	console.log('getWaterBody', req.query);
    vtInfoService.getTable(req.query, 'vt_water_body')
        .then(data => {
            data ? res.json({'rowCount': data.rows.length, 'rows': data.rows}) : res.sendStatus(404);
        })
        .catch(err => next(err));
}
