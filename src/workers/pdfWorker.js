"use strict";

const { Worker } = require("bullmq");
const fastify = require("fastify");

async function createApp() {
  const app = fastify({ logger: false });
  await app.register(require("../plugins/config"));
  await app.register(require("../services/metrics"));
  await app.register(require("../services/typstEngine"));
  await app.register(require("../services/pdfGenerator"));
  await app.register(require("../services/storage"));
  await app.register(require("../services/queue"));
  await app.ready();
  return app;
}

(async () => {
  const app = await createApp();
  const connection = app.config.queue.connection;

  const worker = new Worker(
    "pdf-generation",
    async (job) => {
      const queueTime = (Date.now() - job.timestamp) / 1000;
      app.metrics.queueTime.observe(queueTime);

      await app.queueService.setJobStatus(job.id, "generating");

      const start = Date.now();
      const result = await app.pdfGeneratorService.generateFullPDF(job.data);
      const generationTime = (Date.now() - start) / 1000;
      app.metrics.generationDuration.observe(generationTime);
      const upload = await app.storageService.uploadPDF(
        result.buffer,
        result.filename
      );
      await app.queueService.setJobStatus(job.id, "generated", {
        key: upload.key,
        prefix: upload.prefix,
      });
      await app.queueService.enqueueSign({ job_id: job.id, key: upload.key });
      return upload;
    },
    { connection }
  );

  worker.on("failed", async (job, err) => {
    await app.queueService.setJobStatus(job.id, "failed", { error: err.message });
    app.metrics.errorCounter.inc();
  });

  console.log("\ud83d\udcfc PDF worker started");
})();
