const { fork } = require('child_process');
const path = require('path');
const config = require('../config/config');
const emailService = require('../services/emailService');

const generatePdf = async (req, res) => {
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

        // Use the correct path for grafana_pdf.js
        const scriptPath = path.join(__dirname, '..', 'utils', 'grafana_pdf.js');
        const script = fork(scriptPath, [finalUrl, `${config.grafana.user}:${config.grafana.password}`]);

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
};

const sendEmail = async (req, res) => {
    const { to, subject, pdfUrl, dashboardName } = req.body;

    if (!to || !pdfUrl) {
        return res.status(400).json({ error: 'Recipient email and PDF URL are required' });
    }

    try {
        const result = await emailService.sendEmailWithPdf(to, subject, pdfUrl, dashboardName);
        res.json(result);
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
};

module.exports = {
    generatePdf,
    sendEmail
}; 