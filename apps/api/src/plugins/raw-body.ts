import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

/**
 * Captures the raw request body as a Buffer on `request.rawBody` and parses
 * it as JSON into `request.body` as usual. This preserves the exact bytes
 * the PSP signed so signature verification (HMAC SHA-256) passes.
 *
 * Only applied to routes configured in `routes` — the default JSON parser
 * stays in place everywhere else.
 */
export interface RawBodyPluginOptions {
  /** Route signatures (`METHOD /path`) that should capture raw bodies. */
  routes: ReadonlySet<string>;
}

const plugin: FastifyPluginAsync<RawBodyPluginOptions> = async (app, opts) => {
  const want = (req: FastifyRequest): boolean => {
    const routeUrl = req.routeOptions.url ?? req.url;
    return opts.routes.has(`${req.method} ${routeUrl}`);
  };

  // Replace the json parser for qualifying routes with one that stores the
  // raw buffer alongside the parsed body. Fastify's default parser is kept
  // for every other route.
  app.removeContentTypeParser(['application/json']);
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      if (want(req)) {
        req.rawBody = buffer;
      }
      if (buffer.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        const json = JSON.parse(buffer.toString('utf8')) as unknown;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
};

export const rawBodyPlugin = fp(plugin, {
  name: 'claudeshop-raw-body',
  fastify: '5.x',
});
