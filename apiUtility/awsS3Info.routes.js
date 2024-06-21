const express = require('express');
const router = express.Router();
const service = require('./awsS3Info.service');

// routes
router.get('/bucket/:bucketName', getByBucketName);

module.exports = router;

function getByBucketName(req, res, next) {
    console.log('aws_s3_info.routes.getByBucketName req.params', req.params);
    service.getByBucketName(req.params.bucketName)
        .then(items => res.json({rows: items.rows}))
        .catch(err => next(err));
}
