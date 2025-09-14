"use strict";

const fp = require("fastify-plugin");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

module.exports = fp(
  async (app) => {
    const {
      endpoint,
      region,
      bucket,
      accessKey,
      secretKey,
      publicUrl,
      prefixes = 10,
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
      const hash = crypto
        .createHash("sha256")
        .update(filename)
        .digest("hex");
      const prefix = parseInt(hash.slice(0, 8), 16) % prefixes;
      const key = `${prefix}/${filename}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: "application/pdf",
        })
      );

      return { key, prefix, url: `${publicUrl}/${key}` };
    }

    async function getSignedPDFUrl(key, expiresIn = 3600) {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn }
      );
    }

    async function copyPDF(sourceKey) {
      const [prefix, ...rest] = sourceKey.split("/");
      const filename = rest.join("/");
      const destKey = `${prefix}/signed-${filename}`;
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${sourceKey}`,
          Key: destKey,
          ContentType: "application/pdf",
        })
      );
      return { key: destKey, prefix, url: `${publicUrl}/${destKey}` };
    }

    app.decorate("storageService", {
      uploadPDF,
      getSignedPDFUrl,
       copyPDF,
    });

    app.log.info("\ud83d\udce6 Storage service carregado");
  },
  { name: "storage-service", dependencies: ["config"] }
);
