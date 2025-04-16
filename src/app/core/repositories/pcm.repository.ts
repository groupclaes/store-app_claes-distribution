import { Injectable } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'
import { IPCMAttachmentEntry } from './products.repository.service'

@Injectable({
  providedIn: 'root'
})
export class PcmRepositoryService {

  constructor(
    private _db: DatabaseService
  ) {
  }

  getDatasheet(guid: string): Promise<IPCMAttachmentEntry> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result: DBSQLiteValues = await db.query(
        'SELECT name, guid ' +
        'FROM datasheets ' +
        'WHERE guid = ?',
        [guid]
      )

      return result.values[0] as IPCMAttachmentEntry
    })
  }
}
