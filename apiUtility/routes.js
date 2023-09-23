
/*
    Display routes served by a router
*/
function routes(router) {
    let ruts = {};
    for (const rut of router.stack) {
        ruts[rut.route.path] = rut.route.methods;
    }
    console.log('apiUtility/routes::routes', ruts);
    return ruts;
}
module.exports = routes;