const fs = require('fs');
const fastCsv = require('fast-csv');

const db = require('apiDb/db_postgres');
const query = db.query;
const pgUtil = require('apiDb/db_pg_util');
const common = require('apiDb/db_common');
var staticColumns = []; //all tables' columns in a single 1D array
var tableColumns = {}; //each table's columns by table name
const shapeFile = require('apiDb/db_shapefile').shapeFile;

module.exports = {
    getColumns,
    getCount,
    getWaterBodies,
    getObservers,
    getYears,
    getAll,
    getById,
    getByWaterBody,
    getGeoJson,
    getShapeFile,
    upload,
    create,
    update,
    delete: _delete
};

//file scope list of survey tables' columns retrieved at app startup (see 'getColumns()' below)
const tables = [
  "loonwatch_event",
  "loonwatch_observation",
  "vt_loon_locations",
  "vt_water_body",
  "vt_county",
  "vt_town",
  "user"
];
for (i=0; i<tables.length; i++) {
  pgUtil.getColumns(tables[i], staticColumns) //run it once on init: to create the array here. also displays on console.
    .then(res => {
      tableColumns[res.tableName] = res.tableColumns;
      //console.log('survey.service=>getColumns=>tableColumns', tableColumns);
      return res;
    })
    .catch(err => {console.log(`survey.service.getColumns | table:${tables[i]} | error: `, err.message);});
}

function getColumns() {
    return new Promise((resolve, reject) => {
      console.log(`survey.service.getColumns | staticColumns:`, staticColumns);
      resolve(staticColumns);
    });
}

async function getCount(query={}) {
    const where = pgUtil.whereClause(query, staticColumns);
    const text = `select count(*) from survey ${where.text};`;
    console.log(text, where.values);
    return await query(text, where.values);
}

function getWaterBodies(params={}) {
  var order = ' ORDER BY wbtextid';
  if (params.orderBy) {
      var col = params.orderBy.split("|")[0];
      var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
      order = ` ORDER BY "${col}" ${dir}`;
  }
  const where = pgUtil.whereClause(params, staticColumns);
  const text = `
  SELECT DISTINCT(lweventwaterbodyid)
  FROM loonwatch_event
  ${where.text}
  ${order}
  `;
  console.log(text, where.values);
  return query(text, where.values);
}

function getYears(params={}) {
  const where = pgUtil.whereClause(params, staticColumns);
  const text = `
  SELECT DISTINCT("surveyYear")
  FROM vpsurvey_year
  INNER JOIN ${tblName} ON "surveyId"="surveyYearSurveyId"
  ${where.text}
  ORDER BY "surveyYear" DESC
  `;
  console.log(text, where.values);
  return query(text, where.values);
}

async function getObservers(params={}) {
  const where = pgUtil.whereClause(params, staticColumns);
  const text = `
  SELECT DISTINCT("surveyUser"), "surveyUserEmail", "surveyUserId"  FROM (
    SELECT DISTINCT("username") AS "surveyUser", email AS "surveyUserEmail", "id" AS "surveyUserId"
    FROM vpuser
    INNER JOIN ${tblName} ON id="surveyUserId"
    UNION
    SELECT DISTINCT("username") AS "surveyUser", email AS "surveyUserEmail", "id" AS "surveyUserId"
    FROM vpuser
    INNER JOIN vpsurvey_amphib ON id="surveyAmphibObsId"
  ) AS u
  ${where.text}
  ORDER BY "surveyUser"
  `;
  console.log(text, where.values);
  return await query(text, where.values);
}

async function getAll(params={}) {
    var orderClause = 'ORDER BY lweventdate DESC, lweventstart DESC';
    if (params.orderBy) {
        var col = params.orderBy.split("|")[0];
        var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
        orderClause = `order by "${col}" ${dir}`;
    }
    //custom handling of date-range fields, for now, because 'whereClause' can't handle it
    var range = '';
    if (params.surveyDateBeg && params.surveyDateEnd) {
      range = `WHERE lweventdate BETWEEN '${params.surveyDateBeg}' AND '${params.surveyDateEnd}' `;
      delete params.surveyDateBeg; delete params.surveyDateEnd;
    }
    where = pgUtil.whereClause(params, staticColumns, range!=''?'AND':'WHERE');
    const text = `
    SELECT
    *
    FROM loonwatch_event
    INNER JOIN vt_water_body ON lwEventWaterBodyId=wbtextid
    INNER JOIN loonwatch_observation ON lwobseventid=lweventid
    LEFT JOIN vt_town ON lwEventTownId="townId"
    LEFT JOIN vt_county ON "govCountyId"="townCountyId"
    ${range + where.text} ${orderClause};`;
    console.log(text, where.values);
    return await query(text, where.values);
}

