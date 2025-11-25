import { ContentfulLivePreviewProvider } from '@contentful/live-preview/react';
import { appWithTranslation, useTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Urbanist } from 'next/font/google';
import './utils/globals.css';
import '@contentful/live-preview/style.css';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect } from 'react';

import { Layout } from '@src/components/templates/layout';
import { ThemeProvider } from '@src/contexts/ThemeContext';
const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' });

const App = ({ Component, pageProps }: AppProps) => {
  const { t } = useTranslation();
  const { locale } = useRouter();

  // Load Isso script once at app initialization
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ISSO_URL) {
      return;
    }

    // Check if Isso script is already loaded
    const existingScript = document.querySelector(
      `script[src*="${process.env.NEXT_PUBLIC_ISSO_URL}"]`,
    );

    if (existingScript) {
      console.log('Isso script already loaded in app');
      return;
    }

    console.log('Loading Isso script globally in _app.tsx');

    // Map Next.js locales to Isso supported languages
    const getIssoLanguage = (locale: string) => {
      const languageMap: Record<string, string> = {
        en: 'en',
        'en-US': 'en',
        'zh-Hant-TW': 'zh_TW',
        'zh-Hans': 'zh_CN',
        ja: 'ja',
        ko: 'ko',
        es: 'es',
        fr: 'fr',
        de: 'de',
        pt: 'pt',
        ru: 'ru',
      };
      return languageMap[locale] || 'en';
    };

    const scriptElem = document.createElement('script');
    scriptElem.src = `${process.env.NEXT_PUBLIC_ISSO_URL}/js/embed.min.js`;
    scriptElem.async = true;
    scriptElem.setAttribute('data-isso', process.env.NEXT_PUBLIC_ISSO_URL);
    scriptElem.setAttribute('data-isso-css', 'true');
    scriptElem.setAttribute('data-isso-lang', getIssoLanguage(locale || 'en'));
    scriptElem.setAttribute('data-isso-reply-to-self', 'false');
    scriptElem.setAttribute('data-isso-require-author', 'false');
    scriptElem.setAttribute('data-isso-require-email', 'false');
    scriptElem.setAttribute('data-isso-max-comments-top', '10');
    scriptElem.setAttribute('data-isso-max-comments-nested', '5');
    scriptElem.setAttribute('data-isso-reveal-on-click', '5');
    scriptElem.setAttribute('data-isso-avatar', 'true');
    scriptElem.setAttribute('data-isso-avatar-bg', '#f0f0f0');
    scriptElem.setAttribute(
      'data-isso-avatar-fg',
      '#9abf88 #5698c4 #e279a3 #9163b6 #be5168 #f19670 #e4b14b #8fa97c #c8d2f5 #d5c7a5',
    );
    scriptElem.setAttribute('data-isso-vote', 'true');
    scriptElem.setAttribute('data-isso-feed', 'false');
    scriptElem.setAttribute('data-isso-reply-notifications-default-enabled', 'false');

    scriptElem.onload = () => {
      console.log('Isso script loaded globally in _app.tsx');
    };

    scriptElem.onerror = () => {
      console.error('Failed to load Isso script from:', process.env.NEXT_PUBLIC_ISSO_URL);
    };

    document.head.appendChild(scriptElem);
  }, []); // Empty dependency array - only run once on mount

  return (
    <ThemeProvider>
      <ContentfulLivePreviewProvider
        enableInspectorMode={pageProps.previewActive}
        enableLiveUpdates={pageProps.previewActive}
        locale={locale || 'en-US'}
      >
        <Head>
          <title>{t('common.homepage')}</title>
        </Head>
        <>
          <main className={`${urbanist.variable} font-sans`}>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </main>
          <div id="portal" className={`${urbanist.variable} font-sans`} />
        </>
      </ContentfulLivePreviewProvider>
    </ThemeProvider>
  );
};

export default appWithTranslation(App);
