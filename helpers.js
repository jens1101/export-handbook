import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { CSS_FILE_NAME, OUT_DIRECTORY, TITLE } from "./constants.js";
import { join } from "path";
import { readdir, rm } from "fs/promises";

export async function cleanUpOutDirectory() {
  const fileNames = await readdir(OUT_DIRECTORY);
  const filePaths = fileNames
    .filter((fileName) => fileName !== ".keep")
    .map((fileName) => join(OUT_DIRECTORY, fileName));

  for (const filePath of filePaths) {
    await rm(filePath, { recursive: true });
  }
}

export async function cleanupPage(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        `.top-bar-container,
        .skip-link,
        #breadcum,
        footer#main,
        .bottom-bar,
        .main-content > *:not(#main),
        .handbook-pagination,
        script,
        noscript,
        iframe`
      )
      .forEach((el) => el.remove());

    const mainElement = document.getElementById("main");
    mainElement.style.width = "100%";
    mainElement.style.float = "none";
    mainElement.style.left = "0";

    const handbookLinks = document.querySelector(".handbook-links");
    if (handbookLinks) {
      handbookLinks.style.display = "block";
    }

    document.documentElement.classList.remove("js", "async-hide");
  });
}

export async function inlineStyles(page) {
  const cssFileUrls = await page.$$eval(
    'link[rel="stylesheet"]',
    (linkElements) => linkElements.map((linkElement) => linkElement.href)
  );

  for (const cssFileUrl of cssFileUrls) {
    const res = await fetch(cssFileUrl);

    const fileStream = createWriteStream(join(OUT_DIRECTORY, CSS_FILE_NAME), {
      flags: "a",
    });

    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
  }

  await page.evaluate(
    (stylesheetUrl, titleText) => {
      const titleElement = document.createElement("title");
      titleElement.textContent = titleText;

      const linkElement = document.createElement("link");
      linkElement.rel = "stylesheet";
      linkElement.href = stylesheetUrl;

      document.head.replaceChildren(titleElement, linkElement);
    },
    CSS_FILE_NAME,
    TITLE
  );
}

export async function getPageContent(page) {
  return (
    await page.$$eval("#page-content-top, #content-wrapper", (elements) =>
      elements.map((element) => element.innerHTML)
    )
  ).join("\n");
}

/**
 *
 * @param page
 * @return {Promise<Map<string, {id, html}>>}
 */
export async function getPageFigures(page) {
  const figuresArray = await page.evaluate(() => {
    const anchorElements = document.querySelectorAll("a[data-open]");

    const figures = new Map();

    for (const anchorElement of anchorElements) {
      const figureId = anchorElement.dataset?.open;

      anchorElement.href = `#${figureId}`;

      if (figures.has(figureId)) {
        continue;
      }

      const modalElement = document.getElementById(figureId);

      const title = modalElement.querySelector("header > h3").textContent;
      const contentHtml =
        modalElement.querySelector(".modal-wrapper").innerHTML;

      const html = `
        <div class="view-mode-full">
          <div
            class="field-wrapper body field field-node--body field-name-body field-type-text-with-summary field-label-hidden"
          >
            <div class="field-items">
              <div class="field-item">
                <h3>${title}</h3>
                ${contentHtml}
              </div>
            </div>
          </div>
        </div>`;

      figures.set(figureId, {
        id: figureId,
        html,
      });
    }

    return Array.from(figures.entries());
  });

  return new Map(figuresArray);
}
