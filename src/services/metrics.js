"use strict";

const fp = require("fastify-plugin");
const client = require("prom-client");

module.exports = fp(async (app) => {
  const queueTime = new client.Histogram({
    name: "pdf_queue_time_seconds",
    help: "Time spent in queue before processing",
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });

  const generationDuration = new client.Histogram({
    name: "pdf_generation_duration_seconds",
    help: "Time taken to generate PDFs",
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });

  const errorCounter = new client.Counter({
    name: "pdf_generation_errors_total",
    help: "Total number of PDF generation errors",
  });

  app.decorate("metrics", {
    queueTime,
    generationDuration,
    errorCounter,
    register: client.register,
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", client.register.contentType);
    return client.register.metrics();
  });

  app.log.info("\ud83d\udcc8 Metrics service loaded");
});
