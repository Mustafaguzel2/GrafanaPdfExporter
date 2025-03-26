# Grafana PDF Exporter

A sophisticated Node.js application designed for high-fidelity PDF exports of Grafana dashboards. This enterprise-ready solution provides automated report generation with professional branding, comprehensive email integration, and robust authentication mechanisms. Built with scalability and reliability in mind, it maintains perfect visual reproduction of complex dashboards while offering extensive customization options.

## 🌟 Features

### Core Features
- 📊 **Enterprise-Grade PDF Export**
  - Pixel-perfect dashboard reproduction
  - High-resolution graph rendering
  - Vector-based text for crystal-clear quality
  - Support for all Grafana visualization types
  - Multi-page layout optimization

- 🎨 **Advanced Visualization Handling**
  - Maintains complex graph interactivity
  - Preserves all data points and metrics
  - Accurate color reproduction
  - Custom theme support
  - Dynamic sizing and scaling

- 🖼️ **Professional Branding**
  - Customizable logo placement
  - Corporate watermarking
  - Custom headers and footers
  - Consistent brand identity
  - Template-based styling

- 📧 **Enterprise Email Integration**
  - SMTP/SMTPS support
  - HTML email templates
  - Attachment size optimization
  - Batch sending capabilities
  - Email delivery tracking

- 🔐 **Comprehensive Security**
  - OAuth 2.0 support
  - HTTPS encryption
  - Cookie-based authentication
  - Rate limiting
  - CORS protection

### Advanced Features
- 🔄 **Intelligent Panel Management**
  - Automatic panel discovery
  - Layout preservation
  - Dynamic content scaling
  - Interactive element handling
  - Custom panel ordering

- 📐 **Smart Rendering Engine**
  - Viewport optimization
  - DPI awareness
  - Resolution adaptation
  - Memory optimization
  - Parallel processing support

- 🎭 **Enhanced Kiosk Mode**
  - Clean UI rendering
  - Distraction-free exports
  - Custom element filtering
  - Template-based layouts
  - Consistent spacing

- 🕒 **Advanced Time Management**
  - Relative time range support
  - Timezone awareness
  - Custom time formats
  - Scheduled exports
  - Time range validation

## 📋 Technical Requirements

### System Requirements
- **Node.js**: v14.x LTS or higher
  - Event loop optimization
  - Async operation support
  - Memory management features

- **Docker**: v20.x or higher
  - Container orchestration
  - Volume management
  - Network isolation
  - Resource allocation

- **Grafana**: v8.x or higher
  - API access enabled
  - Authentication configured
  - CORS settings adjusted
  - Plugin support

### Network Requirements
- Open ports for HTTP/HTTPS (default: 3001)
- SMTP access for email functionality
- Grafana API accessibility
- Docker network bridge support

### Storage Requirements
- Minimum 1GB for application
- PDF storage capacity (varies by usage)
- Log file storage
- Temporary file handling

## 🚀 Deployment Options

### Docker Deployment (Production Recommended)

1. **Clone and Configure**:
```bash
# Clone the repository
git clone https://github.com/yourusername/grafana-pdf-exporter.git
cd grafana-pdf-exporter

# Create and configure environment
cp .env.template .env
```

2. **Environment Configuration**:
```env
# Grafana Integration
GRAFANA_USER=your_grafana_username
GRAFANA_PASSWORD=your_grafana_password
GRAFANA_URL=http://host.docker.internal:3000
GRAFANA_API_KEY=your_api_key                 # Optional: For token-based auth

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@example.com
SMTP_SECURE=true                            # Enable TLS
SMTP_POOL=true                             # Enable connection pooling

# Application Settings
EXPORT_SERVER_PORT=3001
NODE_ENV=production
DEBUG_MODE=false
PDF_WIDTH_PX=1200
FORCE_KIOSK_MODE=true
NAVIGATION_TIMEOUT=120000
MAX_CONCURRENT_EXPORTS=5
RATE_LIMIT_WINDOW=900000                   # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100                # Maximum requests per window
```

3. **Production Deployment**:
```bash
# Build and run with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# Monitor logs
docker-compose logs -f
```

### Manual Deployment (Development)

1. **Install Dependencies**:
```bash
# Install with exact versions
npm ci

# Install development dependencies
npm install --only=development
```

2. **Development Server**:
```bash
# Start development server
npm run dev

# With debugging
DEBUG=app:* npm run dev
```

## 📚 API Reference

### PDF Generation API

