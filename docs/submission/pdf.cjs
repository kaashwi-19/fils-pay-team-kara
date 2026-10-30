const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + process.argv[2], { waitUntil: 'load' });
  await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">Team KARA · FilsPay submission · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close(); })();
