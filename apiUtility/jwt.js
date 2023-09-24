const expressJwt = require('express-jwt');
const config = require('config.js');
const userService = require('../apiUser/user.service');

module.exports = jwt;

/*
https://hptechblogs.com/using-json-web-token-for-authentication/
https://www.npmjs.com/package/express-jwt

How express-jwt parses the request is opaque here. However, via Postman include an Authorization Request Header:

Header Type: Authorization, Bearer Token

Example: Key: Authorization, Value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YzhmZmM5YTBmYWViNjIyMWMwNmM5NzgiLCJpYXQiOjE1NTI5OTIwODV9.PRQffRTZZ4jLQ-7nkEtQQ0BFdLsnB5FBmgmLyFyqv90
*/
function jwt() {
    const secret = config.secret;
    const algorithms = ['HS256']; //NOTE: This has to match user.service jwt.sign algorithm.
    return expressJwt({ secret, algorithms, isRevoked }).unless({
        path: [
            /*
             public routes that don't require authentication
             https://stackoverflow.com/questions/30559158/handling-parameterised-routes-in-express-jwt-using-unless
             */
            '/users/authenticate',
            '/users/register',
            '/users/reset',
            '/users/verify',
            '/users/confirm',
            '/users/routes',
            '/users/test',

            { url: /^\/util\/*/, methods: ['GET'] },

            { url: /^\/info\/*/, methods: ['GET'] },

            { url: /^\/parcel\/*/, methods: ['GET'] },

            { url: /^\/loonwatch\/*/, methods: ['GET'] },

            { url: /^\/survey\/*/, methods: ['GET'] },

            //for testing. remove these in production.
            //{ url: /^\/survey\/.*/, methods: ['POST'] },
            //{ url: /^\/visit\/.*/, methods: ['POST'] }

        ]
    });
}

/*
    NOTE - here is explanation on how to use express-jwt:

        https://github.com/auth0/express-jwt#usage

    It's as simple as this:

        jwt adds req.user to the req object. use it.
        if it's missing values, we can add them here by setting req.user

    Actually, it's more secure to use a user record retrieved from the DB
    here, than to trust the values in the incoming token. Use that, instead.
*/
async function isRevoked(req, payload, done) {

    console.log(`jwt::isRevoked()
                req.body:[${Object.keys(req.body)}] [${Object.values(req.body)}]
                payload:[${Object.keys(payload)}] [${Object.values(payload)}]`
                );

    if (payload.sub) { //on login we put userid into payload.sub
      req.user = await userService.getById(payload.sub);
      //console.log('jwt::isRevoked | req.user |', req.user);
      req.dbUser = req.user; //odd behavior - req.user is dbUser here, but elsewhere not. set separate value for downstream use.
    }

    // revoke token if user no longer exists or not found, or we need to disable logins
    if (!req.user || config.disableLogins) {
        return done(null, true);
    }

    //console.dir(req.user);

    return done();
};
