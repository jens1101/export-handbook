import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const OUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "out"
);

export const CSS_FILE_NAME = "styles.css";

export const TITLE = "Handbook of Industrial Water Treatment";
