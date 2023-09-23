# pm2 is included in package.json, but previous npm install is inadequate.
# Do a full install of pm2:
npm install pm2 -g && pm2 update
pm2 completion install # Add CLI autocompletion