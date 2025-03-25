require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { fork } = require('child_process');
const axios = require('axios');
const cookieParser = require('cookie-parser');

const GRAFANA_USER = process.env.GRAFANA_USER;
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD;
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://host.docker.internal:3000';

const app = express();
const port = process.env.EXPORT_SERVER_PORT || 3001;

if (!GRAFANA_USER || !GRAFANA_PASSWORD) {
    console.error('.env file does not seem to be found or missing required fields. Please check README.md for more information.');
    process.exit(1);
}

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        cookies: req.headers.cookie
    });
    next();
});

// Handle preflight requests
app.options('*', cors({
    origin: true, // Allow any origin temporarily for debugging
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Cookie']
}));

// Main CORS configuration
app.use(cors({
    origin: true, // Allow any origin temporarily for debugging
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Cookie']
}));

app.use(express.json());
app.use(cookieParser());

// Disable certain helmet middleware that might interfere with cookie handling
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use('/output', express.static(path.join(__dirname, 'output')));

// Authentication middleware using forwarded cookies
const authenticateRequest = async (req, res, next) => {
    try {
        const { grafanaUrl } = req.body;
        const cookies = req.headers.cookie;

        console.log('Authentication attempt:', {
            cookies: cookies,
            headers: req.headers,
            url: req.url,
            grafanaUrl: grafanaUrl
        });

        if (!cookies) {
            return res.status(401).json({ 
                error: 'Unauthorized - No cookies provided',
                debug: { 
                    headers: req.headers,
                    message: 'Make sure you are logged into Grafana and cookies are being forwarded'
                }
            });
        }

        // Parse cookies into an object for easier handling
        const cookieObj = cookies.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});

        // Get the target Grafana URL, replacing localhost with host.docker.internal
        let targetGrafanaUrl = grafanaUrl || GRAFANA_URL;
        if (targetGrafanaUrl.includes('localhost')) {
            targetGrafanaUrl = targetGrafanaUrl.replace('localhost', 'host.docker.internal');
        }
        console.log('Using Grafana URL:', targetGrafanaUrl);

        try {
            const response = await axios.get(`${targetGrafanaUrl}/api/user`, {
                headers: {
                    'Cookie': cookies,
                    'Accept': 'application/json',
                },
                validateStatus: false // Don't throw on non-2xx responses
            });

            console.log('Grafana user response:', {
                status: response.status,
                data: response.data
            });

            if (response.status === 200 && response.data) {
                req.grafanaCookies = cookies;
                req.grafanaUrl = targetGrafanaUrl;
                next();
            } else {
                return res.status(403).json({ 
                    error: 'Forbidden - Invalid or expired session',
                    debug: { 
                        verifyResponse: response.data,
                        cookies: cookieObj,
                        grafanaUrl: targetGrafanaUrl,
                        endpoint: `${targetGrafanaUrl}/api/user`
                    }
                });
            }
        } catch (error) {
            console.error('Grafana verification error:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                endpoint: `${targetGrafanaUrl}/api/user`
            });

            // Special handling for connection refused errors
            if (error.code === 'ECONNREFUSED') {
                return res.status(500).json({ 
                    error: 'Could not connect to Grafana server',
                    debug: { 
                        message: 'Connection to Grafana refused. Make sure Grafana is running and accessible.',
                        grafanaUrl: targetGrafanaUrl,
                        originalError: error.message
                    }
                });
            }

            return res.status(401).json({ 
                error: 'Authentication failed - Could not verify with Grafana',
                debug: { 
                    message: error.message,
                    response: error.response?.data,
                    cookies: cookieObj,
                    grafanaUrl: targetGrafanaUrl,
                    endpoint: `${targetGrafanaUrl}/api/user`
                }
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ 
            error: 'Authentication error',
            message: error.message,
            debug: {
                cookies: req.headers.cookie,
                grafanaUrl: req.body.grafanaUrl
            }
        });
    }
};

app.get('/check-status', (req, res) => {
    res.send('Server is running');
});

app.post('/generate-pdf', authenticateRequest, (req, res) => {
    let { url: requestUrl, from, to } = req.body;

    if (!requestUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        const urlObj = new URL(requestUrl);
        
        // Fix URL if Grafana is on localhost - Docker can't access host's localhost directly
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
            console.log(`Transforming URL from ${urlObj.hostname}:${urlObj.port} to host.docker.internal:${urlObj.port}`);
            urlObj.hostname = 'host.docker.internal';
        }

        // Forward the authentication cookies to the URL
        if (req.grafanaCookies) {
            // Extract grafana_session from cookies if present
            const grafanaSession = req.grafanaCookies
                .split(';')
                .find(cookie => cookie.trim().startsWith('grafana_session='))
                ?.split('=')[1];

            if (grafanaSession) {
                urlObj.searchParams.append('auth_token', grafanaSession);
            }
        }

        if (from && !urlObj.searchParams.has('from')) {
            urlObj.searchParams.append('from', from);
        }
        if (to && !urlObj.searchParams.has('to')) {
            urlObj.searchParams.append('to', to);
        }

        const finalUrl = urlObj.toString();
        console.log(`Processing request for URL: ${finalUrl}`);

        const script = fork('grafana_pdf.js', [finalUrl, `${GRAFANA_USER}:${GRAFANA_PASSWORD}`]);

        script.on('message', (message) => {
            if (message.success) {
                const pdfPath = message.path;
                const pdfUrl = `${req.protocol}://${req.get('host')}/output/${path.basename(pdfPath)}`;
                res.json({ pdfUrl });
            } else {
                res.status(500).send(`Error generating PDF: ${message.error}`);
            }
        });

        script.on('error', (error) => {
            console.error('PDF generation script error:', error);
            res.status(500).send(`Error generating PDF: ${error.message}`);
        });
    } catch (error) {
        console.error('Error processing PDF generation request:', error);
        res.status(500).send(`Error processing request: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

/*
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem')),
};
const server = https.createServer(httpsOptions,app);

server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

module.exports = server;
*/