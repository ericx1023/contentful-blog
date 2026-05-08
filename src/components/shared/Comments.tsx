import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

interface CommentsProps {
  title?: string;
  className?: string;
}

declare global {
  interface Window {
    Isso?: {
      init: () => void;
    };
    issoLoadFailed?: boolean;
    issoScriptLoaded?: boolean;
  }
}

export const Comments = ({ title, className = '' }: CommentsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { asPath } = useRouter();
  const [loadError, setLoadError] = useState(false);
  const initAttempted = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 30; // Maximum 30 retries (3 seconds)

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

    // Check if Isso failed to load in _app.tsx
    if (window.issoLoadFailed) {
      console.error('❌ Isso script failed to load in _app.tsx');
      setLoadError(true);
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
      // Check if script has been explicitly marked as loaded
      if (window.issoScriptLoaded && window.Isso && typeof window.Isso.init === 'function') {
        console.log('✅ Initializing Isso for new thread');
        try {
          window.Isso.init();
          initAttempted.current = true;
          retryCount.current = 0; // Reset retry count on success
          setLoadError(false);
        } catch (error) {
          console.error('❌ Error initializing Isso:', error);
          setLoadError(true);
        }
      } else if (window.issoLoadFailed) {
        // Stop retrying if we know the script failed to load
        console.error('❌ Isso script failed to load - stopping retries');
        setLoadError(true);
      } else {
        retryCount.current += 1;
        if (retryCount.current >= MAX_RETRIES) {
          console.error(
            `❌ Isso failed to initialize after ${MAX_RETRIES} retries (${MAX_RETRIES * 100}ms).`,
          );
          console.error('📝 Possible reasons:');
          console.error('  1. Isso server is cold starting (Render free tier)');
          console.error('  2. Isso server is down or unreachable');
          console.error('  3. Network connectivity issues');
          console.error('  4. CORS configuration problem');
          console.error('💡 Try refreshing the page in 30-60 seconds');
          setLoadError(true);
          return;
        }
        console.log(`⏳ Waiting for Isso... (${retryCount.current}/${MAX_RETRIES})`);
        // Retry after a short delay
        if (!initAttempted.current) {
          setTimeout(initializeIsso, 100);
        }
      }
    };

    // Start initialization process with a longer delay to ensure script is loaded
    const initTimer = setTimeout(initializeIsso, 500);

    return () => {
      clearTimeout(initTimer);
    };

    // Reset init flag and retry count when unmounting
    return () => {
      initAttempted.current = false;
      retryCount.current = 0;
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
      {loadError ? (
        <div className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 rounded-md border p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-yellow-800 dark:text-yellow-200 font-semibold">
                評論系統暫時無法使用
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-2 text-sm">
                Render 免費服務在閒置後會進入休眠狀態。伺服器可能正在啟動中（需要 30-60 秒）。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600 mt-3 rounded px-4 py-2 text-sm text-white"
              >
                🔄 重新載入頁面
              </button>
              <details className="mt-3">
                <summary className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 cursor-pointer text-xs">
                  技術細節 ▼
                </summary>
                <div className="text-yellow-600 dark:text-yellow-400 mt-2 space-y-1 text-xs">
                  <p>• Server: {process.env.NEXT_PUBLIC_ISSO_URL}</p>
                  <p>• 檢查 Console 查看詳細錯誤訊息</p>
                  <p>• Render 免費服務限制: 15 分鐘無活動後休眠</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : (
        <div ref={ref} className="isso-comments" />
      )}
    </div>
  );
};
