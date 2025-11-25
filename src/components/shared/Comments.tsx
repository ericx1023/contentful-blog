import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

interface CommentsProps {
  title?: string;
  className?: string;
}

declare global {
  interface Window {
    Isso?: {
      init: () => void;
    };
  }
}

export const Comments = ({ title, className = '' }: CommentsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { asPath } = useRouter();
  const initAttempted = useRef(false);

  useEffect(() => {
    console.log('Comments component mounted for path:', asPath);

    // Don't load if no Isso URL is configured
    if (!process.env.NEXT_PUBLIC_ISSO_URL) {
      console.warn('NEXT_PUBLIC_ISSO_URL not configured. Comments will not be loaded.');
      return;
    }

    if (!ref.current) {
      console.log('ref.current not available yet');
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
    console.log('Created #isso-thread element for path:', asPath);

    // Wait for Isso script to be available and initialize
    const initializeIsso = () => {
      if (window.Isso && typeof window.Isso.init === 'function') {
        console.log('Initializing Isso for new thread');
        try {
          window.Isso.init();
          initAttempted.current = true;
        } catch (error) {
          console.error('Error initializing Isso:', error);
        }
      } else {
        console.log('Isso not ready yet, waiting...');
        // Retry after a short delay
        if (!initAttempted.current) {
          setTimeout(initializeIsso, 100);
        }
      }
    };

    // Check if script is already loaded
    const existingScript = document.querySelector(
      `script[src*="${process.env.NEXT_PUBLIC_ISSO_URL}"]`,
    );

    if (existingScript) {
      console.log('Isso script already loaded, initializing thread');
      // Script is loaded, initialize immediately or wait a bit
      setTimeout(initializeIsso, 50);
    } else {
      console.log('Waiting for Isso script to load from _app.tsx');
      // Listen for script load
      const checkInterval = setInterval(() => {
        if (window.Isso) {
          clearInterval(checkInterval);
          initializeIsso();
        }
      }, 100);

      // Cleanup interval after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);

      return () => clearInterval(checkInterval);
    }

    // Reset init flag when unmounting
    return () => {
      initAttempted.current = false;
    };
  }, [asPath]); // Re-run when path changes

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
