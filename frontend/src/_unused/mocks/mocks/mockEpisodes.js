/**
 * Mock Episodes & Assets Data
 * Used for development/testing when database is unavailable
 */

export const mockEpisodes = [
  {
    id: 1,
    show_id: 'SAL',
    episodeNumber: 1,
    seasonNumber: 1,
    episodeTitle: 'The New Beginning',
    showName: 'Just a Woman in Her Prime',
    status: 'DRAFT',
    airDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 2,
    show_id: 'SAL',
    episodeNumber: 2,
    seasonNumber: 1,
    episodeTitle: 'Pilot Episode - Introduction to Styling',
    showName: 'Just a Woman in Her Prime',
    status: 'DRAFT',
    airDate: null,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z'
  },
  {
    id: 3,
    show_id: 'SAL',
    episodeNumber: 3,
    seasonNumber: 1,
    episodeTitle: 'Unexpected Allies',
    showName: 'Just a Woman in Her Prime',
    status: 'DRAFT',
    airDate: null,
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z'
  },
  {
    id: 4,
    show_id: 'SAL',
    episodeNumber: 4,
    seasonNumber: 1,
    episodeTitle: 'The Guest Episode',
    showName: 'Just a Woman in Her Prime',
    status: 'IN_PROGRESS',
    airDate: null,
    createdAt: '2026-01-04T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z'
  },
  {
    id: 5,
    show_id: 'SAL',
    episodeNumber: 5,
    seasonNumber: 1,
    episodeTitle: 'Styling Challenge',
    showName: 'Just a Woman in Her Prime',
    status: 'DRAFT',
    airDate: null,
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z'
  }
];

export const mockAssets = {
  PROMO_LALA: [
    {
      id: 'a3c3d633-1111-1111-1111-111111111111',
      assetType: 'PROMO_LALA',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/lala/raw/lala-red-dress.jpg',
      s3KeyProcessed: 'promotional/lala/processed/lala-red-dress.png',
      s3UrlRaw: 'https://example.com/lala-red-dress.jpg',
      s3UrlProcessed: 'https://example.com/lala-red-dress.png',
      metadata: { outfit: 'Red Sparkle Dress', pose: 'Standing' },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'a3c3d633-2222-2222-2222-222222222222',
      assetType: 'PROMO_LALA',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/lala/raw/lala-blue-gown.jpg',
      s3KeyProcessed: 'promotional/lala/processed/lala-blue-gown.png',
      s3UrlRaw: 'https://example.com/lala-blue-gown.jpg',
      s3UrlProcessed: 'https://example.com/lala-blue-gown.png',
      metadata: { outfit: 'Blue Evening Gown', pose: 'Twirling' },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'a3c3d633-3333-3333-3333-333333333333',
      assetType: 'PROMO_LALA',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/lala/raw/lala-casual.jpg',
      s3KeyProcessed: 'promotional/lala/processed/lala-casual.png',
      s3UrlRaw: 'https://example.com/lala-casual.jpg',
      s3UrlProcessed: 'https://example.com/lala-casual.png',
      metadata: { outfit: 'Casual Chic', pose: 'Sitting' },
      createdAt: '2026-01-01T00:00:00Z'
    }
  ],
  PROMO_GUEST: [
    {
      id: '64244467-1111-1111-1111-111111111111',
      assetType: 'PROMO_GUEST',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/guests/raw/guest-sarah.jpg',
      s3KeyProcessed: 'promotional/guests/processed/guest-sarah.png',
      s3UrlRaw: 'https://example.com/guest-sarah.jpg',
      s3UrlProcessed: 'https://example.com/guest-sarah.png',
      metadata: { name: 'Sarah Smith', role: 'Fashion Expert' },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: '64244467-2222-2222-2222-222222222222',
      assetType: 'PROMO_GUEST',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/guests/raw/guest-mike.jpg',
      s3KeyProcessed: 'promotional/guests/processed/guest-mike.png',
      s3UrlRaw: 'https://example.com/guest-mike.jpg',
      s3UrlProcessed: 'https://example.com/guest-mike.png',
      metadata: { name: 'Mike Johnson', role: 'Celebrity Stylist' },
      createdAt: '2026-01-01T00:00:00Z'
    }
  ],
  PROMO_JUSTAWOMANINHERPRIME: [
    {
      id: '951422f5-1111-1111-1111-111111111111',
      assetType: 'PROMO_JUSTAWOMANINHERPRIME',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/justawoman/raw/justawoman-v1.jpg',
      s3KeyProcessed: 'promotional/justawoman/raw/justawoman-v1.jpg',
      s3UrlRaw: 'https://example.com/justawoman-v1.jpg',
      s3UrlProcessed: 'https://example.com/justawoman-v1.jpg',
      metadata: { version: 1, outfit: 'Purple Ensemble' },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: '951422f5-2222-2222-2222-222222222222',
      assetType: 'PROMO_JUSTAWOMANINHERPRIME',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/justawoman/raw/justawoman-v2.jpg',
      s3KeyProcessed: 'promotional/justawoman/raw/justawoman-v2.jpg',
      s3UrlRaw: 'https://example.com/justawoman-v2.jpg',
      s3UrlProcessed: 'https://example.com/justawoman-v2.jpg',
      metadata: { version: 2, outfit: 'Gold Dress' },
      createdAt: '2026-01-01T00:00:00Z'
    }
  ],
  EPISODE_FRAME: [
    {
      id: 'a4c03576-1111-1111-1111-111111111111',
      assetType: 'EPISODE_FRAME',
      approvalStatus: 'APPROVED',
      s3KeyRaw: 'promotional/frames/raw/frame-geometric.jpg',
      s3KeyProcessed: 'promotional/frames/processed/frame-geometric.png',
      s3UrlRaw: 'https://example.com/frame-geometric.jpg',
      s3UrlProcessed: 'https://example.com/frame-geometric.png',
      metadata: { pattern: 'Geometric', color: 'Gold' },
      createdAt: '2026-01-01T00:00:00Z'
    }
  ]
};