#### Generate PDF
\`\`\`http
POST /generate-pdf
Content-Type: application/json
Authorization: Bearer <your_token>
\`\`\`

Request Schema:
```json
{
  "url": "http://your-grafana-dashboard-url",
  "from": "now-6h",
  "to": "now",
  "options": {
    "width": 1200,
    "format": "A4",
    "landscape": true,
    "scale": 1,
    "displayHeaderFooter": true,
    "headerTemplate": "<div>Custom Header</div>",
    "footerTemplate": "<div>Page <span class='pageNumber'></span> of <span class='totalPages'></span></div>"
  }
}
```

Response Schema:
```json
{
  "success": true,
  "pdfUrl": "http://your-server/output/dashboard-123.pdf",
  "metadata": {
    "generatedAt": "2024-03-26T10:30:00Z",
    "pageCount": 5,
    "fileSize": 1048576
  }
}
```

#### Email Distribution API

\`\`\`http
POST /send-email
Content-Type: application/json
Authorization: Bearer <your_token>
\`\`\`

Request Schema:
```json
{
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "subject": "Dashboard Report",
  "template": "monthly-report",
  "data": {
    "dashboardName": "System Overview",
    "period": "March 2024",
    "customFields": {
      "team": "Infrastructure",
      "environment": "Production"
    }
  },
  "attachments": [
    {
      "filename": "dashboard.pdf",
      "path": "http://your-server/output/dashboard-123.pdf"
    }
  ]
}
```

## 🛠️ Advanced Configuration

### Performance Tuning

```javascript
// config/performance.js
module.exports = {
  // Concurrent request handling
  maxConcurrentExports: 5,
  exportQueueSize: 100,
  
  // Memory management
  maxMemoryMB: 2048,
  garbageCollectionInterval: 300000,
  
  // Timeout settings
  renderTimeout: 30000,
  networkTimeout: 10000,
  
  // Cache configuration
  enableCache: true,
  cacheDuration: 3600,
  cacheSize: 100
};
```

### Security Configuration

```javascript
// config/security.js
module.exports = {
  cors: {
    origin: ['https://grafana.example.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  rateLimit: {
    windowMs: 900000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }
};
```

## 🗂️ Architecture Overview

```plaintext
src/
├── config/                 # Configuration management
│   ├── config.js          # Main configuration
│   ├── performance.js     # Performance settings
│   └── security.js        # Security settings
├── controllers/           # Business logic
│   ├── pdfController.js   # PDF generation
│   └── emailController.js # Email handling
├── middleware/            # Request processing
│   ├── authMiddleware.js  # Authentication
│   ├── rateLimiter.js    # Rate limiting
│   └── validator.js       # Request validation
├── services/             # Core services
│   ├── pdfService.js     # PDF generation
│   ├── emailService.js   # Email handling
│   └── cacheService.js   # Caching logic
├── utils/                # Utility functions
│   ├── logger.js        # Logging
│   ├── metrics.js       # Performance metrics
│   └── helpers.js       # Helper functions
└── public/              # Static assets
    └── templates/       # Email templates
```

## 🔍 Monitoring & Debugging

### Logging Configuration
```javascript
// utils/logger.js
const winston = require('winston');

module.exports = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Metrics Collection
```javascript
// utils/metrics.js
const prometheus = require('prom-client');

const pdfGenerationDuration = new prometheus.Histogram({
  name: 'pdf_generation_duration_seconds',
  help: 'PDF generation duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});

const emailSendDuration = new prometheus.Histogram({
  name: 'email_send_duration_seconds',
  help: 'Email sending duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});
```

## 🔒 Security Best Practices

### Authentication
- JWT token validation
- API key rotation
- Session management
- Role-based access control
- Audit logging

### Data Protection
- TLS encryption
- Secure cookie handling
- XSS prevention
- CSRF protection
- Input validation

### Network Security
- Firewall configuration
- Reverse proxy setup
- Rate limiting
- IP filtering
- DDoS protection

## 📈 Performance Optimization

### Caching Strategy
- Redis integration
- Memory caching
- Cache invalidation
- Partial caching
- Cache warming

### Resource Management
- Connection pooling
- Memory monitoring
- CPU utilization
- Disk I/O optimization
- Network bandwidth management

## 🤝 Contributing Guidelines

### Development Workflow
1. Fork repository
2. Create feature branch
3. Implement changes
4. Write tests
5. Submit pull request

### Code Standards
- ESLint configuration
- Prettier formatting
- TypeScript definitions
- Documentation requirements
- Test coverage requirements

## 📞 Enterprise Support

For enterprise support:
- 24/7 technical assistance
- Custom feature development
- Performance optimization
- Security auditing
- Training and documentation

---

> "Transforming data visualization into actionable insights through automated reporting."

*Copyright © 2024 Grafana PDF Exporter. All rights reserved.*
