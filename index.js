import puppeteer from "puppeteer";

const browser = await puppeteer.launch();

const page = await browser.newPage();

// TODO: figures don't load. They are a JS feature, so we will need to click on each figure, wait
//  for the modal to load, and then extract it.
// TODO: programmatically loop through the links on the TOC page to export each chapter.
// TODO: rewrite all links to point to a section in the exported HTML document.

// const url = 'https://www.suezwatertechnologies.com/handbook/handbook-industrial-water-treatment';
const url =
  "https://www.suezwatertechnologies.com/handbook/chapter-01-water-sources-impurities-and-chemistry";

await page.goto(url, {
  waitUntil: "networkidle0",
});

await page.evaluate(() => {
  document
    .querySelectorAll(
      `.top-bar-container,
      #breadcum,
      footer#main,
      .bottom-bar,
      .main-content > *:not(#main),
      .handbook-pagination`
    )
    .forEach((el) => el.remove());

  const main = document.querySelector("#main");
  main.style.width = "100%";
  main.style.float = "none";
  main.style.left = "0";

  const figureIds = [];

  document.querySelectorAll(`a[data-open]`).forEach((anchorElement) => {
    const figureId = anchorElement.dataset?.open;

    if (figureIds.includes(figureId)) {
      anchorElement.href = `#${figureId}`;
      return;
    }

    const modalElement = document.getElementById(figureId);

    if (!figureIds.includes(figureId)) {
      figureIds.push(figureId);
      anchorElement.href = `#${figureId}`;

      const container = document.createElement("div");
      container.id = figureId;

      const title = document.createElement("h3");
      title.textContent = modalElement.querySelector("header > h3").textContent;

      const image = new Image();
      image.src = modalElement.querySelector("img").src;

      container.append(title, image);

      main.append(container);
    }
  });
});

await page.emulateMediaType("screen");

await page.pdf({
  printBackground: true,
  path: "webpage.pdf",
  format: "A4",
  margin: {
    top: "20px",
    bottom: "40px",
    left: "20px",
    right: "20px",
  },
});

// const html = prettier.format(await page.content(), {
//   parser: "html",
// });
//
// await writeFile("index.html", html);

await browser.close();
