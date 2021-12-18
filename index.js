import puppeteer from "puppeteer";
import {
  cleanUpOutDirectory,
  cleanupPage,
  getPageContent,
  getPageFigures,
  localiseAnchors,
  localiseImages,
  localiseStyleSheets,
} from "./helpers.js";
import prettier from "prettier";
import { writeFile } from "fs/promises";
import { join } from "path";
import { OUT_DIRECTORY } from "./constants.js";

// TODO: fetch remote resources, place them in the "out" folder, and update all
//  references to them
// TODO: clean up resulting HTML: remove duplicate IDs, clean up CSS, etc.

await cleanUpOutDirectory();

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
await localiseStyleSheets(mainPage);

const anchorElements = await mainPage.$$("#page-content a");
const anchorMap = new Map();

for (const anchorElement of anchorElements) {
  anchorMap.set(
    anchorElement,
    await mainPage.evaluate(
      (anchorElement) => ({
        pageUrl: anchorElement.href,
        title: anchorElement.innerText,
        pageId: encodeURIComponent(anchorElement.innerText),
      }),
      anchorElement
    )
  );
}

const pagesMap = new Map();
const figures = new Map();

for (const { pageUrl, pageId } of anchorMap.values()) {
  const page = await browser.newPage();

  await page.goto(pageUrl, {
    waitUntil: ["networkidle0", "domcontentloaded"],
  });

  await cleanupPage(page);
  const pageFigures = await getPageFigures(page);

  for (const [key, value] of pageFigures.entries()) {
    !figures.has(key) && figures.set(key, value);
  }

  pagesMap.set(pageId, await getPageContent(page));
}

await mainPage.evaluate(
  (pagesMap, figures) => {
    const chaptersAndFiguresFragment = document.createDocumentFragment();

    for (const [pageId, pageHtml] of pagesMap) {
      // TODO: add page break after each chapter
      const pageContainer = document.createElement("div");
      pageContainer.id = pageId;
      pageContainer.insertAdjacentHTML("beforeend", pageHtml);
      chaptersAndFiguresFragment.appendChild(pageContainer);
    }

    const figuresContainer = document.createElement("div");

    figuresContainer.insertAdjacentHTML(
      "beforeend",
      `<section id="page-content-top">
        <div class="row">
          <div class="large-12 columns">
            <div>
              <section
                id="block-ge-water-page-title"
                class="block-ge-water-page-title block block-core block-page-title-block"
              >
                <h1><span class="field-wrapper">Appendix 1: Figures</span></h1>
              </section>
            </div>
          </div>
        </div>
      </section>
      <div id="content-wrapper">
        <div class="row main-content">
          <main
            id="main"
            class="large-9 large-push-3 columns"
            role="main"
            style="width: 100%; float: none; left: 0px"
          >
            <section id="page-content">
              <div>
                <section
                  id="block-ge-water-content"
                  class="block-ge-water-content block block-system block-system-main-block"
                >
                  <article
                    id="node-1250"
                    role="article"
                    about="/handbook/introduction"
                  >
                    <!-- Figure content here -->
                  </article>
                </section>
              </div>
            </section>
          </main>
        </div>
      </div>`
    );

    const figuresFragment = document.createDocumentFragment();

    for (const { id, html } of figures) {
      const container = document.createElement("div");
      container.id = id;
      container.insertAdjacentHTML("beforeend", html);

      figuresFragment.appendChild(container);
    }

    figuresContainer.querySelector("article").replaceChildren(figuresFragment);
    chaptersAndFiguresFragment.appendChild(figuresContainer);

    document.body.appendChild(chaptersAndFiguresFragment);
  },
  Array.from(pagesMap),
  Array.from(figures.values())
);

await localiseImages(mainPage);

await localiseAnchors(
  mainPage,
  new Map(
    Array.from(anchorMap.values()).map((value) => [
      value.pageUrl,
      `#${value.pageId}`,
    ])
  )
);

const html = prettier.format(await mainPage.content(), {
  parser: "html",
});

await writeFile(join(OUT_DIRECTORY, "index.html"), html);

await browser.close();
