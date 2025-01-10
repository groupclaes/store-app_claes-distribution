import { Injectable } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class DataIntegrityChecksumsRepositoryService {
  constructor(private _db: DatabaseService) { }

  async get<T>(tableName?: string): Promise<T[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      if (!tableName) {
        const checksums: DBSQLiteValues = await db.query('SELECT * FROM dataIntegrityChecksums WHERE dataTable IS NOT NULL')
        return checksums.values as T[]
      }

      const checksums: DBSQLiteValues = await db.query('SELECT * FROM dataIntegrityChecksums WHERE dataTable = ?', [tableName])
      return checksums.values as T[]
    })
  }
}
