const db = require('apiDb/db_postgres');
const query = db.query;
const pgUtil = require('apiDb/db_pg_util');
const common = require('apiDb/db_common');
const shapeFile = require('apiDb/db_shapefile').shapeFile;
const tblName = `loonwatch_ingest`; //put double-quotes around columns for pg if needed
const tblKey = `lwIngestDate`; //put double-quotes around columns for pg if needed
var staticColumns = [];

module.exports = {
    getColumns,
    getCount,
    getAll,
    getById,
    getByPoolId,
    getCsv,
    getGeoJson,
    getShapeFile,
    create,
    update,
    delete: _delete
};

//file scope list of ${tblName} table columns retrieved on app startup (see 'getColumns()' below)
const tables = [
  "loonwatch_ingest",
  "vt_loon_locations",
  "vt_water_body",
  "vt_county",
  "vt_town",
  "user"
];
for (i=0; i<tables.length; i++) {
  pgUtil.getColumns(tables[i], staticColumns) //run it once on init: to create the array here. also diplays on console.
    .then(res => {return res;})
    .catch(err => {console.log(`visit.service.getColumns | table:${tables[i]} | error: `, err.message);});
}

function getColumns() {
    return new Promise((resolve, reject) => {
      console.log(`visit.service.getColumns | staticColumns:`, staticColumns);
      resolve(new Promise((resolve, reject) => {
      resolve(staticColumns);
    }));
    });
}

async function getCount(params={}) {
  const where = pgUtil.whereClause(params, staticColumns);
  var whereColumn = '';
  if (where.text) {whereColumn=`'${where.text}' AS "Filter"`;}
  const text = `SELECT
      DATE_PART('year', lwIngestDate) AS YEAR, 
      COALESCE(SUM(lwIngestAdult), 0) AS "Adults",
      COALESCE(SUM(lwIngestSubAdult), 0) AS "SubAdults",
      COALESCE(SUM(lwIngestChick), 0) AS "Chicks",
      COUNT(lwIngestSurvey) AS "SurveyedBodies",
      SUM(locationArea) AS "AreaSurveyed",
      ${whereColumn}
      FROM loonwatch_ingest
      JOIN vt_loon_locations ll ON locationName=lwIngestLocation
      JOIN vt_water_body wb ON wbTextId=waterBodyId
      LEFT JOIN vt_town ON locationTownId="townId"
      LEFT JOIN vt_county ON "govCountyId"="townCountyId"
      ${where.text}
      GROUP BY DATE_PART('year', lwIngestDate)
      ORDER BY DATE_PART('year', lwIngestDate);`;
  console.log(text, where.values);
  return await query(text, where.values);
}

async function getAll(params={}) {
  var orderClause = `order by lwIngestDate`;
  if (params.orderBy) {
      var col = params.orderBy.split("|")[0];
      var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
      orderClause = `order by "${col}" ${dir}`;
  }
  var where = pgUtil.whereClause(params, staticColumns);
  const text = `
  SELECT
  "townId",
  "townName",
  "countyName",
  li.*,
  ll.*,
    wb.*
  FROM ${tblName} li
  JOIN vt_loon_locations ll ON locationName=lwIngestLocation
  JOIN vt_water_body wb ON wbTextId=waterBodyId
  LEFT JOIN vt_town ON locationTownId="townId"
  LEFT JOIN vt_county ON "govCountyId"="townCountyId"
  ${where.text} ${orderClause};`;
  console.log(text, where.values);
  return await query(text, where.values);
}

