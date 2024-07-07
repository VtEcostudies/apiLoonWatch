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
    getTable,
    getBodyLake,
    getBodyLakeGeo
};

const tables = [
    "vt_town",
    "vt_county",
    "vt_loon_locations",
    "vt_water_body",
    "vt_water_body_geo"
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
    //console.log('getTable', table, ordByCol, idColumn, idValue);
    if (idColumn && idValue) {
        const text = `select * from ${table} where "${idColumn}"=$1;`;
        //console.log('getTable', table, text);
        return await query(text, [idValue]);
    } else {
        if (reqQry.orderBy) {ordByCol = reqQry.orderBy;}//To-do: check that orderBy is valid for table
        const where = pgUtil.whereClause(reqQry, staticColumns);
        const order = ordByCol ? `ORDER BY ${ordByCol}` : '';
        const text = `select * from ${table} ${where.text} ${order}`;
        return await query(text, where.values);
    }
}

async function getBodyLake(reqQry) {
    const where = pgUtil.whereClause(reqQry, staticColumns);
    const order = reqQry.orderBy ? `ORDER BY ${reqQry.ordBy}` : '';
    const text = `
select
locationname,
locationtown,
locationregion,
exportname,
wbtextid,
wbofficialname,
wbregion,
wbarea,
wbfullname,
wbtype,
wbcenterlatitude,
wbcenterlongitude
from vt_loon_locations ll
full outer join vt_water_body wb on wbtextid=waterbodyid
${where.text} ${order}`;
    return await query(text, where.values);
}

//ST_AsGeoJSON(lg.geom)::json As geometry

async function getBodyLakeGeo(reqQry) {
    const where = pgUtil.whereClause(reqQry, staticColumns);
    const order = reqQry.orderBy ? `ORDER BY ${reqQry.ordBy}` : '';
    const text = `
select
locationname,
locationtown,
locationregion,
exportname,
wbtextid,
wbofficialname,
wbregion,
wbarea,
wbfullname,
wbtype,
gisacres,
ST_AsGeoJSON(ST_Centroid(wkb_geometry))::json AS wbcentroid,
ST_AsGeoJSON(wkb_geometry)::json AS wbpolygon
from vt_loon_locations ll
full outer join vt_water_body wb on wb.wbtextid=waterbodyid
join vt_water_body_geo wg on wb.wbtextid=wg.lakeid
${where.text} ${order}`;
    return await query(text, where.values);
}
