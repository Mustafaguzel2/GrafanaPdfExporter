require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { fork } = require('child_process');

const GRAFANA_USER = process.env.GRAFANA_USER;
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD;
// Default Grafana URL to map requests to - if your Grafana is on a different host/port
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://host.docker.internal:3000';

const app = express();
const port = process.env.EXPORT_SERVER_PORT || 3001;

if (!GRAFANA_USER || !GRAFANA_PASSWORD) {
    console.error('.env file do not seems to be found or missing required fields. Please check README.md for more information. ');
    process.exit(1);
}

app.use(express.json());
app.use(cors());
app.use('/output', express.static(path.join(__dirname, 'output')));

app.get('/check-status', (req, res) => {
  res.send('Server is running');
});
app.post('/generate-pdf', (req, res) => {
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
