/*
 How to configure watch is not obvious. See this post:
 https://stackoverflow.com/questions/57791439/how-to-get-pm2-process-to-watch-after-it-has-been-stopped-restarted
*/
module.exports = {
  apps : [{
    script : "./server.js",
    name: "vpatlas-node-postgis-api",
    exec_mode: "cluster", // "cluster" or "fork"
    instances: 3, //-1,  // number of CPUs -1
    watch: true,  // auto restart app on change
    ignore_watch: ["node_modules"],
    watch_delay: 3000,
    watch_options: {"usePolling": true},
/*
    wait_ready: true, // wait for app to send process.send('ready')
    listen_timeout: 10000, //timeout to wait for the ready signal, otherwise... do what?
*/
/*
 Note: Removing the default env means a no-arg call ('pm2 start') will try to detect server context from os hostname
*/
    default: {
       NODE_ENV: "dev-local",
       watch: ["./server.js","_helpers","users","vcgiMapData","vtInfo","vpMapped","vpPools","vpReview","vpSurvey","vpUtil","vpVisit"],
    },
    env_dev: {
       NODE_ENV: "dev-local",
       watch: ["./server.js","_helpers","users","vcgiMapData","vtInfo","vpMapped","vpPools","vpReview","vpSurvey","vpUtil","vpVisit"],
    },
    env_dev_local: {
       NODE_ENV: "dev-local",
       watch: ["./server.js","_helpers","users","vcgiMapData","vtInfo","vpMapped","vpPools","vpReview","vpSurvey","vpUtil","vpVisit"],
    },
    env_dev_remote: {
       NODE_ENV: "dev-remote",
       watch: ["./server.js", "/etc/letsencrypt/live"]
    },
    env_prod: {
       NODE_ENV: "prod",
       watch: ["/etc/letsencrypt/live","./server.js","_helpers","users","vcgiMapData","vtInfo","vpMapped","vpPools","vpReview","vpSurvey","vpUtil","vpVisit"],
    },
    env_production: {
       NODE_ENV: "prod",
       watch: ["/etc/letsencrypt/live","./server.js","_helpers","users","vcgiMapData","vtInfo","vpMapped","vpPools","vpReview","vpSurvey","vpUtil","vpVisit"],
    }
  }]
}
