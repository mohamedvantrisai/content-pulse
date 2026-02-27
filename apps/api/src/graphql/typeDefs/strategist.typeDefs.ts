export const strategistTypeDefs = `#graphql
  type ContentBrief {
    id: ID!
    title: String!
    status: String!
  }

  extend type Query {
    contentBrief: ContentBrief!
  }
`;
