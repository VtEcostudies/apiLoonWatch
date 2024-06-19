require('rootpath')();
const fs = require('fs');
const https = require('https');
const compression = require('compression');
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('apiUtility/jwt');
const errorHandler = require('apiUtility/errorHandler');
const cfg = require('config.js');
const env = require('apiUtility/apiEnv').env;
const process = require('process');
var debug = false;
var noJwt = false; //turn off web token security
var apiServerConfig = cfg.api[env.api_env];

/* Command-Line Arguments Processing
 These are processed without prefixed "-"
 Space-delimited args
*/
console.log('Use command-line arguments like this: http/https/http2 | debug | port=5000 | dev-remote/prod');
for (var i=0; i<process.argv.length; i++) {
    var all = process.argv[i].split('='); //the ith command-line argument
    var act = all[0]; //action, left of action=argument
    var arg = all[1]; //argument, right of action=argument
    console.log(`command-line argument ${i}`, all);
	switch(act) {
    case "debug":
      debug = true;
      break;
		case "http":
			apiServerConfig.tls = 0;
      apiServerConfig.port = 4321;
			break;
		case "https":
      apiServerConfig.tls = 1;
      apiServerConfig.port = 4322;
			break;
		case "http2":
      apiServerConfig.tls = 2;
      apiServerConfig.port = 4322;
			break;
    case "port":
      apiServerConfig.port = arg;
      break;
    case "dev-remote":
      /*
      apiServerConfig.tls = 1;
      apiServerConfig.port = 4322;
      apiServerConfig.host = 'dev.vpatlas.org';
      */
      apiServerConfig = cfg.api["dev-remote"];
      break;
    case "production":
    case "prod":
      /*
      apiServerConfig.tls = 1;
      apiServerConfig.port = 4322;
      apiServerConfig.host = 'vpatlas.org';
      */
      apiServerConfig = cfg.api["prod"];
      break;
	}
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

//debug middleware to get request info for display
app.use(function (req, res, next) {
  //console.log('server.js | request:', req);
  if (debug) {
    console.log('server.js | req.method', req.method);
    console.log('server.js | req.originalUrl', req.originalUrl);
    console.log('server.js | req.headers', req.headers);
    console.log('server.js | req.params', req.params);
    console.log('server.js | req.query', req.query);
    console.log('server.js | req.file', req.file);
  } else {
    console.log('server.js | req.method:', req.method,
    '| req.origUrl:', req.originalUrl,
    '| req.params:', req.params,
    '| req.query', req.query);
  }
  next();
});

// use JWT auth to secure the api
if (!noJwt) {app.use(jwt());}

app.use(compression());

try {
  //test the db connection first. each of the below routes include services that make a db connection, creating lots of errors.
  const db = require('apiDb/db_postgres');
  // api routes
  app.use('/', require('./default.routes')); //web page with top-level routes
  app.use('/user', require('./apiUser/user.routes')); //postgres user db
  app.use('/info', require('./vtInfo/vtInfo.routes')); //postgres vermont data - counties, towns, etc.
  app.use('/util', require('./apiUtility/utils.routes')); //utils to test API features like where clause handling
  app.use('/aws/s3', require('./apiUtility/awsS3Info.routes')); //get connection credentials for aws s3 bucket by bucketName
  app.use('/parcel', require('./vcgiMapData/vcgiParcel.routes')); //get parcel map geoJSON
  app.use('/loonwatch', require('./ingest/ingest.routes')); //postgres ingest db
  app.use('/loonwatch/survey', require('./survey/survey.routes')); //postgres survey db
} catch(err) {
  console.log('attempt to open db failed |', err);
  process.exit();
}

// global error handler
//NOTE: this causes error when http status is set in handler. No solution yet.
app.use(errorHandler);

var certConfig = {
  path: `/etc/letsencrypt/live/${apiServerConfig.host}`,
  key: 'privkey.pem',
  cert: 'fullchain.pem'
};
var keyFile = null;
var certFile = null;
var server = null;

console.log('apiServerConfig |', apiServerConfig);

//create server and listen
if (apiServerConfig.tls > 0) {
  console.log('certConfig |', certConfig);
  fs.readFile(`${certConfig.path}/${certConfig.key}`, (err, data) => {
    if (err) {
      console.log(err); process.exit();}
    else { //else-1
      keyFile = data;
      fs.readFile(`${certConfig.path}/${certConfig.cert}`, (err, data) => {
        if (err) {console.log(err); process.exit();}
        else { //else-2
          certFile = data;
          httpsServer(keyFile, certFile);
        } //end else-2
      }); //readFile-2
    } //end else-1
  }); //readFile-1
} else {
  httpServer();
}

function httpServer() {
  server = app.listen(apiServerConfig.port, () => {console.log(`http server listening on ${apiServerConfig.port}`);});
}
function httpsServer(keyFile, certFile) {
  server = https.createServer({
      key: keyFile,
      cert: certFile
  }, app).listen(apiServerConfig.port, () => {console.log(`https server listening on ${apiServerConfig.port}`);});
}
