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

const Page = (props: InferGetStaticPropsType<typeof getStaticProps>) => {
  const { t } = useTranslation();

  const page = useContentfulLiveUpdates(props.page);
  const standardPosts = useContentfulLiveUpdates(props.standardPosts);
  const htmlPosts = useContentfulLiveUpdates(props.htmlPosts);

  if (!standardPosts && !htmlPosts) return;

  // 合併並排序文章，獲取所有文章
  const allPosts = mergeAndSortArticles(standardPosts, htmlPosts);

  // 使用最新的文章作為精選文章
  const featuredArticle = allPosts[0];
  // 剩餘的文章顯示在網格中
  const remainingPosts = allPosts.slice(1);

  if (!featuredArticle) return;

  // 為 ArticleHero 創建兼容的文章對象
  const featuredArticleForHero = {
    __typename: 'PageBlogPost' as const,
    sys: featuredArticle.sys,
    slug: featuredArticle.slug,
    title: featuredArticle.title,
    internalName: featuredArticle.internalName,
    publishedDate: featuredArticle.publishedDate,
    shortDescription: featuredArticle.shortDescription || null,
    author: featuredArticle.author,
    featuredImage: featuredArticle.featuredImage,
  };

  return (
    <>
      {page?.seoFields && <SeoFields {...page.seoFields} />}
      <Container>
        <Link
          href={`/${featuredArticle.articleType === ArticleType.MARKDOWN ? 'html-posts/' : ''}${
            featuredArticle.slug
          }`}
        >
          <ArticleHero article={featuredArticleForHero} />
        </Link>
      </Container>

      {/* Tutorial: contentful-and-the-starter-template.md */}
      {/* Uncomment the line below to make the Greeting field available to render */}
      {/*<Container>*/}
      {/*  <div className="my-5 bg-colorTextLightest p-5 text-colorBlueLightest">{page.greeting}</div>*/}
      {/*</Container>*/}

      <Container className="my-8 md:mb-10 lg:mb-16">
        <h2 className="mb-4 md:mb-6">{t('landingPage.latestArticles')}</h2>
        <UnifiedArticleTileGrid
          className="md:grid-cols-2 lg:grid-cols-3"
          articles={remainingPosts}
        />
      </Container>
    </>
  );
};

export const getStaticProps: GetStaticProps = async ({ locale, draftMode: preview }) => {
  try {
    const gqlClient = preview ? previewClient : client;

    const landingPageData = await gqlClient.pageLanding({ locale, preview });
    const page = landingPageData.pageLandingCollection?.items[0];

    // 獲取標準部落格文章 - 獲取所有文章，不再排除任何文章
    const standardBlogPostsData = await gqlClient.pageBlogPostCollection({
      limit: 10,
      locale,
      order: PageBlogPostOrder.PublishedDateDesc,
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

    // 檢查是否至少有一篇文章
    if ((!standardPosts || standardPosts.length === 0) && (!htmlPosts || htmlPosts.length === 0)) {
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
        page: page || null,
        standardPosts: standardPosts || [],
        htmlPosts: htmlPosts || [],
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
