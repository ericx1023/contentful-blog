import { HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export const Container = ({ className, ...props }: HTMLProps<HTMLDivElement>) => {
  return (
    <div className={twMerge('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
};
