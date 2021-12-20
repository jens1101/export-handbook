import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const OUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "out"
);

export const CSS_FILE_NAME = "styles.css";

export const TITLE = "Handbook of Industrial Water Treatment";

export const ASSETS_DIRECTORY = join(OUT_DIRECTORY, "assets");

export const CSS_ASSETS_DIRECTORY = join(OUT_DIRECTORY, "css-assets");

export const CSS_EXTRACT_URL_REGEX =
  /url\(\s*(?!['"]?data:|['"]?\/\/)['"]?([^()]+?)['"]?\)/;
