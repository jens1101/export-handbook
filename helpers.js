export const cleanupPage = async (page) => {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        `.top-bar-container,
        #breadcum,
        footer#main,
        .bottom-bar,
        .main-content > *:not(#main),
        #page-content nav`
      )
      .forEach((el) => el.remove());
  });
};

/**
 * @param {Page} page
 * @return {Promise<Map<string, {id: string, title: string, src: string}>>}
 */
export const getPageFigures = async (page) => {
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
};
