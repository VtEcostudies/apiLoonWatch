# We MUST delete all to get the ecosystem config to apply to running instances
# HOWEVER, now that there are 2 systems on this server, we can't do this
sudo pm2 delete loonwatch-node-postgis-api
# Instead do the following:
# - sudo pm2 list
# - get the # of the loonWatch API service
# - sudo pm2 stop #
# - sudo pm2 delete #
# This just means start PM2 with this config and these args
sudo pm2 start ecosystem.config.js --env prod
