import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Urbanist } from 'next/font/google';
import './utils/globals.css';
import { useRouter } from 'next/router';
import Script from 'next/script';

import { Layout } from '@src/components/templates/layout';
import { ThemeProvider } from '@src/contexts/ThemeContext';
const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' });

// Map Next.js locales to Isso supported languages.
const getIssoLanguage = (locale: string) => {
  const languageMap: Record<string, string> = {
    en: 'en',
    'en-US': 'en',
    'zh-Hant-TW': 'zh_TW',
    'zh-Hans': 'zh_CN',
  };
  return languageMap[locale] || 'en';
};

const App = ({ Component, pageProps }: AppProps) => {
  const { locale } = useRouter();
  const issoUrl = process.env.NEXT_PUBLIC_ISSO_URL;
  const issoLang = getIssoLanguage(locale || 'zh-Hant-TW');

  return (
    <ThemeProvider>
      {issoUrl && (
        <Script
          src={`${issoUrl}/js/embed.min.js`}
          strategy="afterInteractive"
          data-isso={issoUrl}
          data-isso-css="true"
          data-isso-lang={issoLang}
          data-isso-reply-to-self="false"
          data-isso-require-author="false"
          data-isso-require-email="false"
          data-isso-max-comments-top="10"
          data-isso-max-comments-nested="5"
          data-isso-reveal-on-click="5"
          data-isso-avatar="true"
          data-isso-avatar-bg="#f0f0f0"
          data-isso-avatar-fg="#9abf88 #5698c4 #e279a3 #9163b6 #be5168 #f19670 #e4b14b #8fa97c #c8d2f5 #d5c7a5"
          data-isso-vote="true"
          data-isso-feed="false"
          data-isso-reply-notifications-default-enabled="false"
          onLoad={() => {
            (window as unknown as { issoScriptLoaded?: boolean }).issoScriptLoaded = true;
          }}
          onError={() => {
            (window as unknown as { issoLoadFailed?: boolean }).issoLoadFailed = true;
          }}
        />
      )}
      <main className={`${urbanist.variable} font-sans`}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </main>
      <div id="portal" className={`${urbanist.variable} font-sans`} />
    </ThemeProvider>
  );
};

export default appWithTranslation(App);
