import { apiRoutes, type FileSpec } from '@mestechko/contracts';
import type { FastifyInstance } from 'fastify';

const uploads: FileSpec[] = Object.values(apiRoutes).flatMap((route) =>
  'upload' in route ? [route.upload] : [],
);

/**
 * Files of the routes that take uploads arrive as raw bytes, within the largest
 * upload's limit. JSON and plain HTML forms are parsed by the framework.
 */
export function registerBodyParsers(fastify: FastifyInstance): void {
  const mediaTypes = [...new Set(uploads.flatMap((upload) => upload.mediaTypes))];
  if (mediaTypes.length === 0) {
    return;
  }
  fastify.addContentTypeParser(
    mediaTypes,
    { parseAs: 'buffer', bodyLimit: Math.max(...uploads.map((upload) => upload.maxBytes)) },
    (_request, body, done) => {
      done(null, body);
    },
  );
}
