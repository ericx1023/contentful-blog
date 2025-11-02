import { useTranslation } from 'next-i18next';
import Link from 'next/link';

import { Container } from '@src/components/shared/container';

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-transparent bg-blue-dark text-white transition-colors duration-200 dark:border-border-dark dark:bg-bg-secondary-dark dark:text-text-primary-dark">
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white dark:text-text-primary-dark">
              {t('footer.aboutUs')}
            </h2>
            <div className="max-w-lg text-gray-lightest dark:text-text-secondary-dark">
              {t('footer.description')}
            </div>
          </div>
          <div className="flex flex-col justify-center md:items-end">
            <div className="text-gray-lightest dark:text-text-secondary-dark">
              {t('footer.powerBy')}{' '}
              <Link
                href="https://www.contentful.com"
                rel="noopener noreferrer"
                target="_blank"
                className="text-blue-accent transition-colors duration-200 hover:text-white dark:text-accent-blue-dark dark:hover:text-text-primary-dark"
              >
                Contentful
              </Link>
            </div>
            <div className="mt-4 text-sm text-gray-lightest dark:text-text-muted-dark">
              © {new Date().getFullYear()} - All rights reserved.
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};
