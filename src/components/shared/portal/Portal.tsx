import { ReactNode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface PortalProps {
  children: ReactNode;
  id?: string;
}

export const Portal = ({ children, id = 'portal' }: PortalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const container = document.querySelector(`#${id}`) || document.body;
  return ReactDOM.createPortal(children, container);
};
