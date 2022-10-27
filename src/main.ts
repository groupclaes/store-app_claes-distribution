import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'
import { environment } from './environments/environment'
import { defineCustomElements as pwaElements } from '@ionic/pwa-elements/loader'
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader'
import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

if (environment.production) {
  enableProdMode()
}
pwaElements(window)
jeepSqlite(window)
window.addEventListener('DOMContentLoaded', async () => {
  const platform = Capacitor.getPlatform()
  const sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite)
  try {
    if (platform === "web") {
      const jeepEl = document.createElement("jeep-sqlite")
      document.body.appendChild(jeepEl)
      await customElements.whenDefined('jeep-sqlite')
      await sqlite.initWebStore()
    }
    await sqlite.checkConnectionsConsistency()

    platformBrowserDynamic().bootstrapModule(AppModule)
      .catch(err => console.log(err))
  } catch (err) {
    throw new Error(`Error: ${err}`)
  }
})