function getById(eventId) {
  return getAll({"lweventid":eventId})
}

function getByWaterBody(wbTextId) {
  return getAll({"wbtextid":wbTextId})
}

async function getGeoJson(params={}) {
    console.log('survey.service | getGeoJson |', params);
    var where = pgUtil.whereClause(params, staticColumns);
    where.pretty = JSON.stringify(params).replace(/\"/g,'');
    const sql = `
      SELECT
          row_to_json(fc) AS geojson
      FROM (
          SELECT
      		'FeatureCollection' AS type,
      		'Vermont Vernal Pool Atlas - Pool Surveys' AS name,
          'WHERE ${where.pretty}' AS filter,
          --The CRS type below causes importing this dataset into GIS software to fail.
          --The default GeoJSON CRS is WGS84, which is what we have.
          --'{ "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3857" } }'::json as crs,
          array_to_json(array_agg(f)) AS features
          FROM (
              SELECT
                  'Feature' AS type,
                   ST_AsGeoJSON("mappedPoolLocation")::json as geometry,
                   (SELECT
                     row_to_json(p) FROM (SELECT
                       "mappedPoolId" AS "poolId",
                       "mappedPoolStatus" AS "poolStatus",
                       CONCAT('https://vpatlas.org/pools/list?poolId=',"mappedPoolId",'&zoomFilter=false') AS vpatlas_pool_url,
                       CONCAT('https://vpatlas.org/survey/pool/',"mappedPoolId") AS vpatlas_survey_pool_url,
                       CONCAT('https://vpatlas.org/survey/view/',"surveyId") AS vpatlas_survey_url,
                        vpmapped.*,
                        ${tblName}.*,
                        --vpsurvey_amphib.*,
                        --vpsurvey_macro.*,
                        (SELECT "surveyTypeName" FROM def_survey_type
                          WHERE def_survey_type."surveyTypeId"=${tblName}."surveyTypeId"),
                        (SELECT array_agg(q) AS "surveyPhotos" FROM (
         							      SELECT "surveyPhotoUrl","surveyPhotoSpecies","surveyPhotoName"
       							        FROM vpsurvey_photos
             						  	WHERE ${tblName}."surveyId"=vpsurvey_photos."surveyPhotoSurveyId"
                            ) AS q
             							),
                        vptown."townName",
                        vpcounty."countyName"
                     ) AS p
      			) AS properties
              FROM survey
          		INNER JOIN vpmapped ON "mappedPoolId"="surveyPoolId"
              INNER JOIN vptown ON "mappedTownId"="townId"
              INNER JOIN vpcounty ON "townCountyId"="govCountyId"
              --INNER JOIN vpsurvey_amphib ON "surveyId"="surveyAmphibSurveyId"
              --INNER JOIN vpsurvey_macro ON "surveyId"="surveyMacroSurveyId"
              --LEFT JOIN vpsurvey_year ON "surveyId"="surveyYearSurveyId"
              --LEFT JOIN vpsurvey_photos ON "surveyId"="surveyPhotoSurveyId"
              ${where.text}
          ) AS f
      ) AS fc; `;
    console.log('survey.service | getGeoJson |', where.text, where.values);
    return await query(sql, where.values);
}

/*
NOTE: 
  
  pgsql2shp *can* use a VIEW directly, like:

    pgsql2shp -f shapefile/${tblName} -h localhost -u vpatlas -P EatArugula vpatlas survey_amphib_safe

  pgsql2shp *can* also use a VIEW withing a SELECT, like eg.:

    pgsql2shp -f shapefile/${tblName} -h localhost -u vpatlas -P EatArugula vpatlas "SELECT * FROM survey_shapefil"

    HOWEVER: pgsql2shp will crash without notice due to bad characters in text fields

  ALSO NOTE:

    pgsql2shp appears to be unable to call a query or a VIEW having functions like json_agg and array_agg.
*/
async function getShapeFile(params={}, excludeHidden=1) {
  var where = pgUtil.whereClause(params, staticColumns, 'AND');
  //if (params.surveyHasIndicator) {if (where.text) {where.text += ' AND ';} else {where.text = ' WHERE '} where.text += common.surveyHasIndicator();}
  where.pretty = JSON.stringify(params).replace(/\"/g,'');
  where.combined = where.text;
  where.values.map((val, idx) => {
    console.log('survey.service::getShapeFile | WHERE values', val, idx);
    where.combined = where.combined.replace(`$${idx+1}`, `'${val}'`)
  })
  console.log('survey.service::getShapeFile | WHERE', where);
  let qry = `SELECT * 
  FROM survey_shapefile
  WHERE TRUE
  ${where.combined}
  `;
  return await shapeFile(qry, params.authUser, '${tblName}')
}

/*
  Upload a single csv file having one to many rows and insert/update these tables:

    - survey
    - vpsurvey_amphib
    - vpsurvey_macro
    - vpsurvey_year
    - vpsurvey_photos

  Column Names in CSV file MUST conform to specific conventions. See sample spreadsheet for details.

  Here's how it works under the hood:

  - leave survey columns at top-level object
  - store sub-tables as json objects by table name, to be inserted into jsonb columns in survey
  - DB trigger uses jsonb column sub-objects to populate join tables by surveyId AFTER INSERT
*/
function upload(req) {
  const fileRows = [];
  var logId = 0;
  var update = 0;

  return new Promise((resolve, reject) => {

    if (!req.file) {
      reject({message:`Upload file missing.`, error:true});
    }

    if (req.query) {update = 'true' == req.query.update;}

    console.log('upload | update:', update);

    insert_log_upload_attempt(req.file, update)
      .then(res => {console.log('insert_log_upload_attempt | Success |', res.rows[0]); logId=res.rows[0].surveyUploadId;})
      .catch(err => {console.log('insert_log_upload_attempt | Error |', err.message);});

      fastCsv.parseFile(req.file.path)
        .on("error", (err) => {
            console.log('survey.upload | fastCsv.parsefile ERROR', err.message);
            err.where = 'fast-csv.parseFile'; err.hint = 'File must be survey CSV format with header columns.';
            reject(err);
        })
        .on("data", (data) => {
          fileRows.push(data); // push each row
        })
        .on("end", () => {
try { //try-catch with promise doesn't work wrapped around fastCsv call. Put inside .on("end")
          fs.unlinkSync(req.file.path); //this does nothing
          const obsDelim = '_'; //delimiter for observer field prefix
          var colum = null; var split = []; var obsId = 0;
          var surveyColumns = [];
          for (i=0;i<fileRows[0].length;i++) {
            colum = fileRows[0][i];
            split = colum.split(obsDelim); colum = split[split.length-1]; obsId=(2==split.length?split[0]:0);
            if (tableColumns[tblName].includes(colum)) surveyColumns.push(colum);
          }
          surveyColumns.push('surveyAmphibJson');
          surveyColumns.push('surveyMacroJson');
          surveyColumns.push('surveyYearJson');
          surveyColumns.push('surveyPhotoJson');
          console.log('survey.upload | header', surveyColumns);
          var valArr = [];
          for (i=1; i<fileRows.length; i++) {
            var surveyRow = {}; //single object of colum:value pairs for one insert row into survey
            var amphibRow = {}; //array of objects of colum:value pairs to insert in jsonb column of vpsurvey_amphib
            var macroRow = {}; //array of objects of colum:value pairs to insert in jsonb column of vpsurvey_macro
            var yearRow = {}; //single object of colum:value pairs to insert in jsonb column of vpsurvey_year
            var obsRow = {}; //single object of colum:value pairs to insert in jsonb column of vpsurvey_photos
            var colum = null;
            var split = [];
            var obsId = 1; //obsId is 1-based for actual observers
            var value = null; //temporary local var to hold values for scrubbing
            for (j=0;j<fileRows[0].length;j++) { //iterate over keys in first row (column names)
              colum = fileRows[0][j];
              split = colum.split(obsDelim); colum = split[split.length-1]; //observer column_name is the last piece
              obsId = (2==split.length?split[0]:0); //did we get two array-elements split by '_'? If yes, flag it.
              obsId = (obsId?obsId.slice(-1):0); //if flagged above, obsId is the trailing number of 'obs2...'
              if (obsId && !amphibRow[obsId]) {amphibRow[obsId] = {};} //initialize valid amphibRow array element
              value = fileRows[i][j];
              if ('' === value) {value = null;} //convert empty strings to null
              if (`${Number(value)}` === value) {value = Number(value);} //convert string number to numbers (MUST USE '===' or it converts bool to int!!!)
              if (tableColumns[tblName].includes(colum)) {surveyRow[colum]=value;}
              if (tableColumns['vpsurvey_photos'].includes(colum)) {obsRow[colum]=value;}
              if (tableColumns['vpsurvey_year'].includes(colum)) {yearRow[colum]=value;}
              if (tableColumns['vpsurvey_macro'].includes(colum)) {macroRow[colum]=value;}
              if (tableColumns['vpsurvey_amphib'].includes(colum)) {amphibRow[obsId][colum]=value;}
              if ('surveyUserEmail'==colum && value===null) surveyRow[colum]=req.query.surveyUserEmail;
            }
            surveyRow['surveyAmphibJson'] = amphibRow; //set the survey jsonb column value for survey_amphib table
            surveyRow['surveyMacroJson'] = macroRow; //set the survey jsonb column value for survey_macro table
            surveyRow['surveyYearJson'] = yearRow; //set the survey jsonb column value for survey_year table
            surveyRow['surveyPhotoJson'] = obsRow; //set the survey jsonb column value for survey_photos table
            valArr.push(surveyRow);
          }
          var columns = [];
          var query = null;
          //https://stackoverflow.com/questions/37300997/multi-row-insert-with-pg-promise
          columns = new db.pgp.helpers.ColumnSet(surveyColumns, {table: tblName});
          query = db.pgp.helpers.insert(valArr, columns);
          if (update) {
            query += `
            ON CONFLICT ON CONSTRAINT "vpsurvey_unique_survey_PoolId_TypeId_Date_GlobalId"
            DO UPDATE SET ("${surveyColumns.join('","')}")=(EXCLUDED."${surveyColumns.join('",EXCLUDED."')}")`;
          }
          query += ' RETURNING "surveyId", "surveyPoolId", "createdAt"!="updatedAt" AS updated ';
          console.log('survey.upload | query', query); //verbatim query with values for testing
          //console.log('survey.upload | columns', columns);
          //console.log('survey.upload | values', valArr);

} catch (err) {
  console.log('survey.upload | try-catch ERROR', err.message);
  reject(err);
}

          db.pgpDb.many(query) //'many' for expected return values
            .then(res => {
              console.log(res);
              update_log_upload_attempt(logId, {
                surveyUploadSuccess:true,
                surveyUploadRowCount:res.length,
                surveyUploadSurveyId:res
                });
              resolve(res);
            })
            .catch(err => {
              console.log(err.message);
              update_log_upload_attempt(logId, {
                surveyUploadSuccess:false,
                surveyUploadError:err.message,
                surveyUploadDetail:err.detail
                });
              reject(err);
            }); //end pgpDb
        }); //end fastCSV.parsefile
    }); //end Promise
}

/*
upload req.file:
{
  fieldname: 'survey.csv',
  originalname: 'survey.csv',
  encoding: '7bit',
  mimetype: 'text/csv',
  destination: 'survey/uploads/',
  filename: '532fa603b058c6c6c9672bdf1ea50e8f',
  path: 'survey\\uploads\\532fa603b058c6c6c9672bdf1ea50e8f',
  size: 1971
}
*/
async function insert_log_upload_attempt(params={}, update=false) {
  var columns = {};
  columns.named = [`"surveyUpload_fieldname"`,`"surveyUpload_mimetype"`,`"surveyUpload_path"`,`"surveyUpload_size"`,`"surveyUploadType"`];
  columns.numbered = ['$1','$2','$3','$4','$5'];
  columns.values = [params.fieldname,params.mimetype,params.path,params.size,update?'update':'insert'];
  text = `insert into vpsurvey_uploads (${columns.named}) values (${columns.numbered}) returning "surveyUploadId"`;
  console.log('survey.service::log_upload_attempt', text, columns.values);
  return await query(text, columns.values);
}

async function update_log_upload_attempt(surveyUploadId=0, params={}) {
  var columns = pgUtil.parseColumns(params, 2, [surveyUploadId], staticColumns);
  text = `update vpsurvey_uploads set (${columns.named}) = (${columns.numbered}) where "surveyUploadId"=$1`;
  console.log('survey.service::log_upload_attempt', text, columns.values);
  return await query(text, columns.values);
}

/*
  INSERT a new loonwatch_event
*/
function create(body) {
  return new Promise((resolve, reject) => {
    console.log('survey.service=>create', body);
    let queryColumns = pgUtil.parseColumns(body, 1, [], tableColumns['loonwatch_event']);
    text = `insert into loonwatch_event (${queryColumns.named}) values (${queryColumns.numbered}) returning lweventid`;
    console.log(text, queryColumns.values);
    query(text, queryColumns.values)
      .then(res => {
        console.log('survey.service=>create RESULT rows:', res.rows);
        let eventRes = res; //save to append to observations result
        upsertObservations(res.rows[0].lweventid, body.observations, 0)
        .then(res => {
          res = Object.assign(res, eventRes);
          resolve(res);
        })
        .catch(err => {reject(err)})
      })
      .catch(err => {reject(err)});
    })
}

/*
  UPDATE an existing loonwatch_event
*/
function update(id, body) {
  var queryColumns = pgUtil.parseColumns(body, 2, [id], tableColumns['loonwatch_event']);
  text = `update loonwatch_event set (${queryColumns.named}) = (${queryColumns.numbered}) where lweventid=$1 returning lweventid`;
  console.log(text, queryColumns.values);
  return new Promise((resolve, reject) => {
    query(text, queryColumns.values)
      .then(res => {
        console.log('survey.service=>update RESULT rows:', res.rows);
        let eventRes = res; //save to append to observations result
        upsertObservations(res.rows[0].lweventid, body.observations, 1)
          .then(res => {
            res = Object.assign(res, eventRes);
            resolve(res);
          })
          .catch(err => {reject(err)})
      })
      .catch(err => {reject(err);});
    })
}

/*
  INSERT or UPDATE an array of observations for a single lwEventId into loonwatch_observation
*/
function upsertObservations(lweventid=0, jsonArr=[], update=0) {
  return new Promise((resolve, reject) => {
    if (!lweventid) {reject({message:'lwEventId required to Upsert observations.'})}
    if (!jsonArr.length) {return resolve({message:'Observation Array empty. No Upsert.'})}
    try {
      var valArr = [];
      console.log('upsertObservations | jsonArr', jsonArr);
      for (i=0; i<jsonArr.length; i++) { //iterate over jsonData objects in jsonArray
        var obsRow = jsonArr[i]; //single object of colum:value pairs for one insert row into loonwatch_observation
        obsRow['lwobseventid']=lweventid;
        obsRow.lwobsgeolocation = null;
        valArr.push(obsRow);
      } //end for loop
      var columns = [];
      var query = null;
      var obsColumns = tableColumns['loonwatch_observation']; //make a copy so it can be altered in case of UPDATE, below.
      //delete obsColumns.lwobsgeolocation; //don't ship this field - it's calculated by db trigger from lat/lon
      //console.log('survey.service=>create columns', obsColumns);
      //https://stackoverflow.com/questions/37300997/multi-row-insert-with-pg-promise
      columns = new db.pgp.helpers.ColumnSet(obsColumns, {table: 'loonwatch_observation'});
      //console.log('survey.service=>create columns', columns);
      query = db.pgp.helpers.insert(valArr, columns);
      if (update) {
        query += `
        ON CONFLICT ON CONSTRAINT ""
        DO UPDATE SET ("${obsColumns.join('","')}")=(EXCLUDED."${obsColumns.join('",EXCLUDED."')}")`;
      }
      query += ' RETURNING *';
      console.log('survey.service::upsertObservations | query', query); //verbatim query with values for testing
      //console.log('survey.service.service::upsertObservations | columns', columns);
      //console.log('survey.service.service::upsertObservations | values', valArr);
      db.pgpDb.many(query) //'many' for expected return values
        .then(res => {
          console.log('survey.service=>upsertObservations | pgpDb SUCCESS', res);
          resolve(res);
        })
        .catch(err => {
          console.log('survey.service=>upsertObservations| pgpDb ERROR', err.message);
          reject(err);
        }); //end pgpDb
    } catch (err) {
      console.log('survey.service=>upsertObservations | try-catch ERROR', err.message);
      reject(err);
    }
  }); //end Promise
}

async function _delete(id) {
    return await query(`DELETE FROM loonwatch_event CASCADE WHERE lweventid=$1;`, [id]);
}
