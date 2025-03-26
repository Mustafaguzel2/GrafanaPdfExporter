const axios = require('axios');
const config = require('../config/config');

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
        let targetGrafanaUrl = grafanaUrl || config.grafana.url;
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

module.exports = authenticateRequest; 