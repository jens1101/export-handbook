import fetch from "node-fetch";

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
        #page-content nav,
        script,
        noscript,
        iframe`
      )
      .forEach((el) => el.remove());

    const mainElement = document.getElementById("main");
    mainElement.style.width = "100%";
    mainElement.style.float = "none";
    mainElement.style.left = "0";

    document.documentElement.classList.remove("js", "async-hide");
  });
}

export async function inlineStyles(page) {
  const styles = await page.$$eval(
    'link[rel="stylesheet"]',
    async (linkElements) => {
      const styles = [];

      for (const linkElement of linkElements) {
        const response = await fetch(linkElement.href);
        const styleText = await response.text();
        styles.push(styleText);
      }

      return styles;
    }
  );

  await page.evaluate((styles) => {
    const titleElement = document.createElement("title");
    // TODO: magic constant
    titleElement.textContent = "Handbook of Industrial Water Treatment";

    const styleElements = styles.map((styleText) => {
      const styleElement = document.createElement("style");
      styleElement.textContent = styleText;
      return styleElement;
    });

    document.head.replaceChildren(titleElement, ...styleElements);
  }, styles);
}

export async function getPageFigures(page) {
  const figureMap = new Map();

  await page.$$eval("a[data-open]", async (anchorElement) => {
    const figureId = anchorElement.dataset?.open;

    anchorElement.href = `#${figureId}`;

    if (figureMap.has(figureId)) {
      return;
    }

    const modalElement = await anchorElement.$(figureId);

    const title = await modalElement.$eval(
      "header > h3",
      (h3Element) => h3Element.textContent
    );

    const src = await modalElement.$eval(
      "img",
      (imageElement) => imageElement.src
    );

    figureMap.set(figureId, {
      id: figureId,
      title,
      src,
    });
  });

  return figureMap;
}
