import { startInstagramSyncWorker } from "./instagramSyncWorker";

const worker = startInstagramSyncWorker();

if (!worker) {
  process.exit(1);
}
