"use strict";

const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

console.log("Script grafana_pdf.js started...");

// Ensure outfile has a default value if process.argv[4] is undefined
const url = process.argv[2];
const auth_string = process.argv[3];
let outfile = process.argv[4] || "./output/default_dashboard.pdf"; // Fallback if undefined

// Ensure the output directory exists
const outputDir = path.dirname(outfile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

const width_px = parseInt(process.env.PDF_WIDTH_PX, 10) || 1200;
console.log("PDF width set to:", width_px);
const height_px = parseInt(process.env.PDF_HEIGHT_PX, 10) || 800; // Initial viewport height

const auth_header = "Basic " + Buffer.from(auth_string).toString("base64");

(async () => {
  try {
    // Validate input arguments
    if (!url || !auth_string) {
      throw new Error("URL and auth_string are required arguments.");
    }

    console.log("URL provided:", url);
    console.log("Checking URL accessibility...");
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth_header },
    });

    if (!response.ok) {
      throw new Error(`Unable to access URL. HTTP status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/html")) {
      throw new Error("The URL provided is not a valid Grafana instance.");
    }

    let finalUrl = url;
    if (process.env.FORCE_KIOSK_MODE === "true") {
      console.log("Checking if kiosk mode is enabled.");
      const urlObj = new URL(finalUrl);
      if (!urlObj.searchParams.get("kiosk")) {
        console.log("Kiosk mode not enabled. Enabling it.");
        urlObj.searchParams.set("kiosk", "true");
        finalUrl = urlObj.toString();
      }
    }

    console.log("Starting browser...");
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      ignoreHTTPSErrors: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    console.log("Browser started...");

    await page.setExtraHTTPHeaders({ Authorization: auth_header });
    await page.setDefaultNavigationTimeout(
      process.env.PUPPETEER_NAVIGATION_TIMEOUT || 120000
    );

    await page.setViewport({
      width: width_px,
      height: height_px,
      deviceScaleFactor: 2,
      isMobile: false,
    });

    console.log("Navigating to URL...");
    await page.goto(finalUrl, { waitUntil: "networkidle0" });
    console.log("Page loaded...");

    // Remove Grafana padding and apply full width
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      
      // Remove default grafana padding
      const grafanaApp = document.querySelector('.grafana-app');
      if (grafanaApp) {
        grafanaApp.style.padding = '0';
      }
      
      // Ensure all containers are full width
      const containers = document.querySelectorAll('.dashboard-container, .react-grid-layout');
      containers.forEach(container => {
        container.style.width = '100%';
        container.style.margin = '0';
        container.style.padding = '0';
      });
    });

    const panelCount = await page.evaluate(() => {
      return document.querySelectorAll(".panel-container").length;
    });
    console.log(`Detected ${panelCount} panels in the dashboard`);

    // Pre-scroll to load all content
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const scrollable =
        document.querySelector(".scrollbar-view") || document.body;
      const fullHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        scrollable.scrollHeight
      );

      for (let i = 0; i < fullHeight; i += 200) {
        scrollable.scrollTo(0, i);
        await sleep(100);
      }
      scrollable.scrollTo(0, 0);
      await sleep(500);
    });

    // Get dashboard name and generate filename
    const dashboardTitle = await page.evaluate(() => {
      const selectors = [
        'div[data-testid="dashboard-title"]',
        'h1[data-testid="page-title"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent.trim()) return el.textContent.trim();
      }
      return null;
    });

    const urlParts = new URL(url);
    const dashboardName =
      dashboardTitle ||
      decodeURIComponent(
        urlParts.pathname.split("/d/")[1]?.split("/")[1] || "dashboard"
      );
    const date = `${urlParts.searchParams.get("from") || "now"}_to_${
      urlParts.searchParams.get("to") || "now"
    }`.replace(/[^\w-]/g, "_");

    // Reassign outfile with a proper path
    outfile = path.join(
      outputDir,
      `${dashboardName.replace(/[^\w-]/g, "_").toLowerCase()}_${date}.pdf`
    );
    console.log("Output file path:", outfile);
    
    // Calculate exact content dimensions based on dashboard content
    const dimensions = await page.evaluate(() => {
      // Get dashboard container or fall back to body
      const dashboard = document.querySelector(".react-grid-layout") || 
                        document.querySelector(".dashboard-container") || 
                        document.querySelector(".dashboard");
      
      if (!dashboard) {
        console.log("Dashboard container not found, using document body");
        return {
          width: document.body.scrollWidth,
          height: document.body.scrollHeight
        };
      }
      
      const panels = document.querySelectorAll(".panel-container");
      console.log(`Found ${panels.length} panels to calculate dimensions`);
      
      if (panels.length === 0) {
        console.log("No panels found, using document dimensions");
        return {
          width: document.body.scrollWidth,
          height: Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
          )
        };
      }

      // Find the furthest bottom edge of all panels
      let maxBottom = 0;
      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        const bottom = rect.bottom + window.scrollY;
        maxBottom = Math.max(maxBottom, bottom);
        console.log(`Panel at bottom: ${bottom}px`);
      });

      const bottomPadding = 50; // Extra space at bottom
      
      // Calculate final height to include all content
      const finalHeight = maxBottom + bottomPadding + '50px';
      
      // Get window width to ensure no horizontal cuts
      const windowWidth = window.innerWidth;
      
      console.log(`Calculated dimensions - Width: ${windowWidth}px, Height: ${finalHeight}px`);
      
      return {
        width: windowWidth,
        height: finalHeight
      };
    });

    console.log("Calculated dimensions:", dimensions);
    
    // Set viewport to match content dimensions
    await page.setViewport({
      width: Math.round(dimensions.width),
      height: Math.round(dimensions.height),
      deviceScaleFactor: 2,
      isMobile: false,
    });

    // Perform a final scroll through to ensure all content is rendered
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const scrollable = document.querySelector(".scrollbar-view") || document.body;
      
      // Scroll to bottom to ensure all content is loaded
      scrollable.scrollTo(0, scrollable.scrollHeight);
      await sleep(1000);
      
      // Scroll back to top
      scrollable.scrollTo(0, 0);
      await sleep(500);
    });
    
    // Add header
    const logoPath = path.join(
      __dirname,
      "..",
      "public",
      "images",
      "Reporting_A1_logo.png"
    );
    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });

    await page.evaluate(
      (logoBase64, url, dashboardName) => {
        const hideSelectors = [
          ".css-1r4g60",
          ".css-wmojnn",
          ".css-8qah51",
          ".css-1bavtc9",
          ".navbar",
          ".sidemenu",
          ".dashboard-settings",
          ".submenu-controls",
          ".gf-form-inline",
          ".alert-rule-item__icon",
          ".page-toolbar",
          ".footer",
        ];

        hideSelectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => {
            el.style.display = "none";
          });
        });

        const header = document.createElement("div");
        header.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 60px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 30px 30px 0 30px;
                z-index: 1000;
                box-sizing: border-box;
            `;

        // Create container for dashboard title and date
        const infoContainer = document.createElement("div");
        infoContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            `;

        // Add dashboard title
        const titleDiv = document.createElement("div");
        titleDiv.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                color: #333333;
            `;
        titleDiv.textContent = dashboardName;

        const dateDiv = document.createElement("div");
        dateDiv.style.cssText = `
                font-size: 20px;
                font-weight: 500;
                color: #464646;
            `;

        // Improved date handling
        const urlParams = new URL(url).searchParams;
        let from = urlParams.get("from");
        let to = urlParams.get("to");
        let dateText = "";

        const parseGrafanaTime = (timeStr) => {
          if (!timeStr) return new Date();
          if (timeStr === "now") return new Date();
          if (timeStr.startsWith("now-")) {
            const match = timeStr.match(/now-(\d+)([smhdwMy])/);
            if (match) {
              const value = parseInt(match[1], 10);
              const unit = match[2];
              const now = new Date();
              if (unit === "s") now.setSeconds(now.getSeconds() - value);
              if (unit === "m") now.setMinutes(now.getMinutes() - value);
              if (unit === "h") now.setHours(now.getHours() - value);
              if (unit === "d") now.setDate(now.getDate() - value);
              if (unit === "w") now.setDate(now.getDate() - value * 7);
              if (unit === "M") now.setMonth(now.getMonth() - value);
              if (unit === "y") now.setFullYear(now.getFullYear() - value);
              return now;
            }
          }
          const timestamp = parseInt(timeStr, 10);
          return isNaN(timestamp) ? new Date() : new Date(timestamp);
        };

        if (from && to) {
          const fromDate = parseGrafanaTime(from);
          const toDate = parseGrafanaTime(to);
          
          // Use Macedonia locale (mk-MK) with Europe/Skopje timezone
          const dateOptions = {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Skopje"
          };
          
          dateText = `${fromDate.toLocaleString("en-US", dateOptions)} to ${toDate.toLocaleString("en-US", dateOptions)}`;
        } else {
          // Use Macedonia locale (mk-MK) with Europe/Skopje timezone for current date
          dateText = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Skopje"
          });
        }

        dateDiv.textContent = dateText;

        // Add title and date to the info container
        infoContainer.appendChild(titleDiv);
        infoContainer.appendChild(dateDiv);

        const logo = document.createElement("img");
        logo.src = `data:image/png;base64,${logoBase64}`;
        logo.style.cssText = `
                max-width: 120px;
                max-height: 60px;
            `;

        header.appendChild(infoContainer);
        header.appendChild(logo);
        document.body.prepend(header);

        const style = document.createElement("style");
        style.textContent = `
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding-top: 50px !important;
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow-x: hidden !important;
                    }
                    * {
                        box-sizing: border-box !important;
                    }
                    .panel-container {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .dashboard-container, .grafana-app, .main-view, .scroll-canvas {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow-x: hidden !important;
                    }
                    .header {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        height: 50px !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .react-grid-layout {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .react-grid-item {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
                html, body {
                    margin: 0 !important;
                    padding: 50px 0 0 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: hidden !important;
                }
                * {
                    box-sizing: border-box !important;
                }
            `;
        document.head.appendChild(style);
        
        // Optimize layout for PDF
        document.documentElement.style.width = "100%";
        document.documentElement.style.margin = "0";
        document.documentElement.style.padding = "0";
        document.documentElement.style.overflow = "hidden";
        
        document.body.style.width = "100%";
        document.body.style.margin = "0";
        document.body.style.padding = "50px 0 0 0";
        document.body.style.overflow = "visible";
        document.body.style.overflowX = "hidden";

        const pageStyle = document.createElement("style");
        pageStyle.textContent = `
          @page {
            size: ${document.body.scrollWidth}px ${document.body.scrollHeight}px;
            margin: 0;
            padding: 0;
          }
        `;
        document.head.appendChild(pageStyle);

        // Target all possible containers
        const containers = document.querySelectorAll(".dashboard-container, .grafana-app, .main-view, .scroll-canvas, .view");
        containers.forEach(container => {
          if (container) {
            container.style.width = "100%";
            container.style.maxWidth = "100%";
            container.style.padding = "0";
            container.style.margin = "0";
            container.style.boxSizing = "border-box";
            container.style.overflowX = "hidden";
          }
        });

        const dashboard = document.querySelector(".dashboard-container");
        if (dashboard) {
          dashboard.style.width = "100%";
          dashboard.style.padding = "0";
          dashboard.style.margin = "0";
          dashboard.style.boxSizing = "border-box";
          dashboard.style.position = "relative";
          dashboard.style.overflowX = "hidden";
        }

        const panels = document.querySelectorAll(".panel-container");
        panels.forEach((panel) => {
          panel.style.width = "100%";
          panel.style.maxWidth = "100%";
          panel.style.margin = "0";
          panel.style.padding = "0";
          panel.style.boxSizing = "border-box";

          const content = panel.querySelector(".panel-content");
          if (content) {
            content.style.width = "100%";
            content.style.height = "auto";
            content.style.padding = "0";
            content.style.margin = "0";
          }
          
          // Ensure all visualizations and charts are full width
          const visualizations = panel.querySelectorAll(".panel-visualization, .panel-content > div, svg, canvas");
          visualizations.forEach(viz => {
            viz.style.width = "100%";
            viz.style.maxWidth = "100%";
            viz.style.padding = "0";
            viz.style.margin = "0";
          });
        });
        
        // Remove any grid layout margins
        const gridLayout = document.querySelector(".react-grid-layout");
        if (gridLayout) {
          gridLayout.style.width = "100%";
          gridLayout.style.margin = "0";
          gridLayout.style.padding = "0";
        }
        
        // Target grid items to ensure no margins
        const gridItems = document.querySelectorAll(".react-grid-item");
        gridItems.forEach(item => {
          item.style.margin = "0";
          item.style.padding = "0";
        });
      },
      logoBase64,
      url,
      dashboardName
    );

    console.log("Generating PDF...");
    await page.pdf({
      path: outfile,
      width: `${Math.round(dimensions.width)}px`,
      height: `${Math.round(dimensions.height)}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      scale: 1.0,
      pageRanges: '1',  // Ensure only one page is generated
    });
    console.log(`PDF generated: ${outfile}`);

    await browser.close();
    console.log("Browser closed.");

    // Ensure outfile is a string before sending
    if (typeof outfile !== "string") {
      throw new Error("Output file path is not a string.");
    }
    process.send({ success: true, path: outfile });
  } catch (error) {
    console.error("Error during PDF generation:", error.message);
    process.send({ success: false, error: error.message });
    process.exit(1);
  }
})();