/*
  NOW get 2 points for each Visit, and return as a 2-element JSON object:

  {both: {mapped:{}, visit:{}}}
*/
async function getById(id) {
    var text = `
    SELECT
    	json_build_object(
    	'mapped', (SELECT row_to_json(mapped) FROM (
    		SELECT
    		"townId",
    		"townName",
    		"countyName",
    		"mappedPoolId" AS "poolId",
    		"mappedPoolStatus" AS "poolStatus",
    		SPLIT_PART(ST_AsLatLonText("mappedPoolLocation", 'D.DDDDDD'), ' ', 1) AS latitude,
    		SPLIT_PART(ST_AsLatLonText("mappedPoolLocation", 'D.DDDDDD'), ' ', 2) AS longitude,
    		vpmapped.*
    		) mapped),
    	'visit', (SELECT row_to_json(visit) FROM (
    		SELECT
    		"townId",
    		"townName",
    		"countyName",
    		"mappedPoolId" AS "poolId",
    		"mappedPoolStatus" AS "poolStatus",
    		"visitLatitude" AS latitude,
    		"visitLongitude" AS longitude,
    		vpmapped.*,
    		vpmapped."updatedAt" AS "mappedUpdatedAt",
    		vpmapped."createdAt" AS "mappedCreatedAt",
    		${tblName}.*,
    		${tblName}."updatedAt" AS "visitUpdatedAt",
    		${tblName}."createdAt" AS "visitCreatedAt"
    		) visit)
    ) AS both,
    "reviewId"
    FROM vpmapped
    INNER JOIN ${tblName} ON "visitPoolId"="mappedPoolId"
    LEFT JOIN vpreview ON "reviewPoolId"="mappedPoolId"
    LEFT JOIN vt_town ON "mappedTownId"="townId"
    LEFT JOIN vt_county ON "govCountyId"="townCountyId"
    WHERE ${tblKey}=$1;`;

    return await query(text, [id])
}

function getByPoolId(poolId) {
  const text = `
  SELECT
  "townId",
  "townName",
  "countyName",
  visituser.username AS "visitUserName",
  visituser.id AS "visitUserId",
  --visituser.email AS "visitUserEmail",
  visit.*,
  visit."updatedAt" AS "visitUpdatedAt",
  visit."createdAt" AS "visitCreatedAt",
  vpmapped.*,
  vpmapped."updatedAt" AS "mappedUpdatedAt",
  vpmapped."createdAt" AS "mappedCreatedAt"
  FROM ${tblName}
  INNER JOIN vpmapped ON "mappedPoolId"="visitPoolId"
  LEFT JOIN vpuser AS visituser ON "visitUserId"="id"
  LEFT JOIN vt_town ON "mappedTownId"="townId"
  LEFT JOIN vt_county ON "govCountyId"="townCountyId"
  WHERE "visitPoolId"=$1`

  return query(text, [poolId]);
}

async function getCsv(params={}) {
    const where = pgUtil.whereClause(params, staticColumns);
    if (params.visitHasIndicator) {if (where.text) {where.text += ' AND ';} else {where.text = ' WHERE '} where.text += common.visitHasIndicator();}
    const sql = `
    SELECT
    "mappedPoolId" AS "poolId",
    "mappedPoolStatus" AS "poolStatus",
    SPLIT_PART(ST_AsLatLonText("mappedPoolLocation", 'D.DDDDDD'), ' ', 1) AS latitude,
    SPLIT_PART(ST_AsLatLonText("mappedPoolLocation", 'D.DDDDDD'), ' ', 2) AS longitude,
    "townName",
    "countyName",
    ${tblName}.*,
    vpreview.*
    FROM ${tblName}
    INNER JOIN vpmapped on "mappedPoolId"="visitPoolId"
    LEFT JOIN vt_town ON "mappedTownId"="townId"
    LEFT JOIN vt_county ON "govCountyId"="townCountyId"
    --LEFT JOIN vpuser AS mappeduser ON "mappedUserId"=mappeduser.id
    --LEFT JOIN vpuser AS visituser ON "visitUserId"=visituser.id
    LEFT JOIN vpreview ON ${tblKey} = "reviewVisitId"
    ${where.text}`;

    return await query(sql, where.values)
}

