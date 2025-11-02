import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import BlogLogo from '@icons/TAPSC.png';

import { LanguageSelector } from '@src/components/features/language-selector';
import { Container } from '@src/components/shared/container';
import { ThemeToggle } from '@src/components/shared/theme-toggle';

export const Header = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <header className=" border-blue-medium bg-gradient-to-r from-blue-dark to-accent-slate py-4 text-white shadow-medium dark:border-border-dark dark:from-bg-secondary-dark dark:text-text-primary-dark">
      <nav>
        <Container className="flex items-center justify-between">
          <Link href="/" title={t('common.homepage')}>
            <Image
              src={BlogLogo}
              alt="logo"
              width={50}
              height={50}
              className="rounded-full bg-white p-1 transition-transform duration-300 hover:scale-105"
            />
          </Link>
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className={`text-2xl font-medium text-white transition-colors duration-200 hover:text-gray-lightest dark:text-text-primary-dark dark:hover:text-text-secondary-dark ${
                router.locale === 'zh-Hant-TW' ? 'tracking-widest' : ''
              }`}
            >
              {t('common.homepage')}
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </Container>
      </nav>
    </header>
  );
};
