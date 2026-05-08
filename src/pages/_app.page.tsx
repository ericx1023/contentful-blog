import { ContentfulLivePreviewProvider } from '@contentful/live-preview/react';
import { appWithTranslation, useTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Urbanist } from 'next/font/google';
import './utils/globals.css';
import '@contentful/live-preview/style.css';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';

import { Layout } from '@src/components/templates/layout';
import { ThemeProvider } from '@src/contexts/ThemeContext';
const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' });

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

// Wake up Render server if it's sleeping (cold start)
const wakeUpIssoServer = async (issoUrl: string): Promise<boolean> => {
  try {
    console.log('🔄 Pinging Isso server to wake it up...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${issoUrl}/js/embed.min.js`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const isAwake = response.ok;
    if (isAwake) {
      console.log('✅ Isso server is awake and responding');
    } else {
      console.warn(`⚠️ Isso server responded with status: ${response.status}`);
    }
    return isAwake;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('⏱️ Isso server wake-up timeout (30s) - server might be cold starting');
    } else {
      console.error('❌ Failed to ping Isso server:', error);
    }
    return false;
  }
};

const App = ({ Component, pageProps }: AppProps) => {
  const { t } = useTranslation();
  const { locale } = useRouter();
  const [issoServerReady, setIssoServerReady] = useState(false);

  const issoUrl = process.env.NEXT_PUBLIC_ISSO_URL;
  const issoLang = getIssoLanguage(locale || 'en');

  // Wake up Isso server on app mount
  useEffect(() => {
    if (!issoUrl) return;

    wakeUpIssoServer(issoUrl).then(isReady => {
      setIssoServerReady(isReady);
      if (!isReady) {
        // Retry after 5 seconds if server wasn't ready
        console.log('🔄 Retrying Isso server wake-up in 5 seconds...');
        setTimeout(async () => {
          const retryReady = await wakeUpIssoServer(issoUrl);
          setIssoServerReady(retryReady);
        }, 5000);
      }
    });
  }, [issoUrl]);

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
          {issoUrl && issoServerReady && (
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
                console.log('✅ Isso script loaded successfully via Next.js Script');
                console.log('window.Isso:', window.Isso);
                // Mark as successfully loaded
                (window as any).issoScriptLoaded = true;
              }}
              onError={e => {
                console.error('❌ Failed to load Isso script from:', issoUrl);
                console.error('Error details:', e);
                // Set a flag so components know Isso failed to load
                (window as any).issoLoadFailed = true;
              }}
            />
          )}
          {issoUrl && !issoServerReady && (
            <div className="bg-blue-500 fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm text-white shadow-lg">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>正在喚醒評論服務器...</span>
              </div>
            </div>
          )}
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
