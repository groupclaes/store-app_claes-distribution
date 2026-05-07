import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'
import { environment } from './environments/environment'
import { defineCustomElements as pwaElements } from '@ionic/pwa-elements/loader'
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'

if (environment.production) {
  enableProdMode()
}

// Wait for DOMContentLoaded event
window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Capacitor SQLite
  const platform = Capacitor.getPlatform()
  const sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite)

  try {
    if (platform === 'web') {
      // Create the 'jeep-sqlite' Stencil component
      const jeepSqliteElement = document.createElement('jeep-sqlite')
      document.body.appendChild(jeepSqliteElement)
      await customElements.whenDefined('jeep-sqlite')

      // Initialize the Web store
      await sqlite.initWebStore()
    }

    platformBrowserDynamic()
      .bootstrapModule(AppModule)
      .catch(err => console.log(err))
  } catch (err) {
    console.log(`Error: ${err}`)
    throw new Error(`Error: ${err}`)
  }
})


pwaElements(window)
jeepSqlite(window)

