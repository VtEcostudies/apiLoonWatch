const db = require('apiDb/db_postgres');
const query = db.query;
const pgUtil = require('apiDb/db_pg_util');
var staticColumns = [];

module.exports = {
    testWhereClause
};

const tables = [
  "vt_town",
  "vt_county"
];
for (i=0; i<tables.length; i++) {
  pgUtil.getColumns(tables[i], staticColumns) //run it once on init: to create the array here. also displays on console.
    .then(res => {return res;})
    .catch(err => {console.log(`utils.service.getColumns | table:${tables[i]} | error: `, err.message);});
}

async function testWhereClause(query) {
  const where = pgUtil.whereClause(query, staticColumns);
  return new Promise((resolve, reject) => {
    resolve(where);
  });
}
