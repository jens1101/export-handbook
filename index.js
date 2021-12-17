import puppeteer from 'puppeteer'
import { cleanupPage } from './helpers.js'
import prettier from 'prettier'
import { writeFile } from 'fs/promises'

// TODO: programmatically loop through the links on the TOC page to export each
// TODO: programmatically loop through the links on the TOC page to export each
//  chapter.
// TODO: rewrite all links to point to a section in the exported HTML document.
// TODO: the final HTML page needs to be fully self-contained. Remove scripts,
//  inline CSS, and inline images
// TODO: clean up resulting HTML: remove duplicate IDs, clean up CSS, etc.

const browser = await puppeteer.launch();
const mainPage = await browser.newPage();

const url =
  "https://www.suezwatertechnologies.com/handbook/handbook-industrial-water-treatment";

await mainPage.goto(url, {
  waitUntil: ["networkidle0", "domcontentloaded"],
});

await cleanupPage(mainPage);

const mainElement = await mainPage.$("#main");

const pageUrls = await mainPage.$$eval("#page-content a", (anchorElements) =>
  anchorElements.map((anchorElement) => anchorElement.href)
);

await mainPage.evaluate((mainElement) => {
  mainElement.style.width = "100%";
  mainElement.style.float = "none";
  mainElement.style.left = "0";
}, mainElement);

await mainPage.emulateMediaType("screen");

const html = prettier.format(await mainPage.content(), {
  parser: "html",
});

await writeFile("index.html", html);

await browser.close();
