import { SQLiteService } from './sqlite.service'
import { Injectable } from '@angular/core'
import { environment } from 'src/environments/environment'
import { LoggingProvider } from '../@shared/logging/log.service'
//import { MigrationService } from './migrations.service'

@Injectable()
export class InitializeAppService {
  constructor(
    private sqliteService: SQLiteService,
    private logger: LoggingProvider
  ) { }

  async initializeApp() {
    await this.sqliteService.initializePlugin().then(async (ret) => {
      try {
        this.logger.debug('InitializeAppService -- initializeApp() called')
        //execute startup queries
        const db = await this.sqliteService.createConnection(environment.database_name, false, "no-encryption", 1)
        await db.open()
        // await this.sqliteService.closeConnection(environment.database_name)
      } catch (err) {
        throw Error(`initializeAppError: ${err}`)
      }
    })
  }
}