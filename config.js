const secrets = require('./secrets');

module.exports=
{
  "disableLogins": false,
  "appName": 'LoonWatch',
  "userTbl": 'user',
  "roleTbl": 'role',
  "secret": secrets.apiSecret,
  "vceEmail": "vpatlas@vtecostudies.org",
  "vcePassW": secrets.emailPassword,

  "server" : {
    "dev": "localhost:4200",
    "prod": "vpatlas.org",
    "dev-local": "localhost:4200",
    "dev-remote": "dev.vpatlas.org"
  },

  "token" : {
    "loginExpiry": "1 hour",
    "registrationExpiry": "1 hour",
    "resetExpiry": "1 hour"
  },

  "api": {
    "dev": {tls:0, port:4000, host:"localhost"},
    "prod":{tls:1, port:4422, host:"api.loons.vtecostudies.org"},
    "dev-local":{tls:0, port:4000, host:"localhost"},
    "dev-remote":{tls:1, port:4422, host:"api.loons.vtecostudies.org"}
  },

	"pg": {

    "dev": {
      "user": "api",
      "host": "localhost",
      "database": "loonweb",
      "password": secrets.dbPassword,
      "port": 5432
    },

    "prod": {
      "user": "api",
      "host": "localhost",
      "database": "loonweb",
      "password": secrets.dbPassword,
      "port": 5432
    },

    "dev-local": {
      "user": "api",
      "host": "localhost",
      "database": "loonweb",
      "password": secrets.dbPassword,
      "port": 5432
    },

    "dev-remote": {
      "user": "api",
      "host": "localhost",
      "database": "loonweb",
      "password": secrets.dbPassword,
      "port": 5432
    }
  },

  "survey123" : {
    "visit" : {
      "serviceId" : ""
    },
    "survey" : {
      "serviceId" : ""
    }
  }
}
