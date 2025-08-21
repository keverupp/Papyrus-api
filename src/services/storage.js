"use strict";

const fp = require("fastify-plugin");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

module.exports = fp(
  async (app) => {
    const {
      endpoint,
      region,
      bucket,
      accessKey,
      secretKey,
      publicUrl,
    } = app.config.storage;

    const s3 = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    async function uploadPDF(buffer, filename) {
      const key = filename;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: "application/pdf",
        })
      );

      return `${publicUrl}/${key}`;
    }

    app.decorate("storageService", {
      uploadPDF,
    });

    app.log.info("\ud83d\udce6 Storage service carregado");
  },
  { name: "storage-service", dependencies: ["config"] }
);
