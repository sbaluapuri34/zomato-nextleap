import path from "node:path";
import { ingestDataset } from "../src/huggingfaceDatasetConnector.mjs";

const datasetId =
  process.env.HF_DATASET_ID || "ManikaSaini/zomato-restaurant-recommendation";
const outputDir =
  process.env.PHASE1_OUTPUT_DIR || path.resolve("phase1", "artifacts", "ingestion-runs");
const maxRows = Number.parseInt(process.env.PHASE1_MAX_ROWS || "5000", 10);

async function main() {
  const result = await ingestDataset({
    datasetId,
    outputDir,
    maxRows,
    retries: 3,
  });
  console.log("Phase 1 ingestion succeeded");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Phase 1 ingestion failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
