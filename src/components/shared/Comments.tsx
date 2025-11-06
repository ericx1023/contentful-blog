import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@src/hooks/useTheme';

interface CommentsProps {
  title?: string;
  className?: string;
}

export const Comments = ({ title, className = '' }: CommentsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const { locale, asPath } = useRouter();
  const { resolvedTheme } = useTheme();

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

  useEffect(() => {
    console.log('Comments component useEffect triggered');
    console.log('NEXT_PUBLIC_ISSO_URL:', process.env.NEXT_PUBLIC_ISSO_URL);

    // Don't load if no Isso URL is configured
    if (!process.env.NEXT_PUBLIC_ISSO_URL) {
      console.warn('NEXT_PUBLIC_ISSO_URL not configured. Comments will not be loaded.');
      return;
    }

    console.log('ref.current:', ref.current);
    console.log('scriptLoaded:', scriptLoaded);

    if (!ref.current || scriptLoaded) {
      console.log('Returning early - ref or scriptLoaded issue');
      return;
    }

    // Check if script is already loaded globally
    const existingScript = document.querySelector(
      `script[src*="${process.env.NEXT_PUBLIC_ISSO_URL}"]`,
    );
    console.log('existingScript:', existingScript);

    if (existingScript) {
      console.log('Script already exists, creating thread only');
      setScriptLoaded(true);
      // Just create the thread section
      const section = document.createElement('section');
      section.id = 'isso-thread';
      section.setAttribute('data-isso-id', asPath);
      section.setAttribute('data-title', document.title);
      ref.current.appendChild(section);
      return;
    }

    // Clear any existing content
    ref.current.innerHTML = '';

    // Create the Isso comment section
    const section = document.createElement('section');
    section.id = 'isso-thread';
    section.setAttribute('data-isso-id', asPath);
    section.setAttribute('data-title', document.title);

    ref.current.appendChild(section);

    console.log('Creating new Isso script...');

    // Load Isso script only once
    const scriptElem = document.createElement('script');
    scriptElem.src = `${process.env.NEXT_PUBLIC_ISSO_URL}/js/embed.min.js`;
    scriptElem.async = true;

    console.log('Script src:', scriptElem.src);
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
    // Explicitly enable delete functionality
    scriptElem.setAttribute('data-isso-reply-notifications-default-enabled', 'false');

    // Handle script load success
    scriptElem.onload = () => {
      console.log('Isso script loaded successfully!');
      setScriptLoaded(true);
    };

    // Handle script load errors
    scriptElem.onerror = () => {
      console.error('Failed to load Isso comments from:', process.env.NEXT_PUBLIC_ISSO_URL);
      if (ref.current) {
        ref.current.innerHTML = `
          <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p class="text-yellow-800 text-sm">
              Comments are temporarily unavailable. Server: ${process.env.NEXT_PUBLIC_ISSO_URL}
            </p>
            <p class="text-yellow-700 text-xs mt-2">
              Check browser console for details.
            </p>
          </div>
        `;
      }
    };

    console.log('Adding script to document head...');
    document.head.appendChild(scriptElem);
    console.log('Script added to head');
  }, [locale, asPath, scriptLoaded]);

  // Don't render anything if Isso URL is not configured
  if (!process.env.NEXT_PUBLIC_ISSO_URL) {
    return null;
  }

  return (
    <div className={`mt-12 ${className}`}>
      <h3 className="mb-6 text-2xl font-bold text-blue-medium dark:text-accent-blue-dark">
        {title || '留言討論'}
      </h3>
      <div ref={ref} className="isso-comments" />
    </div>
  );
};
