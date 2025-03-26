require('dotenv').config();

const config = {
    grafana: {
        user: process.env.GRAFANA_USER,
        password: process.env.GRAFANA_PASSWORD,
        url: process.env.GRAFANA_URL || 'http://host.docker.internal:3000'
    },
    smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM
    },
    server: {
        port: process.env.EXPORT_SERVER_PORT || 3001
    },
    ssl: {
        key: process.env.SSL_KEY_PATH,
        cert: process.env.SSL_CERT_PATH
    }
};

// Validate required configuration
if (!config.grafana.user || !config.grafana.password) {
    console.error('.env file does not seem to be found or missing required fields. Please check README.md for more information.');
    process.exit(1);
}

module.exports = config; 