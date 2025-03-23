import { GraphQLClient } from 'graphql-request';
import {
  getSdk,
  PageBlogPostWithHtml,
  PageBlogPostWithHtmlQuery,
  PageBlogPostWithHtmlFieldsFragment,
  PageBlogPostWithHtmlCollectionQuery,
} from './__generated/sdk';

// 擴展 SDK 類型以包含我們的新查詢
export interface ExtendedSdk extends ReturnType<typeof getSdk> {
  pageBlogPostWithHtml: (variables: {
    slug: string;
    locale?: string;
    preview?: boolean;
  }) => Promise<PageBlogPostWithHtmlQuery>;

  pageBlogPostWithHtmlCollection: (variables?: {
    locale?: string;
    preview?: boolean;
    limit?: number;
    order?: any;
    where?: any;
  }) => Promise<PageBlogPostWithHtmlCollectionQuery>;
}

// 手動實現查詢函數
const createExtendedSdk = (client: GraphQLClient): ExtendedSdk => {
  const baseSdk = getSdk(client);

  return {
    ...baseSdk,
    pageBlogPostWithHtml: async variables => {
      const query = `
        query pageBlogPostWithHtml($slug: String!, $locale: String, $preview: Boolean) {
          pageBlogPostWithHtmlCollection(limit: 1, where: { slug: $slug }, locale: $locale, preview: $preview) {
            __typename
            items {
              __typename
              sys {
                __typename
                id
                spaceId
                publishedAt
                firstPublishedAt
              }
              internalName
              slug
              title
              html
              author {
                __typename
                sys { id }
                name
                avatar {
                  __typename
                  sys { id }
                  title
                  description
                  url
                  contentType
                  width
                  height
                }
              }
              featuredImage {
                __typename
                sys { id }
                title
                description
                url
                contentType
                width
                height
              }
            }
          }
        }
      `;

      return client.request(query, variables);
    },

    pageBlogPostWithHtmlCollection: async variables => {
      const query = `
        query pageBlogPostWithHtmlCollection($locale: String, $preview: Boolean, $limit: Int, $order: [PageBlogPostWithHtmlOrder], $where: PageBlogPostWithHtmlFilter) {
          pageBlogPostWithHtmlCollection(limit: $limit, locale: $locale, preview: $preview, order: $order, where: $where) {
            __typename
            items {
              __typename
              sys {
                __typename
                id
                spaceId
                publishedAt
                firstPublishedAt
              }
              internalName
              slug
              title
              html
              author {
                __typename
                sys { id }
                name
                avatar {
                  __typename
                  sys { id }
                  title
                  description
                  url
                  contentType
                  width
                  height
                }
              }
              featuredImage {
                __typename
                sys { id }
                title
                description
                url
                contentType
                width
                height
              }
            }
          }
        }
      `;

      return client.request(query, variables);
    },
  };
};

export { createExtendedSdk };
