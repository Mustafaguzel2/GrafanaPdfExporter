const fs = require('fs');
const http = require('http');
const https = require('https');
const app = require('./app');
const config = require('./config/config');
const ssl = config.ssl;

const port = config.server.port;

// SSL configuration
const sslOptions = {
    key: fs.readFileSync(ssl.key),
    cert: fs.readFileSync(ssl.cert)
};

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);
httpsServer.listen(port, () => {
    console.log(`HTTPS Server is listening on port ${port}`);
});

// Create HTTP server (optional, for development)
const httpServer = http.createServer(app);
httpServer.listen(port + 1, () => {
    console.log(`HTTP Server is listening on port ${port + 1}`);
}); 