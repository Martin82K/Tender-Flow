#!/usr/bin/env node
import { mergeExcelSheetsToFile } from "./lib";

const usage = () => {
  // eslint-disable-next-line no-console
  console.log(
    [
      "Usage:",
      "  node dist/cli.js <input.xlsx> [output.xlsx]",
      "",
      "Examples:",
      "  node dist/cli.js ./vstup.xlsx",
      "  node dist/cli.js ./vstup.xlsx ./vystup.xlsx",
    ].join("\n"),
  );
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(args.length ? 0 : 1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  const { outputPath: out } = await mergeExcelSheetsToFile({
    inputPath,
    outputPath,
  });
  // eslint-disable-next-line no-console
  console.log(`Output: ${out}`);
};

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

