"use strict";

const fp = require("fastify-plugin");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

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

    async function getPDFStream(key) {
      if (!key) {
        throw new Error("Storage key is required");
      }

      try {
        const response = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        if (!response?.Body) {
          const emptyStreamError = new Error("PDF stream not available");
          emptyStreamError.code = "PDF_STREAM_EMPTY";
          throw emptyStreamError;
        }

        return {
          stream: response.Body,
          contentType: response.ContentType || "application/pdf",
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          etag: response.ETag,
          key,
        };
      } catch (error) {
        if (
          error?.name === "NoSuchKey" ||
          error?.$metadata?.httpStatusCode === 404
        ) {
          const notFoundError = new Error("PDF not found");
          notFoundError.code = "PDF_NOT_FOUND";
          throw notFoundError;
        }

        throw error;
      }
    }

    app.decorate("storageService", {
      uploadPDF,
      getPDFStream,
    });

    app.log.info("\ud83d\udce6 Storage service carregado");
  },
  { name: "storage-service", dependencies: ["config"] }
);
