import { Analytics } from '@vercel/analytics/react';
import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  // Build CSP for meta tag (development-friendly)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cspContent = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://isso-server.onrender.com",
    "style-src 'self' 'unsafe-inline' https://isso-server.onrender.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    isDevelopment
      ? "connect-src 'self' https://cdn.contentful.com https://preview.contentful.com https://graphql.contentful.com https://images.ctfassets.net https://images.eu.ctfassets.net https://www.google-analytics.com https://www.googletagmanager.com https://isso-server.onrender.com ws: wss: http://localhost:* http://127.0.0.1:*"
      : "connect-src 'self' https://cdn.contentful.com https://preview.contentful.com https://graphql.contentful.com https://images.ctfassets.net https://images.eu.ctfassets.net https://www.google-analytics.com https://www.googletagmanager.com https://isso-server.onrender.com",
    "media-src 'self' https:",
    "frame-src 'self' https://www.youtube.com",
    "frame-ancestors 'self' https://app.contentful.com https://app.eu.contentful.com",
  ].join('; ');

  return (
    <Html lang="en" className="dark">
      <Head>
        {/* CSP Meta Tag for Development */}
        {isDevelopment && <meta httpEquiv="Content-Security-Policy" content={cspContent} />}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  var resolvedTheme = theme === 'system' 
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(resolvedTheme);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <meta
          name="description"
          content="台灣啟靈意識研究站是一個致力於報導啟靈藥物在文化、藝術和心理治療方面的潛力和影響的網站。我們希望通過分享知識、故事和討論，提高大眾對啟靈意識的認識和理解，並促進台灣研究的發展。"
        />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#5bbad5" />
        <link rel="shortcut icon" href="/favicons/favicon.ico" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-config" content="/favicons/browserconfig.xml" />
        <meta name="theme-color" content="#ffffff" />
        <Script
          async
          id="Adsense-id"
          data-ad-client="ca-pub-6674885719294263"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
          strategy="lazyOnload"
        />
        <Script
          strategy="lazyOnload"
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}`}
        />
      </Head>
      <body>
        <Analytics />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
