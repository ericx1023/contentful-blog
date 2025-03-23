import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import Image from 'next/image';
import BlogLogo from '@icons/icon2.png';

import { LanguageSelector } from '@src/components/features/language-selector';
import { Container } from '@src/components/shared/container';

export const Header = () => {
  const { t } = useTranslation();
  console.log(t('common.homepage'));

  return (
    <header className="py-5">
      <nav>
        <Container className="flex items-center justify-between">
          <Link href="/" title={t('common.homepage')}>
            <Image src={BlogLogo} alt="logo" width={68} height={68} />
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-medium hover:underline">
              {t('common.homepage')}
            </Link>
          </div>
          <LanguageSelector />
        </Container>
      </nav>
    </header>
  );
};
