const fs = require('fs');
const http = require('http');
const https = require('https');
const app = require('./app');
const config = require('./config/config');
const ssl = config.ssl;

const port = config.server.port;

// Sertifika varsa HTTPS (rp1 / zabbixreporting), yoksa HTTP (rp2 / netview,
// HTTPS'i A1 proxy'si karsiliyor)
const hasSsl = ssl && ssl.key && ssl.cert && fs.existsSync(ssl.key) && fs.existsSync(ssl.cert);

if (hasSsl) {
    const sslOptions = {
        key: fs.readFileSync(ssl.key),
        cert: fs.readFileSync(ssl.cert)
    };
    https.createServer(sslOptions, app).listen(port, () => {
        console.log(`HTTPS Server is listening on port ${port}`);
    });
} else {
    http.createServer(app).listen(port, () => {
        console.log(`HTTP Server is listening on port ${port} (no SSL cert found)`);
    });
}
