# Grafana Pdf Exporter
## 🌟 Features

- **One-Click Export**: Inject an export button directly into Grafana's UI
- **High-Fidelity Rendering**: Preserves all charts, graphs, gauges, and visualizations as they appear in Grafana
- **Complete Dashboard Capture**: Intelligently captures all panels, including those below the visible fold
- **Time Range Preservation**: Maintains time range selections in exported PDFs
- **Panel-Specific Export**: Export individual panels or entire dashboards
- **Authentication Support**: Securely connect to protected Grafana instances
- **Docker Integration**: Easy deployment with Docker and Docker Compose
- **Customizable**: Configure resolution, scaling, and other PDF attributes
- **API Access**: Integrate with existing automation systems

## 📋 Prerequisites

- Docker and Docker Compose
- A running Grafana instance (local or remote)
- Basic understanding of environment variables

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone 
cd grafana-dashboard-to-pdf
```

### 2. Configure Environment Variables

```bash
cp .env.template .env
```

Edit `.env` with your configuration:

```env
# Grafana Authentication(it will be better if your user is admin)
GRAFANA_USER=pdf-export
GRAFANA_PASSWORD=pdf-export

# Server Configuration
EXPORT_SERVER_PORT=3001

# Important: Set this to your actual Grafana URL
GRAFANA_URL=http://host.docker.internal:3000

# PDF Generation Options
FORCE_KIOSK_MODE=true
EXTRACT_DATE_AND_DASHBOARD_NAME_FROM_HTML_PANEL_ELEMENTS=false
NAVIGATION_TIMEOUT=120000
DEBUG_MODE=false
PDF_WIDTH_PX=1200
```

> **Note**: The `GRAFANA_URL` must be accessible from inside the Docker container. Use `host.docker.internal` to reference your host machine.

### 3. Start the Service

```bash
docker-compose up -d
```

Your PDF export service is now running on port 3001.

## 📖 Usage Options

### Option 1: Inject Button into Grafana

1. Enable HTML sanitization in Grafana:
   - Set `disable_sanitize_html = true` in your Grafana configuration

2. Create a new text panel in your dashboard
3. Set its Mode to "HTML"
4. Paste the contents of `grafana-button.html`
5. Save the dashboard

Now you'll see a "PDF" button in Grafana's share menu. Click it to export the current dashboard.

### Option 2: API Integration

Send a POST request to the export endpoint:

```bash
curl -X POST \
  http://localhost:3001/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://your-grafana-server/d/your-dashboard-id?orgId=1",
    "from": "now-6h",
    "to": "now"
  }'
```

The response will contain a URL to download the generated PDF.

### Option 3: Command Line

Use the provided shell script:

```bash
./generate-pdf.sh \
  GF_DASH_URL 'http://your-grafana-server/d/your-dashboard-id?orgId=1' \
  GF_FROM 'now-24h' \
  GF_TO 'now'
```

## ⚙️ Advanced Configuration

### PDF Export Quality Settings

Fine-tune your PDF exports by adjusting these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PDF_WIDTH_PX` | Width of the PDF in pixels | 1200 |
| `FORCE_KIOSK_MODE` | Removes UI elements for cleaner PDFs | true |
| `DEBUG_MODE` | Generates debug HTML files for troubleshooting | false |

### Docker Compose Configuration

Advanced users can modify `docker-compose.yml` to:
- Mount volumes for persistent storage
- Change default ports
- Add container health checks
- Set resource limits

### Custom Styling

To adjust the PDF appearance, modify these files:
- `grafana_pdf.js`: Core PDF generation logic
- `server.js`: API and request handling

## 🔍 Troubleshooting

### Connection Refused Errors

If you see `ECONNREFUSED` errors:

1. Ensure Grafana is running and accessible
2. Verify the `GRAFANA_URL` in your `.env` file
3. Use `host.docker.internal` instead of `localhost` when running in Docker
4. Check that the port in `GRAFANA_URL` matches your Grafana installation

### Missing or Cut-Off Panels

If panels are missing from your PDFs:

1. Increase the `NAVIGATION_TIMEOUT` to allow more time for rendering
2. Set `DEBUG_MODE=true` to generate debug files
3. Adjust scaling in `grafana_pdf.js` if needed

### Authentication Issues

If login problems occur:

1. Verify your Grafana credentials in `.env`
2. Check if your Grafana instance requires special authentication headers
3. Ensure the user has sufficient permissions to view dashboards

## 📊 Architecture

The project consists of three main components:

1. **API Server** (`server.js`): Handles HTTP requests and manages the PDF generation process
2. **PDF Generator** (`grafana_pdf.js`): Uses Puppeteer to render and capture Grafana dashboards
3. **Grafana Integration** (`grafana-button.html`): Injects UI controls into Grafana for user-friendly exports

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Puppeteer](https://github.com/puppeteer/puppeteer) for headless browser automation
- [Grafana](https://grafana.com/) for the amazing dashboarding platform
- [Express](https://expressjs.com/) for the web server framework
- [Docker](https://www.docker.com/) for containerization

---

> *"Data without visualization is like a book without words."*
