import puppeteer from "puppeteer";
import { cleanupPage, getPageFigures, inlineStyles } from "./helpers.js";
import prettier from "prettier";
import { writeFile } from "fs/promises";

// TODO: rewrite all links to point to a section in the exported HTML document.
// TODO: fetch remote resources, place them in the "out" folder, and update all
//  references to them
// TODO: clean up resulting HTML: remove duplicate IDs, clean up CSS, etc.

const browser = await puppeteer.launch();
const mainPage = await browser.newPage();

await mainPage.goto(
  "https://www.suezwatertechnologies.com/handbook/handbook-industrial-water-treatment",
  {
    waitUntil: ["networkidle0", "domcontentloaded"],
  }
);

await cleanupPage(mainPage);
await mainPage.$eval("#page-content nav", (navElement) => navElement.remove());
await inlineStyles(mainPage);

const pageUrls = await mainPage.$$eval("#page-content a", (anchorElements) =>
  anchorElements.map((anchorElement) => anchorElement.href)
);

const pagesHtml = [];
const figures = new Map();

for (const pageUrl of pageUrls) {
  const page = await browser.newPage();

  await page.goto(pageUrl, {
    waitUntil: ["networkidle0", "domcontentloaded"],
  });

  await cleanupPage(page);
  const pageFigures = await getPageFigures(page);

  for (const [key, value] of pageFigures.entries()) {
    !figures.has(key) && figures.set(key, value);
  }

  pagesHtml.push(
    await page.$$eval("#page-content-top, #content-wrapper", (elements) =>
      elements.map((element) => element.outerHTML).join("\n")
    )
  );
}

await mainPage.evaluate(
  (pagesHtml, figures) => {
    const fragment = document.createDocumentFragment();

    for (const pageHtml of pagesHtml) {
      // TODO: add page break after each chapter
      const pageContainer = document.createElement("div");
      pageContainer.insertAdjacentHTML("beforeend", pageHtml);
      fragment.appendChild(pageContainer);
    }

    const figuresContainer = document.createElement("div");

    for (const { id, html } of figures) {
      const container = document.createElement("div");
      container.id = id;
      container.insertAdjacentHTML("beforeend", html);

      figuresContainer.appendChild(container);
    }

    fragment.appendChild(figuresContainer);

    document.body.appendChild(fragment);
  },
  pagesHtml,
  Array.from(figures.values())
);

const html = prettier.format(await mainPage.content(), {
  parser: "html",
});

await writeFile("out/index.html", html);

await browser.close();
