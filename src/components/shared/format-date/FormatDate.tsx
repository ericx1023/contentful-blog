import { useRouter } from 'next/router';
import dayjs from 'dayjs';

interface FormatDateProps {
  date: number | Date | undefined;
  locale?: string;
}

export const formatDateFunc = ({ date, locale = 'en' }: FormatDateProps) => {
  if (!locale || !date) return null;

  return dayjs(date).format('MMM DD, YYYY');
};

export const FormatDate = (props: FormatDateProps) => {
  const { locale: localeFromRouter } = useRouter();

  if (!localeFromRouter) return null;

  return <>{formatDateFunc({ ...props, locale: localeFromRouter })}</>;
};
