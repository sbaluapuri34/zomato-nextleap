import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  fetchJsonWithRetry,
  getFirstAvailableSplit,
  fetchRows,
  ingestDataset,
} from "../src/huggingfaceDatasetConnector.mjs";

test("fetchJsonWithRetry retries transient failure", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) {
      throw new Error("Temporary network error");
    }
    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };

  const payload = await fetchJsonWithRetry("https://example.com", {
    fetchImpl,
    retries: 2,
    initialBackoffMs: 1,
  });

  assert.equal(payload.ok, true);
  assert.equal(calls, 2);
});

test("getFirstAvailableSplit returns config and split", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return { splits: [{ config: "default", split: "train" }] };
    },
  });

  const split = await getFirstAvailableSplit("owner/dataset", { fetchImpl });
  assert.deepEqual(split, { config: "default", split: "train" });
});

test("fetchRows returns row list", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        rows: [
          { row: { name: "A" } },
          { row: { name: "B" } },
        ],
      };
    },
  });

  const rows = await fetchRows("owner/dataset", {
    config: "default",
    split: "train",
    fetchImpl,
  });

  assert.equal(rows.length, 2);
});

test("ingestDataset writes raw snapshot and metadata", async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "phase1-test-"));
  const fetchImpl = async (url) => {
    if (url.includes("/splits?")) {
      return {
        ok: true,
        async json() {
          return { splits: [{ config: "default", split: "train" }] };
        },
      };
    }
    return {
      ok: true,
      async json() {
        return {
          rows: [
            { row: { name: "R1", price: "1,500", rating: "4.1/5" } },
            { row: { name: "R2", price: "2,000", rating: "4.3/5" } },
          ],
        };
      },
    };
  };

  const result = await ingestDataset({
    datasetId: "owner/dataset",
    outputDir: tempDir,
    maxRows: 2,
    fetchImpl,
  });

  assert.equal(result.status, "success");
  assert.equal(result.rowCount, 2);
  assert.equal(fs.existsSync(result.snapshotPath), true);
  assert.equal(fs.existsSync(result.metadataPath), true);

  const metadata = JSON.parse(await fsp.readFile(result.metadataPath, "utf8"));
  assert.equal(metadata.status, "success");
  assert.equal(metadata.rowCount, 2);
  assert.ok(metadata.snapshotHash);
});
