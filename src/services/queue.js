"use strict";

const fp = require("fastify-plugin");
const { Queue } = require("bullmq");
const Redis = require("ioredis");

module.exports = fp(
  async (app) => {
    const connection = app.config.queue.connection;

    const pdfQueue = new Queue("pdf-generation", { connection });
    const signQueue = new Queue("pdf-sign", { connection });
    const deliverQueue = new Queue("pdf-deliver", { connection });

    async function enqueuePDF(data) {
      return await pdfQueue.add("generate", data);
    }

    async function enqueueSign(data) {
      return await signQueue.add("sign", data);
    }

    async function enqueueDeliver(data) {
      return await deliverQueue.add("deliver", data);
    }

    const statusClient = new Redis(connection);

    async function setJobStatus(jobId, status, data = {}) {
      await statusClient.set(
        `pdf:status:${jobId}`,
        JSON.stringify({ job_id: jobId, status, ...data })
      );
    }

    async function getJobStatus(jobId) {
      const result = await statusClient.get(`pdf:status:${jobId}`);
      return result ? JSON.parse(result) : null;
    }

    async function setIdempotencyResult(key, data) {
      const ttl = app.config.queue.idempotencyTTL;
      await statusClient.set(
        `pdf:idempotency:${key}`,
        JSON.stringify(data),
        "EX",
        ttl
      );
    }

    async function getIdempotencyResult(key) {
      const res = await statusClient.get(`pdf:idempotency:${key}`);
      return res ? JSON.parse(res) : null;
    }

    app.decorate("queueService", {
      pdfQueue,
      signQueue,
      deliverQueue,
      enqueuePDF,
      enqueueSign,
      enqueueDeliver,
      setJobStatus,
      getJobStatus,
      setIdempotencyResult,
      getIdempotencyResult,
    });

    app.log.info("\ud83d\udcec Queue service carregado");
  },
  { name: "queue-service", dependencies: ["config"] }
);
