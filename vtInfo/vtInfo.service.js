const db = require('apiDb/db_postgres');
const query = db.query;
const pgUtil = require('apiDb/db_pg_util');
const tblTown =  'vt_town';
const tblCounty = 'vt_county';
var staticColumns = [];

module.exports = {
    getColumns,
    getCounties,
    getCounty,
	getTowns,
	getTown,
    getTable
};

const tables = [
    "vt_town",
    "vt_county",
    "vt_loon_locations",
    "vt_water_body"
];
for (i=0; i<tables.length; i++) {
pgUtil.getColumns(tables[i], staticColumns) //run it once on init: to create the array here. also displays on console.
    .then(res => {return res;})
    .catch(err => {console.log(`vtInfo.service.getColumns | table:${tables[i]} | error: `, err.message);});
}

function getColumns() {
    return new Promise((resolve, reject) => {
    console.log(`vtInfo.service.getColumns | staticColumns:`, staticColumns);
    resolve(staticColumns);
    });
}
  
async function getCounties(reqQry) {
    const where = pgUtil.whereClause(reqQry, staticColumns);
    const order = `ORDER BY "countyName"`;
    const text = `select * from ${tblCounty} ${where.text} ${order};`;
    return await query(text, where.values);
}

async function getCounty(id) {
    const text = `select * from ${tblCounty} where "countyId"=$1;`;
    return await query(text, [id]);
}

async function getTowns(reqQry={}) {
    const where = pgUtil.whereClause(reqQry, staticColumns);
    const order = `ORDER BY "townName"`;
    const text = `select * from ${tblTown} ${where.text} ${order};`;
    return await query(text, where.values);
}

async function getTown(id) {
    const text = `select * from ${tblTown} where "townId"=$1;`;
    return await query(text, [id]);
}

async function getTable(reqQry, table, ordByCol=false, idColumn=false, idValue=false) {
    if (idColumn & idValue) {
        const text = `select * from ${table} where "${idColumn}"=$1;`;
        return await query(text, [idValue]);
    } else {
        const where = pgUtil.whereClause(reqQry, staticColumns);
        const order = ordByCol ? `ORDER BY ${ordByCol}` : '';
        const text = `select * from ${table} ${where.text} ${order}`;
        return await query(text, where.values);
    }
}