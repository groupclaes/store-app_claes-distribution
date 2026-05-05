const config = {
  appId: 'be.claesdistribution.shopapp',
  appName: 'Claes Store',
  webDir: 'www',
  server: {
    hostname: 'shop.claes-distribution.be'
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/Database',
      iosIsEncryption: false,
      electronWindowsLocation: 'CapacitorDatabases',
      electronMacLocation: 'CapacitorDatabases',
      electronLinuxLocation: 'CapacitorDatabases'
    }
  }
}

if (process.argv[3] === 'android') {
  config['server']['hostname'] = 'shop.claes-distribution.com'
}

export default config
