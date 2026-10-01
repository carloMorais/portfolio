// The package itself is "type": "module" (for the browser/node --test, which run
// the .ts source directly), but this build output is plain CommonJS for Nest/tsc
// consumers (apps/api). A nested package.json makes Node treat dist/*.js as CJS
// regardless of the parent's "type" field.
import { writeFileSync } from "node:fs";

writeFileSync(
  new URL("../dist/package.json", import.meta.url),
  JSON.stringify({ type: "commonjs" }) + "\n",
);
