import { Container } from '@src/components/shared/container';

const ABOUT_TITLE = '關於我們';
const ABOUT_BODY =
  '台灣啟靈意識研究站是一個致力於報導啟靈藥物在文化、藝術和心理治療方面的潛力和影響的網站。我們希望通過分享知識、故事和討論，提高大眾對啟靈意識的認識和理解，並促進相關研究的發展。';

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-transparent bg-blue-dark text-white transition-colors duration-200 dark:border-border-dark dark:bg-bg-secondary-dark dark:text-text-primary-dark">
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white dark:text-text-primary-dark">
              {ABOUT_TITLE}
            </h2>
            <div className="max-w-lg text-gray-lightest dark:text-text-secondary-dark">
              {ABOUT_BODY}
            </div>
          </div>
          <div className="flex flex-col justify-center md:items-end">
            <div className="mt-4 text-sm text-gray-lightest dark:text-text-muted-dark">
              © {new Date().getFullYear()} 台灣啟靈意識研究站
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};
