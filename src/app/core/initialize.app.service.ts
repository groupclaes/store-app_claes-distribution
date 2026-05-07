import { SQLiteService } from './sqlite.service'
import { Injectable } from '@angular/core'
import { environment } from 'src/environments/environment'
import { LoggerService } from '../@shared/logging/log.service'

const logger = new LoggerService('InitializeAppService')

@Injectable({
  providedIn: 'root'
})
export class InitializeAppService {
  constructor(
    private sqliteService: SQLiteService
  ) { }

  async initializeApp() {
    await this.sqliteService.initializePlugin().then(async (): Promise<void> => {
      try {
        logger.debug('initializeApp() called')
        //execute startup queries
        const db = await this.sqliteService.createConnection(environment.database_name, false, 'no-encryption', 1)
        logger.debug('Created Sqlite connection ' + environment.database_name)
        await db.open()
        logger.debug('Sqlite connection opened')
        // await this.sqliteService.closeConnection(environment.database_name)
      } catch (err) {
        throw Error(`initializeAppError: ${err}`)
      }
    })
  }
}
