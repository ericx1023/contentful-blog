import { ReactNode } from 'react';

import { Footer } from '../footer';
import { Header } from '../header';

interface LayoutPropsInterface {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutPropsInterface) => {
  return (
    <div className="flex min-h-screen flex-col bg-gray-lightest transition-colors duration-200 dark:bg-bg-primary-dark">
      <Header />
      <main className="mt-10 mb-10 flex-grow">{children}</main>
      <Footer />
    </div>
  );
};
