﻿const db = require('apiDb/db_postgres');
const query = db.query;
const pgUtil = require('apiDb/db_pg_util');
const common = require('apiDb/db_common');
const shapeFile = require('apiDb/db_shapefile').shapeFile;
const tblName = `loonwatch_ingest`; //put double-quotes around columns for pg if needed
const tblKey = `lwingestlocation`; //put double-quotes around columns for pg if needed
var staticColumns = []; //all tables' columns in a single 1D array
var tableColumns = []; //each table's columns by table name

module.exports = {
    getColumns,
    getCount,
    getSurveyed,
    getOccupied,
    getStats,
    getAll,
    getByLocation,
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
  .then(res => {
    tableColumns[res.tableName] = res.tableColumns;
    return res;
  })
  .catch(err => {console.log(`ingest.service.getColumns | table:${tables[i]} | error: `, err.message);});
}

function getColumns() {
    return new Promise((resolve, reject) => {
      console.log(`ingest.service.getColumns | staticColumns:`, staticColumns);
      resolve(new Promise((resolve, reject) => {
        resolve(staticColumns);
      }));
    });
}

async function getCount(params={}) {
  const where = pgUtil.whereClause(params, staticColumns);
  var whereFilter = '';
  if (where.verbatim) {whereFilter = `, '${where.verbatim}' AS "Filter"`;}
  const text = `SELECT
      DATE_PART('year', lwIngestDate) AS YEAR, 
      COALESCE(SUM(lwIngestAdult), 0) AS "Adults",
      COALESCE(SUM(lwIngestSubAdult), 0) AS "SubAdults",
      COALESCE(SUM(lwIngestChick), 0) AS "Chicks",
      COUNT(lwIngestSurvey) AS "SurveyedBodies",
      SUM(locationArea) AS "AreaSurveyed"
      ${whereFilter}
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

async function getByLocation(id) {
  console.log(`ingest.service::getByLocation(${id})`);
  let param = {}; param[tblKey]=id;
  return getAll(param);
}

async function getAll(params={}) {
  console.log(`ingest.service::getAll(${params})`);
  var orderClause = `order by lwIngestDate`;
  if (params.orderBy) {
      var col = params.orderBy.split("|")[0];
      var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
      orderClause = `order by "${col}" ${dir}`;
  }
  var where = pgUtil.whereClause(params, staticColumns);
  const text = `
  SELECT
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

//Surveyed Lakes by Lake/Town/County/Region with most recent survey year
async function getSurveyed(params={}) {
  var where = pgUtil.whereClause(params, staticColumns);
  var text = `
  SELECT wbRegion, "countyName", "townName", wbTextId, wbFullName, MAX(DATE_PART('YEAR', lwIngestDate)) AS Surveyed
  FROM loonwatch_ingest li
  JOIN vt_loon_locations ll on ll.locationName=li.lwingestlocation
  JOIN vt_water_body wb ON wb.wbTextId=ll.waterBodyId
  JOIN vt_town on ll.locationTownId="townId"
  JOIN vt_county ON "govCountyId"="townCountyId"
  --WHERE wbTextId LIKE 'MILLER%'
  --WHERE "townName"='Derby'
  --WHERE "countyName"='Windsor'
  --WHERE wbRegion LIKE 'Champ%'
  ${where.text}
  GROUP BY wbRegion, "countyName", "townName", wbTextId
  ORDER BY wbRegion, "countyName", "townName", wbTextId`;
  console.log(text, where.values);
  return await query(text, where.values);
}

//Occupied Lakes by Lake/Town/County with most recent occupied year
async function getOccupied(params={}) {
  var where = pgUtil.whereClause(params, staticColumns, 'AND');
  var text = `
  SELECT wbRegion, "countyName", "townName", wbTextId, wbFullName, MAX(DATE_PART('YEAR', lwIngestDate)) AS Occupied
  FROM loonwatch_ingest li
  JOIN vt_loon_locations ll on ll.locationName=li.lwingestlocation
  JOIN vt_water_body wb ON wb.wbTextId=ll.waterBodyId
  JOIN vt_town on ll.locationTownId="townId"
  JOIN vt_county ON "govCountyId"="townCountyId"
  WHERE (COALESCE(lwIngestAdult,0)+COALESCE(lwIngestSubAdult,0)+COALESCE(lwIngestChick,0))>0
  --AND wbTextId LIKE 'MILLER%'
  --AND "townName"='Derby'
  --AND "countyName"='Windsor'
  --AND wbRegion LIKE 'Champ%'
  ${where.text}
  GROUP BY wbRegion, "countyName", "townName", wbTextId
  ORDER BY wbRegion, "countyName", "townName", wbTextId`;
  console.log(text, where.values);
  return await query(text, where.values);
}

async function getStats(params={}) {
  var where = pgUtil.whereClause(params, staticColumns, 'AND');
  var text = `
  SELECT wbRegion AS "regionName", "countyName", "townName", wbTextId, wbOfficialName, locationName as "lakeName", gisacres,
  (SELECT MAX(DATE_PART('YEAR', lwIngestDate)) AS "lastOccupied"
    FROM loonwatch_ingest
    WHERE lwIngestLocation=locationName
    AND (COALESCE(lwIngestAdult,0)+COALESCE(lwIngestSubAdult,0)+COALESCE(lwIngestChick,0))>0
    GROUP BY lwIngestLocation),
  (ARRAY (SELECT DATE_PART('YEAR', lwIngestDate) AS Year
    FROM loonwatch_ingest
    WHERE lwIngestLocation=locationName
    AND (COALESCE(lwIngestAdult,0)+COALESCE(lwIngestSubAdult,0)+COALESCE(lwIngestChick,0))>0
    GROUP BY lwIngestLocation, lwIngestDate)) AS occupied,
  (SELECT MAX(DATE_PART('YEAR', lwIngestDate)) AS "lastSurveyed"
    FROM loonwatch_ingest
    WHERE lwIngestLocation=locationName
    GROUP BY lwIngestLocation),
  (ARRAY (SELECT DATE_PART('YEAR', lwIngestDate) AS Year
    FROM loonwatch_ingest
    WHERE lwIngestLocation=locationName
    GROUP BY lwIngestLocation, lwIngestDate)) AS surveyed
    FROM vt_water_body wb
    FULL JOIN vt_loon_locations ll on ll.waterBodyId=wb.wbTextId
    FULL JOIN loonWatch_ingest li ON ll.locationName=li.lwingestlocation
    FULL JOIN vt_town on wbTownName="townName"
    JOIN vt_water_body_geo wg on wb.wbtextid=wg.lakeid
    JOIN vt_county ON "govCountyId"="townCountyId"
  --WHERE locationName LIKE 'Memphremago%'
  --WHERE "townName" = 'Derby'
  --WHERE "countyName" = 'Orleans'
  --WHERE wbRegion LIKE 'North%'
  ${where.text}
  GROUP BY wbRegion, "countyName", "townName", wbTextId, wbOfficialName, locationName, gisacres
  ORDER BY wbRegion, "countyName", "townName", wbTextId, wbOfficialName, locationName, gisacres`;
  console.log(text, where.values);
  return await query(text, where.values);
}

async function getCsv(params={}) {
    const where = pgUtil.whereClause(params, staticColumns);
    if (params.surveyHasIndividuals) {if (where.text) {where.text += ' AND ';} else {where.text = ' WHERE '} where.text += common.surveyHasIndividuals();}
    const sql = `
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
    console.log('ingest.service | getGeoJson |', params);
    var where = pgUtil.whereClause(params, staticColumns, 'WHERE');
    if (params.surveyHasIndividuals) {if (where.text) {where.text += ' AND ';} else {where.text = ' WHERE '} where.text += common.surveyHasIndividuals();}
    where.pretty = JSON.stringify(params).replace(/\"/g,'');
    const sql = `
    SELECT
        row_to_json(fc) as geojson
    FROM (
        SELECT
    		'FeatureCollection' AS type,
    		'Vermont LoonWatch Surveys' as name,
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
                    SELECT
                    "townId",
                    "townName",
                    "countyName",
                    li.*,
                    ll.*,
                    wb.*
                  ) AS p
              ) AS properties
            FROM ${tblName} li
            JOIN vt_loon_locations ll ON locationName=lwIngestLocation
            JOIN vt_water_body wb ON wbTextId=waterBodyId
            LEFT JOIN vt_town ON locationTownId="townId"
            LEFT JOIN vt_county ON "govCountyId"="townCountyId"
            ${where.text}
        ) AS f
    ) AS fc;`
    console.log('ingest.service | getGeoJson |', where.text, where.values);
    return await query(sql, where.values);
}

async function getShapeFile(params={}, excludeHidden=1) {
  var where = pgUtil.whereClause(params, staticColumns, 'AND');
  where.pretty = JSON.stringify(params).replace(/\"/g,'');
  where.combined = where.text;
  where.values.map((val, idx) => {
    console.log('ingest.service::getShapeFile | WHERE values', val, idx);
    where.combined = where.combined.replace(`$${idx+1}`, `'${val}'`)
  })
  console.log('ingest.service::getShapeFile | WHERE', where);
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
    console.log('ingest.service.create | returning: ', res);
    return res;
}

async function update(id, body) {
    console.log(`ingest.service.update | before pgUtil.parseColumns`, staticColumns);
    var queryColumns = pgUtil.parseColumns(body, 2, [id], staticColumns);
    text = `update ${tblName} set (${queryColumns.named}) = (${queryColumns.numbered}) where ${tblKey}=$1 returning ${tblKey}`;
    console.log(text, queryColumns.values);
    return await query(text, queryColumns.values);
}

async function _delete(id) {
    return await query(`delete from ${tblName} where ${tblKey}=$1;`, [id]);
}
