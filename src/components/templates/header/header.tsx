import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import Image from 'next/image';
import BlogLogo from '@icons/logo.png';

import { LanguageSelector } from '@src/components/features/language-selector';
import { Container } from '@src/components/shared/container';

export const Header = () => {
  const { t } = useTranslation();

  return (
    <header className="border-b border-blue-medium bg-gradient-to-r from-blue-dark to-accent-slate py-4 text-white shadow-medium">
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
              className="text-base font-medium text-white transition-colors duration-200 hover:text-gray-lightest"
            >
              {t('common.homepage')}
            </Link>
          </div>
          <LanguageSelector />
        </Container>
      </nav>
    </header>
  );
};
