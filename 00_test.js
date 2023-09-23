const query = require('./_helpers/db_postgres').query;

query('SELECT version();')
  .then(res => {
    console.log(res.rows[0]);
  })
  .catch(err => {
    console.log(err);
  })
