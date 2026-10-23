const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const pdfRoutes = require('./routes/pdfRoutes');

const app = express();

// PUBLIC_BASE_URL on ekiyle gelen istekleri normal route'lara yonlendir
// (orn. /api/datasources/proxy/uid/pdfexporter/generate-pdf -> /generate-pdf)
// PUBLIC_BASE_URL tanimli degilse hicbir sey yapmaz.
app.use((req, res, next) => {
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (base.startsWith('/') && req.url.startsWith(base)) {
        req.url = req.url.slice(base.length) || '/';
    }
    next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        cookies: req.headers.cookie,
        path: req.path
    });
    next();
});

// Main CORS configuration (iki ortam birlikte)
app.use(cors({
    origin: [
        // Internal (rp1)
        'https://zabbixreporting.a1.mk',
        'http://zabbixreporting.a1.mk:8080',
        'http://localhost:3000',
        // Netview (rp2)
        'https://netview.a1.mk',
        'http://10.160.180.19:8080',
        'http://10.160.180.19:8081'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Cookie', 'Accept']
}));

app.use(express.json());
app.use(cookieParser());

// Disable certain helmet middleware that might interfere with cookie handling
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Debug middleware for static file requests
app.use((req, res, next) => {
    if (req.url.includes('/public/') || req.url.includes('/output/')) {
        console.log('Static file request:', {
            url: req.url,
            resolvedPath: path.resolve(__dirname, '..' + req.url)
        });
    }
    next();
});

// Serve static files from output and public directories
app.use('/output', express.static(path.join(__dirname, '../output')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', pdfRoutes);

module.exports = app;
