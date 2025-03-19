'use strict';

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

console.log("Script grafana_pdf.js started...");

const url = process.argv[2];
const auth_string = process.argv[3];
let outfile = process.argv[4];

const width_px = parseInt(process.env.PDF_WIDTH_PX, 10) || 1200;
console.log("PDF width set to:", width_px);

const auth_header = 'Basic ' + Buffer.from(auth_string).toString('base64');

(async () => {
    try {
        console.log("URL provided:", url);
        console.log("Checking URL accessibility...");
        const response = await fetch(url, {
            method: 'GET',
            headers: {'Authorization': auth_header}
        });

        if (!response.ok) {
            throw new Error(`Unable to access URL. HTTP status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            throw new Error("The URL provided is not a valid Grafana instance.");
        }

        let finalUrl = url;
        if(process.env.FORCE_KIOSK_MODE === 'true') {
            console.log("Checking if kiosk mode is enabled.")
            if (!finalUrl.includes('&kiosk')) {
                console.log("Kiosk mode not enabled. Enabling it.")
                finalUrl += '&kiosk=true';
            }
            console.log("Kiosk mode enabled.")
        }


        console.log("Starting browser...");
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });

        const page = await browser.newPage();
        console.log("Browser started...");

        await page.setExtraHTTPHeaders({'Authorization': auth_header});
        await page.setDefaultNavigationTimeout(process.env.PUPPETEER_NAVIGATION_TIMEOUT || 120000);

        await page.setViewport({
            width: width_px,
            height: 800,
            deviceScaleFactor: 2,
            isMobile: false
        });

        console.log("Navigating to URL...");
        await page.goto(finalUrl, {waitUntil: 'networkidle0'});
        console.log("Page loaded...");
        
        // First, get a count of all panels to make sure we capture everything
        const panelCount = await page.evaluate(() => {
            return document.querySelectorAll('.panel-container').length;
        });
        console.log(`Detected ${panelCount} panels in the dashboard`);
        
        // Pre-scroll the page to make all panels load before any modifications
        await page.evaluate(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const scrollTargets = ['.scrollbar-view', '.dashboard-container', '.main-view', 'body'];
            
            // Try each possible scrollable container
            for (const target of scrollTargets) {
                const scrollable = document.querySelector(target);
                if (scrollable) {
                    // Get document height to ensure we scroll all the way down
                    const fullHeight = Math.max(
                        document.body.scrollHeight, 
                        document.documentElement.scrollHeight,
                        scrollable.scrollHeight
                    );
                    
                    console.log(`Scrolling through ${fullHeight}px in ${target}`);
                    
                    // Scroll down in smaller increments with pauses
                    for (let i = 0; i < fullHeight; i += 200) {
                        scrollable.scrollTo(0, i);
                        await sleep(100);
                    }
                    
                    // Make sure we hit the very bottom
                    scrollable.scrollTo(0, fullHeight);
                    await sleep(500);
                    
                    // Scroll back to top
                    scrollable.scrollTo(0, 0);
                    await sleep(500);
                    break;
                }
            }
        });
        
        // Hide unnecessary UI elements but preserve important dashboard components
        await page.evaluate(() => {
            // Hide info corners, resize handles and any other UI clutter
            let infoCorners = document.getElementsByClassName('panel-info-corner');
            for (let el of infoCorners) {
                el.hidden = true;
            }
            let resizeHandles = document.getElementsByClassName('react-resizable-handle');
            for (let el of resizeHandles) {
                el.hidden = true;
            }
            
            // Hide only non-essential UI elements
            const hideSelectors = [
                '.navbar', '.sidemenu', '.dashboard-settings', '.submenu-controls',
                '.gf-form-inline', '.alert-rule-item__icon',
                '.page-toolbar', '.footer'
            ];
            
            hideSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el) el.style.display = 'none';
                });
            });
            
            // Preserve layout but make it more compact
            const panels = document.querySelectorAll('.panel-container');
            panels.forEach(panel => {
                if (panel) {
                    // Preserve the aspect ratio of panels
                    panel.style.marginBottom = '15px';
                    panel.style.overflow = 'visible'; // Ensure axes labels are visible
                    
                    // Make sure gauge and chart content is visible
                    const gaugeContent = panel.querySelectorAll('.gauge-value-container, .gauge-value');
                    gaugeContent.forEach(el => {
                        if (el) {
                            el.style.visibility = 'visible';
                            el.style.opacity = '1';
                        }
                    });
                    
                    // Ensure axis labels are visible
                    const axisLabels = panel.querySelectorAll('.axis-labels, .flot-x-axis, .flot-y-axis');
                    axisLabels.forEach(el => {
                        if (el) {
                            el.style.visibility = 'visible';
                            el.style.opacity = '1';
                        }
                    });
                }
            });
            
            // Make sure the dashboard container maintains proper aspect ratio
            const dashContainer = document.querySelector('.dashboard-container');
            if (dashContainer) {
                dashContainer.style.maxWidth = '100%';
                dashContainer.style.margin = '0 auto';
                dashContainer.style.padding = '15px';
            }
            
            // Ensure graph data is visible
            const graphContent = document.querySelectorAll('.graph-panel, .flot-base, .flot-text, .graph-legend');
            graphContent.forEach(el => {
                if (el) {
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                }
            });
        });

        let dashboardName = 'output_grafana';
        let date = new Date().toISOString().split('T')[0];
        let addRandomStr = false;

        if (process.env.EXTRACT_DATE_AND_DASHBOARD_NAME_FROM_HTML_PANEL_ELEMENTS === 'true') {
            console.log("Extracting dashboard name and date from the HTML page...");
            let scrapedDashboardName = await page.evaluate(() => {
                const dashboardElement = document.getElementById('display_actual_dashboard_title');
                return dashboardElement ? dashboardElement.innerText.trim() : null;
            });

            let scrapedDate = await page.evaluate(() => {
                const dateElement = document.getElementById('display_actual_date');
                return dateElement ? dateElement.innerText.trim() : null;
            });

            let scrapedPanelName = await page.evaluate(() => {
                const scrapedPanelName = document.querySelectorAll('h6');
                if (scrapedPanelName.length > 1) { // Multiple panels detected
                    console.log("Multiple panels detected. Unable to fetch a unique panel name. Using default value.")
                    return null;
                }
                if (scrapedPanelName[0] && scrapedPanelName[0].innerText.trim() === '') {
                    console.log("Empty panel name detected. Using default value.")
                    return null;
                }
                return scrapedPanelName[0] ? scrapedPanelName[0].innerText.trim() : null;
            });

            if (scrapedPanelName && !scrapedDashboardName) {
                console.log("Panel name fetched:", scrapedPanelName);
                dashboardName = scrapedPanelName;
                addRandomStr = false;
            } else if (!scrapedDashboardName) {
                console.log("Dashboard name not found. Using default value.");
                addRandomStr = true;
            } else {
                console.log("Dashboard name fetched:", scrapedDashboardName);
                dashboardName = scrapedDashboardName;
            }

            if (scrapedPanelName && !scrapedDate) {
                const urlParts = new URL(url);
                const from = urlParts.searchParams.get('from');
                const to = urlParts.searchParams.get('to');
                if (from && to) {
                    const fromDate = isNaN(from) ? from.replace(/[^\w\s-]/g, '_') : new Date(parseInt(from)).toISOString().split('T')[0];
                    const toDate = isNaN(to) ? to.replace(/[^\w\s-]/g, '_') : new Date(parseInt(to)).toISOString().split('T')[0];
                    date = `${fromDate}_to_${toDate}`;
                } else {
                    // using date in URL
                    date = new Date().toISOString().split('T')[0];
                }
            } else if (!scrapedDate) {
                console.log("Date not found. Using default value.");
            } else {
                console.log("Date fetched:", date);
                date = scrapedDate;
            }
        } else {
            console.log("Extracting dashboard name and date from the URL...");
            const urlParts = new URL(url);
            const pathSegments = urlParts.pathname.split('/');
            dashboardName = pathSegments[pathSegments.length - 1] || dashboardName;
            const from = urlParts.searchParams.get('from');
            const to = urlParts.searchParams.get('to');
            if (from && to) {
                const fromDate = isNaN(from) ? from.replace(/[^\w\s-]/g, '_') : new Date(parseInt(from)).toISOString().split('T')[0];
                const toDate = isNaN(to) ? to.replace(/[^\w\s-]/g, '_') : new Date(parseInt(to)).toISOString().split('T')[0];
                date = `${fromDate}_to_${toDate}`;
            } else {
                date = new Date().toISOString().split('T')[0];
            }
            console.log("Dashboard name fetched from URL:", dashboardName);
            console.log("Trying to fetch the panel name from the page...")
            let scrapedPanelName = await page.evaluate(() => {
                const scrapedPanelName = document.querySelectorAll('h6');
                console.log(scrapedPanelName)
                if (scrapedPanelName.length > 1) { // Multiple panels detected
                    console.log("Multiple panels detected. Unable to fetch a unique panel name. Using default value.")
                    return null;
                }
                if (scrapedPanelName[0] && scrapedPanelName[0].innerText.trim() === '') {
                    console.log("Empty panel name detected. Using default value.")
                    return null;
                }
                return scrapedPanelName[0] ? scrapedPanelName[0].innerText.trim() : null;
            });

            if (scrapedPanelName) {
                console.log("Panel name fetched:", scrapedPanelName);
                dashboardName = scrapedPanelName;
                addRandomStr = false;
            }

            console.log("Date fetched from URL:", date);
        }

        outfile = `./output/${dashboardName.replace(/\s+/g, '_')}_${date.replace(/\s+/g, '_')}${addRandomStr ? '_' + Math.random().toString(36).substring(7) : ''}.pdf`;

        const loginPageDetected = await page.evaluate(() => {
            const resetPasswordButton = document.querySelector('a[href*="reset-email"]');
            return !!resetPasswordButton;
        })

        if (loginPageDetected) {
            throw new Error("Login page detected. Check your credentials.");
        }

        if(process.env.DEBUG_MODE === 'true') {
            const documentHTML = await page.evaluate(() => {
                return document.querySelector("*").outerHTML;
            });
            if (!fs.existsSync('./debug')) {
                fs.mkdirSync('./debug');
            }
            const filename = `./debug/debug_${dashboardName.replace(/\s+/g, '_')}_${date.replace(/\s+/g, '_')}${'_' + Math.random().toString(36).substring(7)}.html`;
            fs.writeFileSync(filename, documentHTML);
            console.log("Debug HTML file saved at:", filename);

        }

        // Improved height calculation that ensures ALL panels are captured
        let totalHeight = await page.evaluate(() => {
            // Get document height using multiple methods
            const docHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight,
                document.body.clientHeight,
                document.documentElement.clientHeight
            );
            
            // Calculate total height by looking at all panels, including those initially off-screen
            const panels = document.querySelectorAll('.panel-container');
            let maxBottom = 0;
            
            panels.forEach(panel => {
                // Get panel position
                const rect = panel.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const absoluteTop = rect.top + scrollTop;
                const panelBottom = absoluteTop + rect.height;
                
                if (panelBottom > maxBottom) {
                    maxBottom = panelBottom;
                }
            });
            
            // Add generous padding for safety
            maxBottom += 100;
            
            // Return the greater of calculated panel height or document height
            console.log(`Document height: ${docHeight}, Max panel bottom: ${maxBottom}`);
            return Math.max(docHeight, maxBottom, 1200);
        });
        
        console.log("Total calculated height:", totalHeight);
        
        // Set viewport higher than needed first to make sure all content loads
        await page.setViewport({
            width: width_px,
            height: totalHeight,
            deviceScaleFactor: 2,
            isMobile: false
        });
        
        // Another scroll to ensure all content is loaded with new viewport
        await page.evaluate(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            // Force all charts to render by triggering resize events
            window.dispatchEvent(new Event('resize'));
            // Scroll through the page again more slowly
            const fullHeight = document.documentElement.scrollHeight;
            const scrollStep = 100;
            for (let i = 0; i < fullHeight; i += scrollStep) {
                window.scrollTo(0, i);
                await sleep(50);
            }
            
            // Back to top
            window.scrollTo(0, 0);
        });

        // Add A1 logo to the bottom right corner - try with error handling
        try {
            // List of potential logo paths to try
            const potentialLogoPaths = [
                'Reporting_A1_logo.png',                     // Current directory
                path.resolve('Reporting_A1_logo.png'),       // Absolute path
                path.resolve(__dirname, 'Reporting_A1_logo.png'), // Script directory
                '/app/Reporting_A1_logo.png',                // Common Docker container root
                path.resolve('/app/Reporting_A1_logo.png')   // Absolute Docker container path
            ];
            
            let logoBase64 = null;
            
            // Try each potential path
            for (const logoPath of potentialLogoPaths) {
                try {
                    console.log(`Trying to read logo from: ${logoPath}`);
                    if (fs.existsSync(logoPath)) {
                        logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
                        console.log(`Successfully loaded logo from: ${logoPath}`);
                        break;
                    }
                } catch (err) {
                    console.log(`Failed to read logo from: ${logoPath}`);
                }
            }
            
            // If we found a logo file, add it to the page
            if (logoBase64) {
                const logoDataUrl = `data:image/png;base64,${logoBase64}`;
                
                // Add the logo to the page
                await page.evaluate((logoDataUrl) => {
                    // Create a container for the logo
                    const logoContainer = document.createElement('div');
                    logoContainer.style.position = 'fixed';
                    logoContainer.style.bottom = '10px';
                    logoContainer.style.right = '10px';
                    logoContainer.style.zIndex = '9999';
                    
                    // Create an image element for the logo
                    const logoImg = document.createElement('img');
                    logoImg.src = logoDataUrl;
                    logoImg.style.width = '80px';
                    logoImg.style.height = 'auto';
                    logoImg.style.opacity = '0.9';
                    
                    // Add the image to the container and the container to the body
                    logoContainer.appendChild(logoImg);
                    document.body.appendChild(logoContainer);
                }, logoDataUrl);
                console.log("A1 logo added to PDF");
            } else {
                console.log("Warning: Could not find the A1 logo file. PDF will be generated without the logo.");
            }
        } catch (logoError) {
            console.log("Warning: Error adding logo to PDF:", logoError.message);
            console.log("Continuing PDF generation without logo");
        }

        console.log("Generating PDF...");
        await page.pdf({
            path: outfile,
            width: width_px + 'px',
            height: totalHeight + 'px', // Use calculated height instead of fixed format
            printBackground: true,
            scale: 0.9,  // Less aggressive scaling to avoid cutting content
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: {top: 10, right: 10, bottom: 10, left: 10}
        });
        console.log(`PDF generated: ${outfile}`);

        await browser.close();
        console.log("Browser closed.");

        process.send({ success: true, path: outfile });
    } catch (error) {
        console.error("Error during PDF generation:", error.message);
        process.send({ success: false, error: error.message });
        process.exit(1);
    }
})();

