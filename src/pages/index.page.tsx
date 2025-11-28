import { useContentfulLiveUpdates } from '@contentful/live-preview/react';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';

import { getServerSideTranslations } from './utils/get-serverside-translations';

import { ArticleHero } from '@src/components/features/article';
import { UnifiedArticleTileGrid } from '@src/components/features/article/UnifiedArticleTileGrid';
import { SeoFields } from '@src/components/features/seo';
import { Container } from '@src/components/shared/container';
import {
  PageBlogPost,
  PageBlogPostOrder,
  PageBlogPostWithHtmlOrder,
} from '@src/lib/__generated/sdk';
import { client, previewClient } from '@src/lib/client';
import { revalidateDuration } from '@src/pages/utils/constants';
import { ArticleType, mergeAndSortArticles } from '@src/types/article';
import { HeroSection } from '@src/components/features/article';

const Page = (props: InferGetStaticPropsType<typeof getStaticProps>) => {
  const { t } = useTranslation();

  const page = useContentfulLiveUpdates(props.page);
  const standardPosts = useContentfulLiveUpdates(props.standardPosts);
  const htmlPosts = useContentfulLiveUpdates(props.htmlPosts);

  if (!page?.featuredBlogPost || !standardPosts) return;

  // 合併並排序文章
  const allPosts = mergeAndSortArticles(standardPosts, htmlPosts);

  return (
    <>
      {page.seoFields && <SeoFields {...page.seoFields} />}
      <Container>
        <Link href={`/${page.featuredBlogPost.slug}`}>
          <HeroSection article={page.featuredBlogPost} />
        </Link>
      </Container>

      {/* Tutorial: contentful-and-the-starter-template.md */}
      {/* Uncomment the line below to make the Greeting field available to render */}
      {/*<Container>*/}
      {/*  <div className="my-5 bg-colorTextLightest p-5 text-colorBlueLightest">{page.greeting}</div>*/}
      {/*</Container>*/}

      <Container className="my-8 md:mb-10 lg:mb-16">
        <h2 className="mb-4 md:mb-6">{t('landingPage.latestArticles')}</h2>
        <UnifiedArticleTileGrid className="md:grid-cols-2 lg:grid-cols-3" articles={allPosts} />
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps = async ({ locale, draftMode: preview }) => {
  try {
    const gqlClient = preview ? previewClient : client;

    const landingPageData = await gqlClient.pageLanding({ locale, preview });
    const page = landingPageData.pageLandingCollection?.items[0];

    // 獲取標準部落格文章
    const standardBlogPostsData = await gqlClient.pageBlogPostCollection({
      limit: 10,
      locale,
      order: PageBlogPostOrder.PublishedDateDesc,
      where: {
        slug_not: (page?.featuredBlogPost as PageBlogPost)?.slug,
      },
      preview,
    });
    const standardPosts = standardBlogPostsData.pageBlogPostCollection?.items;

    // 獲取 Markdown 部落格文章
    const htmlBlogPostsData = await gqlClient.pageBlogPostWithHtmlCollection({
      limit: 10,
      locale,
      order: PageBlogPostWithHtmlOrder.SysPublishedAtDesc, // 使用系統發布時間排序
      preview,
    });
    const htmlPosts = htmlBlogPostsData.pageBlogPostWithHtmlCollection?.items;

    if (!page) {
      return {
        revalidate: revalidateDuration,
        notFound: true,
      };
    }

    return {
      revalidate: revalidateDuration,
      props: {
        previewActive: !!preview,
        ...(await getServerSideTranslations(locale)),
        page,
        standardPosts,
        htmlPosts,
      },
    };
  } catch {
    return {
      revalidate: revalidateDuration,
      notFound: true,
    };
  }
};

export default Page;
