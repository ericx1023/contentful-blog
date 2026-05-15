import Link from 'next/link';
import Image from 'next/image';
import BlogLogo from '@icons/TAPSC.png';

import { Container } from '@src/components/shared/container';
import { ThemeToggle } from '@src/components/shared/theme-toggle';

const SITE_NAME = '台灣啟靈意識研究站';

export const Header = () => {
  return (
    <header className="border-blue-medium bg-gradient-to-r from-blue-dark to-accent-slate py-4 text-white shadow-medium dark:border-border-dark dark:from-bg-secondary-dark dark:text-text-primary-dark">
      <nav>
        <Container className="flex items-center justify-between">
          <Link href="/" title={SITE_NAME} className="flex items-center gap-3">
            <Image
              src={BlogLogo}
              alt={SITE_NAME}
              width={50}
              height={50}
              className="rounded-full bg-white p-1 transition-transform duration-300 hover:scale-105"
            />
            <span className="text-lg font-medium tracking-widest text-white dark:text-text-primary-dark md:text-2xl">
              {SITE_NAME}
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </Container>
      </nav>
    </header>
  );
};
