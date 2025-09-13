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
    "pdf-sign",
    async (job) => {
      const { job_id, key } = job.data;
      await app.queueService.setJobStatus(job_id, "signing", { key });
      const signed = await app.storageService.copyPDF(key);
      await app.queueService.setJobStatus(job_id, "signed", {
        key: signed.key,
        prefix: signed.prefix,
      });
      await app.queueService.enqueueDeliver({ job_id, key: signed.key });
      return signed;
    },
    { connection }
  );

  worker.on("failed", async (job, err) => {
    await app.queueService.setJobStatus(job.data.job_id, "failed", {
      error: err.message,
    });
  });

  console.log("\u270D\uFE0F Sign worker started");
})();
