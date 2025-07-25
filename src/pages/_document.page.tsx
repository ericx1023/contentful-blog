import { Analytics } from '@vercel/analytics/react';
import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  debugger;
  return (
    <Html lang="en">
      <Head>
        <meta
          name="description"
          content="台灣啟靈意識研究學會是一個關注啟靈藥，迷幻藥，科技，心理健康的研究組織。我們的目標是提供一個安全，開放，友善的環境，讓使用者分享他們的經驗，學習新知，探索自我，了解未來的發展趨勢和相關資訊。我們相信啟靈藥可以幫助人們打破思維的框架，創造更美好的未來"
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
