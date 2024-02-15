// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  version: '1.3.2-dev',
  default_language: 'nl-BE',
  supported_languages: [
    'nl-BE',
    'fr-BE'
  ],
  sso_url: 'https://sso.claes-distribution.be/v1/login',
  api_url: 'https://api.groupclaes.be/test/distribution',
  pcm_url: 'https://pcm.groupclaes.be/v4',
  database_name: 'distribution-test'
}

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
