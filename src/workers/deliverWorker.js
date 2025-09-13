"use strict";

const { Worker } = require("bullmq");
const fastify = require("fastify");

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(require("../plugins/config"));
  await app.register(require("../services/storage"));
  await app.register(require("../services/queue"));
  await app.ready();
  return app;
}

(async () => {
  const app = await createApp();
  const connection = app.config.queue.connection;

  const worker = new Worker(
    "pdf-deliver",
    async (job) => {
      const { job_id, key } = job.data;
      await app.queueService.setJobStatus(job_id, "delivering", { key });
      const url = await app.storageService.getSignedPDFUrl(key);
      const prefix = key.split("/")[0];
      await app.queueService.setJobStatus(job_id, "completed", {
        key,
        prefix,
        url,
      });
      return { key, prefix, url };
    },
    { connection }
  );

  worker.on("failed", async (job, err) => {
    await app.queueService.setJobStatus(job.data.job_id, "failed", {
      error: err.message,
    });
  });

  console.log("\ud83d\ude9a Deliver worker started");
})();
