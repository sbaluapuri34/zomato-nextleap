import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const HF_DATASETS_SERVER = "https://datasets-server.huggingface.co";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJsonWithRetry(
  url,
  {
    fetchImpl = fetch,
    retries = 3,
    initialBackoffMs = 500,
    headers = {},
    timeoutMs = 15000,
  } = {}
) {
  let attempt = 0;
  let backoff = initialBackoffMs;
  let lastError;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while calling ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(backoff);
      backoff *= 2;
      attempt += 1;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export async function getFirstAvailableSplit(
  datasetId,
  { fetchImpl = fetch, retries = 3 } = {}
) {
  const url = `${HF_DATASETS_SERVER}/splits?dataset=${encodeURIComponent(datasetId)}`;
  const payload = await fetchJsonWithRetry(url, { fetchImpl, retries });
  const splits = payload?.splits ?? [];
  if (!splits.length) {
    throw new Error(`No splits found for dataset: ${datasetId}`);
  }
  const [first] = splits;
  if (!first.config || !first.split) {
    throw new Error(`Invalid split payload for dataset: ${datasetId}`);
  }
  return { config: first.config, split: first.split };
}

export async function fetchRows(
  datasetId,
  {
    config,
    split,
    offset = 0,
    length = 100,
    fetchImpl = fetch,
    retries = 3,
  } = {}
) {
  const url =
    `${HF_DATASETS_SERVER}/rows?dataset=${encodeURIComponent(datasetId)}` +
    `&config=${encodeURIComponent(config)}` +
    `&split=${encodeURIComponent(split)}` +
    `&offset=${encodeURIComponent(offset)}` +
    `&length=${encodeURIComponent(length)}`;

  const payload = await fetchJsonWithRetry(url, { fetchImpl, retries });
  return payload?.rows ?? [];
}

export async function ingestDataset({
  datasetId,
  outputDir,
  maxRows = 200,
  retries = 3,
  fetchImpl = fetch,
}) {
  if (!datasetId) {
    throw new Error("datasetId is required");
  }
  if (!outputDir) {
    throw new Error("outputDir is required");
  }

  const startedAt = new Date().toISOString();
  const runId = `phase1-${Date.now()}`;
  const source = "huggingface";
  let status = "success";
  let snapshotPath = "";
  let metadataPath = "";

  try {
    const { config, split } = await getFirstAvailableSplit(datasetId, {
      fetchImpl,
      retries,
    });
    const rows = [];
    const batchSize = 100;
    let currentOffset = 0;

    while (rows.length < maxRows) {
      const remaining = maxRows - rows.length;
      const lengthToFetch = Math.min(batchSize, remaining);

      const batch = await fetchRows(datasetId, {
        config,
        split,
        offset: currentOffset,
        length: lengthToFetch,
        fetchImpl,
        retries,
      });

      if (!batch || batch.length === 0) {
        break;
      }

      rows.push(...batch);
      currentOffset += batch.length;

      // If we got fewer rows than requested, it means we reached the end of the dataset
      if (batch.length < lengthToFetch) {
        break;
      }
    }

    const rawPayload = {
      datasetId,
      source,
      config,
      split,
      fetchedAt: new Date().toISOString(),
      rowCount: rows.length,
      rows,
    };

    const snapshotHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(rawPayload))
      .digest("hex");

    await fs.mkdir(outputDir, { recursive: true });
    snapshotPath = path.join(outputDir, `${runId}-raw-snapshot.json`);
    metadataPath = path.join(outputDir, `${runId}-ingestion-metadata.json`);

    const metadata = {
      runId,
      datasetId,
      source,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      rowCount: rows.length,
      config,
      split,
      snapshotHash,
      snapshotPath,
    };

    await fs.writeFile(snapshotPath, JSON.stringify(rawPayload, null, 2), "utf8");
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

    return {
      status,
      runId,
      rowCount: rows.length,
      snapshotPath,
      metadataPath,
      config,
      split,
    };
  } catch (error) {
    status = "failed";
    await fs.mkdir(outputDir, { recursive: true });
    metadataPath = path.join(outputDir, `${runId}-ingestion-metadata.json`);
    const metadata = {
      runId,
      datasetId,
      source,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      snapshotPath,
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    throw error;
  }
}
