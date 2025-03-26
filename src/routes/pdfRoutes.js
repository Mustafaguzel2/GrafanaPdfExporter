const express = require('express');
const router = express.Router();
const authenticateRequest = require('../middleware/authMiddleware');
const pdfController = require('../controllers/pdfController');

// Health check endpoint
router.get('/check-status', (req, res) => {
    res.send('Server is running');
});

// PDF generation endpoint
router.post('/generate-pdf', authenticateRequest, pdfController.generatePdf);

// Email sending endpoint
router.post('/send-email', authenticateRequest, pdfController.sendEmail);

module.exports = router; 