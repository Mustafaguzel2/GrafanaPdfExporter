const nodemailer = require('nodemailer');
const axios = require('axios');
const config = require('../config/config');

// Create email transporter
const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: true,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
    }
});

const sendEmailWithPdf = async (to, subject, pdfUrl, dashboardName) => {
    try {
        // Download the PDF file
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const pdfBuffer = Buffer.from(response.data);

        // Send email with PDF attachment
        await transporter.sendMail({
            from: config.smtp.from,
            to: to,
            subject: subject || `Grafana Dashboard: ${dashboardName || 'Export'}`,
            text: `Please find attached the Grafana dashboard export.`,
            attachments: [{
                filename: `dashboard-${Date.now()}.pdf`,
                content: pdfBuffer
            }]
        });

        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = {
    sendEmailWithPdf
}; 