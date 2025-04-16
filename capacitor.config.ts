import { CapacitorElectronConfig } from '@capacitor-community/electron'

const config: CapacitorElectronConfig = {
  appId: 'be.claesdistribution.shopapp',
  appName: 'Claes Store',
  webDir: 'www',
  server: {
    hostname: 'shop.claes-distribution.be'
  },
  bundledWebRuntime: false,
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/Database',
      iosIsEncryption: false,
      electronWindowsLocation: 'CapacitorDatabases',
      electronMacLocation: 'CapacitorDatabases',
      electronLinuxLocation: 'CapacitorDatabases'
    }
  },
  electron: {
    // Custom scheme for your app to be served on in the electron window.
    customUrlScheme: 'claes-storeapp',
    // Switch on/off a tray icon and menu, which is customizable in the app.
    trayIconAndMenuEnabled: false,
    // Switch on/off whether or not a splashscreen will be used.
    splashScreenEnabled: false,
    // Custom image name in the electron/assets folder to use as splash image (.gif included)
    splashScreenImageName: 'splash.png',
    // Switch on/off if the main window should be hidden until brought to the front by the tray menu, etc.
    hideMainWindowOnLaunch: false,
    // Switch on/off whether or not to use deeplinking in your app.
    deepLinkingEnabled: false,
    // Custom protocol to be used with deeplinking for your app.
    deepLinkingCustomProtocol: 'claes-storeapp'
  }
}

if (process.argv[3] === 'android') {
  config['server']['hostname'] = 'shop.claes-distribution.com'
}

export default config
