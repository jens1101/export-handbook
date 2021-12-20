import fetch from "node-fetch";
import { createWriteStream } from "fs";
import {
  ASSETS_DIRECTORY,
  CSS_ASSETS_DIRECTORY,
  CSS_EXTRACT_URL_REGEX,
  CSS_FILE_NAME,
  OUT_DIRECTORY,
  TITLE,
} from "./constants.js";
import { join, parse, relative } from "path";
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { createHash } from "crypto";

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

export async function localiseStyleSheets(page) {
  await mkdir(CSS_ASSETS_DIRECTORY, { recursive: true });

  const cssFileUrls = await page.$$eval(
    'link[rel="stylesheet"]',
    (linkElements) => linkElements.map((linkElement) => linkElement.href)
  );

  const urlMap = new Map();

  for (const cssFileUrl of cssFileUrls) {
    const response = await fetch(cssFileUrl);
    let cssText = await response.text();

    let currentMatch;
    const allMatches = [];
    const regex = new RegExp(CSS_EXTRACT_URL_REGEX, "dgm");

    while (regex.global && (currentMatch = regex.exec(cssText))) {
      const oldUrl = currentMatch[1];
      const indices = currentMatch.indices[1];

      if (!urlMap.has(oldUrl)) {
        const absoluteUrl = await page.evaluate(
          (url) => new URL(url, location.href).href,
          oldUrl
        );

        const newUrl = relative(
          OUT_DIRECTORY,
          await downloadFile(absoluteUrl, {
            directory: CSS_ASSETS_DIRECTORY,
          })
        );

        urlMap.set(oldUrl, newUrl);
      }

      allMatches.unshift({
        oldUrl,
        newUrl: urlMap.get(oldUrl),
        indices,
      });
    }

    for (const {
      newUrl,
      indices: [startIndex, endIndex],
    } of allMatches) {
      cssText = cssText.slice(0, startIndex) + newUrl + cssText.slice(endIndex);
    }

    await writeFile(join(OUT_DIRECTORY, CSS_FILE_NAME), cssText, { flag: "a" });
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

export async function localiseImages(page) {
  const imageElements = await page.$$("img");
  const imageMap = new Map();

  for (const imageElement of imageElements) {
    imageMap.set(
      imageElement,
      await page.evaluate((imageElement) => imageElement.src, imageElement)
    );
  }

  await mkdir(ASSETS_DIRECTORY, { recursive: true });

  for (const [imageElement, imageUrl] of imageMap) {
    const imagePath = relative(
      OUT_DIRECTORY,
      await downloadFile(imageUrl, {
        directory: ASSETS_DIRECTORY,
      })
    );

    await page.evaluate(
      (imageElement, imagePath) => {
        imageElement.src = imagePath;
      },
      imageElement,
      imagePath
    );
  }
}

export async function localiseAnchors(page, urlMap) {
  await page.$$eval(
    "a",
    (anchorElements, urlMap) => {
      urlMap = new Map(urlMap);

      for (const anchorElement of anchorElements) {
        if (urlMap.has(anchorElement.href)) {
          anchorElement.href = urlMap.get(anchorElement.href);
        }
      }
    },
    Array.from(urlMap)
  );
}

export async function getPageContent(page) {
  return await page.$$eval("#page-content-top, #content-wrapper", (elements) =>
    elements.map((element) => element.outerHTML).join("\n")
  );
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

async function downloadFile(
  url,
  { directory = OUT_DIRECTORY, fileName, writeStreamOptions } = {}
) {
  fileName =
    fileName ??
    "" +
      createHash("md5").update(url).digest("hex") +
      parse(new URL(url).pathname).ext;

  const response = await fetch(url);

  const targetPath = join(directory, fileName);
  const fileStream = createWriteStream(targetPath, writeStreamOptions);

  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on("error", reject);
    fileStream.on("finish", resolve);
  });

  return targetPath;
}
