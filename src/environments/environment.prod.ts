export const environment = {
  production: true,
  version: '2.0.1',
  default_language: 'nl-BE',
  supported_languages: [
    'nl-BE',
    'fr-BE'
  ],
  cardinal_settings: {
    battery_thresholds: {
      location: .2,
      notifications: .1,
      background_fetch: .01
    }
  },
  store_url: 'https://shop.claes-distribution.be/api/v1/store-app',
  shop_api: 'https://shop.claes-distribution.be/api/v1/ecommerce',
  api_url: 'https://api.groupclaes.be/distribution',
  pcm_url: 'https://pcm.groupclaes.be/v4',
  database_name: 'distribution',
  mock_offline: false
}
