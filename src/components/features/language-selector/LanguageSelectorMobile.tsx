import { LanguageIcon, CloseIcon } from '@contentful/f36-icons';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import FocusLock from 'react-focus-lock';
import { twMerge } from 'tailwind-merge';

import { Portal } from '@src/components/shared/portal';

export const LanguageSelectorMobile = ({ localeName, displayName }) => {
  const { locale, locales } = useRouter();
  const router = useRouter();
  const { t } = useTranslation();
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    const close = e => {
      if (e.key === 'Escape') {
        setShowDrawer(false);
      }
    };

    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  });

  return (
    <>
      <button
        title={t('common.languageDrawer')}
        onClick={() => setShowDrawer(currentState => !currentState)}
        aria-expanded={showDrawer}
        aria-controls="locale-drawer"
        className="text-white transition-colors duration-200 hover:text-gray-lightest"
      >
        <LanguageIcon width="18px" height="18px" className="text-white" variant="white" />
      </button>

      <Portal>
        <FocusLock disabled={!showDrawer} returnFocus={true}>
          <div
            role="presentation"
            tabIndex={-1}
            className={twMerge(
              'fixed top-0 left-0 h-full w-full bg-black/[0.6] transition-opacity duration-150',
              showDrawer ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={() => setShowDrawer(false)}
          />
          <div
            id="locale-drawer"
            aria-modal="true"
            aria-hidden={!showDrawer}
            className={twMerge(
              `fixed top-0 right-0 z-40 h-full w-[80vw] bg-white py-8 px-5 shadow-elevated duration-300 ease-in-out`,
              showDrawer ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-blue-dark">
                {t('common.regionalSettings')}
              </h2>

              <button className="ml-auto pl-2" onClick={() => setShowDrawer(false)}>
                <CloseIcon
                  width="18px"
                  height="18px"
                  className="text-gray-medium transition-colors duration-200 hover:text-gray-dark"
                  variant="muted"
                />
              </button>
            </div>

            <p className="mt-8 text-base font-semibold text-blue-medium"> {t('common.language')}</p>
            <select
              className="mt-2 block w-full rounded-md border border-gray-light py-2 px-2 text-sm shadow-subtle focus:border-blue-medium focus:outline-none focus:ring-1 focus:ring-blue-light"
              defaultValue={locale}
              onChange={event => {
                router.push({ pathname: router.pathname, query: router.query }, router.asPath, {
                  locale: String(event.target.value),
                });
                setShowDrawer(!showDrawer);
              }}
            >
              {locales?.map(availableLocale => (
                <option key={availableLocale} value={availableLocale}>
                  {displayName(availableLocale).of(localeName(availableLocale))}
                </option>
              ))}
            </select>
          </div>
        </FocusLock>
      </Portal>
    </>
  );
};
