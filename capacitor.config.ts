import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'be.claesdistribution.shopapp',
  appName: 'store-app',
  webDir: 'www',
  server: {
    hostname: 'shop.claes-distribution.be'
  },
  bundledWebRuntime: false
}

export default config
