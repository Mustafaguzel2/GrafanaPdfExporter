const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const pdfRoutes = require('./routes/pdfRoutes');

const app = express();

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

// Debug middleware for static file requests
app.use((req, res, next) => {
    if (req.url.includes('/public/') || req.url.includes('/output/')) {
        console.log('Static file request:', {
            url: req.url,
            resolvedPath: path.resolve(__dirname, '.' + req.url)
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