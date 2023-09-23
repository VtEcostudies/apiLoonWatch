const db = require('apiDb/db_postgres');
const query = db.query;

module.exports = {
    getByBucketName
};

async function getByBucketName(name) {
    const text = `
        SELECT * FROM aws_s3_info
        WHERE "bucketName"=$1;
		`;
    return await query(text, [name])
}