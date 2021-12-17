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

      modalElement.querySelector("header > button").remove();

      figures.set(figureId, {
        id: figureId,
        html: modalElement.innerHTML,
      });
    }

    return Array.from(figures.entries());
  });

  return new Map(figuresArray);
}
