# We MUST delete all to get the ecosystem config to apply to running instances
pm2 delete all
# This just means start PM2 with this config and these args
pm2 start ecosystem.config.js --env prod
