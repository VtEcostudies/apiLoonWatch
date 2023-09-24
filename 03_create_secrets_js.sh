# complete secrets.js using values defined for each item
# apiSecret is unique to this installation. Use a GUID.
# dbPassword is a postgres localhost login to a specific database behind a firewall.
# emailPassword is for this API's remote email backend, which is insecure. Protect it.
echo "module.exports = {apiSecret:'', dbPassword:'', emailPassword:''}" >> secrets.js