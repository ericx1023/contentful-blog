import { useTranslation } from 'next-i18next';
import Link from 'next/link';

import { Container } from '@src/components/shared/container';

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto bg-blue-dark text-white">
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white">{t('footer.aboutUs')}</h2>
            <div className="max-w-lg text-gray-lightest">{t('footer.description')}</div>
          </div>
          <div className="flex flex-col justify-center md:items-end">
            <div className="text-gray-lightest">
              {t('footer.powerBy')}{' '}
              <Link
                href="https://www.contentful.com"
                rel="noopener noreferrer"
                target="_blank"
                className="text-blue-accent transition-colors duration-200 hover:text-white"
              >
                Contentful
              </Link>
            </div>
            <div className="mt-4 text-sm text-gray-lightest">
              © {new Date().getFullYear()} - All rights reserved.
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};