/*
  NOTE: WE DO NOT NEED TO USE ST_AsGeoJSON("mappedPoolLocation")::json to convert geometry to geoJSON.

  Simply use eg. this:

  SELECT
    to_json("mappedPoolLocation"), "mappedPoolLocation", "mappedPoolStatus"
  FROM vpmapped
  WHERE "mappedPoolId"='NEW400';

  Input: params are passed as req.query
*/
async function getGeoJson(params={}) {
    console.log('visit.service | getGeoJson |', params);
    var where = pgUtil.whereClause(params, staticColumns, 'WHERE');
    if (params.visitHasIndicator) {if (where.text) {where.text += ' AND ';} else {where.text = ' WHERE '} where.text += common.visitHasIndicator();}
    where.pretty = JSON.stringify(params).replace(/\"/g,'');
    const sql = `
    SELECT
        row_to_json(fc) as geojson
    FROM (
        SELECT
    		'FeatureCollection' AS type,
    		'Vermont Vernal Pool Atlas - Pool Visits' as name,
        'WHERE ${where.pretty}' AS filter,
        --The CRS type below causes importing this dataset into GIS software to fail.
        --The default GeoJSON CRS is WGS84, which is what we have.
    		--'{ "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3857" } }'::json as crs,
        array_to_json(array_agg(f)) AS features
        FROM (
            SELECT
                'Feature' AS type,
                ST_AsGeoJSON("mappedPoolLocation")::json as geometry,
                (SELECT row_to_json(p) FROM
                  (SELECT
                    "mappedPoolId" AS "poolId",
                    "mappedPoolStatus" AS "poolStatus",
                    CONCAT('https://vpatlas.org/pools/list?poolId=',"mappedPoolId",'&zoomFilter=false') AS vpatlas_pool_url,
                    CONCAT('https://vpatlas.org/pools/visit/view/',${tblKey}) AS vpatlas_visit_url,
                    vt_town."townName",
                    vt_county."countyName",
                    vpmapped.*,
                    ${tblName}.*,
                    vpreview.*
                    ) AS p
              ) AS properties
            FROM ${tblName}
            INNER JOIN vpmapped ON "visitPoolId"="mappedPoolId"
            LEFT JOIN vt_town ON "mappedTownId"="townId"
            LEFT JOIN vt_county ON "townCountyId"="govCountyId"
            --LEFT JOIN vpuser AS mappeduser ON "mappedUserId"=mappeduser."id"
            --LEFT JOIN vpuser AS visituser ON "visitUserId"=visituser."id"
            LEFT JOIN vpreview ON ${tblKey} = "reviewVisitId"
            ${where.text}
        ) AS f
    ) AS fc;`
    console.log('visit.service | getGeoJson |', where.text, where.values);
    return await query(sql, where.values);
}

async function getShapeFile(params={}, excludeHidden=1) {
  var where = pgUtil.whereClause(params, staticColumns, 'AND');
  where.pretty = JSON.stringify(params).replace(/\"/g,'');
  where.combined = where.text;
  where.values.map((val, idx) => {
    console.log('visit.service::getShapeFile | WHERE values', val, idx);
    where.combined = where.combined.replace(`$${idx+1}`, `'${val}'`)
  })
  console.log('visit.service::getShapeFile | WHERE', where);
  //Important: notes and comments fields have characters that crash the shapefile dump. It must be handled.
  let qry = `SELECT * 
  FROM visit_shapefile
  WHERE TRUE
  ${where.combined}
  `;
  if (excludeHidden) {qry += `AND "mappedPoolStatus" NOT IN ('Duplicate', 'Eliminated')`}
  return await shapeFile(qry, params.authUser, '${tblName}')
}

async function create(body) {
    var queryColumns = pgUtil.parseColumns(body, 1, [], staticColumns);
    text = `insert into ${tblName} (${queryColumns.named}) values (${queryColumns.numbered}) returning ${tblKey}`;
    console.log(text, queryColumns.values);
    var res = await query(text, queryColumns.values);
    console.log('visit.service.create | returning: ', res);
    return res;
}

async function update(id, body) {
    console.log(`visit.service.update | before pgUtil.parseColumns`, staticColumns);
    var queryColumns = pgUtil.parseColumns(body, 2, [id], staticColumns);
    text = `update ${tblName} set (${queryColumns.named}) = (${queryColumns.numbered}) where ${tblKey}=$1 returning ${tblKey}`;
    console.log(text, queryColumns.values);
    return await query(text, queryColumns.values);
}

async function _delete(id) {
    return await query(`delete from ${tblName} where ${tblKey}=$1;`, [id]);
}
