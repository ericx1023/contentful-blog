// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Build CSP directive
const cspDirective = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://isso-server.onrender.com",
  "style-src 'self' 'unsafe-inline' https://isso-server.onrender.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  // In development, we need to allow connections to webpack HMR and other dev tools
  isDevelopment
    ? "connect-src 'self' https://cdn.contentful.com https://preview.contentful.com https://graphql.contentful.com https://images.ctfassets.net https://images.eu.ctfassets.net https://www.google-analytics.com https://www.googletagmanager.com https://isso-server.onrender.com ws: wss: http://localhost:* http://127.0.0.1:*"
    : "connect-src 'self' https://cdn.contentful.com https://preview.contentful.com https://graphql.contentful.com https://images.ctfassets.net https://images.eu.ctfassets.net https://www.google-analytics.com https://www.googletagmanager.com https://isso-server.onrender.com",
  "media-src 'self' https:",
  "frame-src 'self' https://www.youtube.com",
  "frame-ancestors 'self' https://app.contentful.com https://app.eu.contentful.com",
].join('; ');

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirective,
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
];

// Log CSP in development for debugging
if (isDevelopment) {
  console.log('🔒 CSP Configuration (Development Mode):');
  console.log(cspDirective);
}

module.exports = async () => {
  return [
    {
      // Apply these headers to all routes in your application.
      source: '/:path*',
      headers: securityHeaders,
    },
  ];
};
