import cors, { CorsOptions } from 'cors';

// Allow a comma-separated list of origins via environment variable.  This
// gives flexibility for staging, production, etc., where multiple frontends
// might need access.  Defaults to the single localhost entry used during
// development.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // `origin` will be undefined in same-origin requests (e.g. curl or
    // server-to-server), so allow those through.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);

// also export the options object in case individual routes want to set
// different behaviour (e.g. open endpoints).
export { corsOptions };
