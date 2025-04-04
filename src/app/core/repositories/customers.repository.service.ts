import { Injectable } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CustomersRepositoryService {

  constructor(private _db: DatabaseService) {
  }

  get<T>(id?: number, address?: number, limit: number = null): Promise<T> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      if (!id && !address) {
        const customers = await db.query(
          'SELECT * FROM customers' + (limit != null ? ' LIMIT ' + limit : '')
        )

        return customers.values as T[]
      }
      const result = await db.query(
        `SELECT *
         FROM customers
         WHERE id = ?
           AND addressId = ?` + (limit != null ? ' LIMIT ' + limit : ''),
        [id, address]
      )

      if (result.values?.length === 1) {
        return result.values[0] as T
      }

      return result.values as T[]
    })
  }

  async getDatasheets(id: number, address: number, culture: string, searchQuery: string): Promise<any[]> {
    // , [d].[name]
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection): Promise<any[]> => {
      let search: string = searchQuery.trim().length > 0 ? 'AND ([p].[itemnum] LIKE ? || \'%\') ' : ''
      const query: string = 'SELECT [p].[itemnum], [p].[nameNl] AS product_name, [d].[name], [f].[lastB], [d].[guid] ' +
        'FROM currentExceptions [c] ' +
        'INNER JOIN products [p] ON [p].[id] = [c].[productId] ' +
        'INNER JOIN [favorites] [f] ON [f].id = [p].[id] AND [f].[cu] = ? AND [f].[ad] = ? ' +
        'INNER JOIN datasheets [d] ON [d].[products] LIKE \'%\' || [p].[itemnum] || \'%\' AND languages LIKE \'%"\' || ? || \'":true%\' ' +
        'WHERE ( [f].[hi] = 0 OR [f].[hi] IS NULL ) AND [f].[lastB] IS NOT NULL ' + search +
        'ORDER BY [f].[lastB] DESC '

      const params: any[] = [id, address, culture]
      if (search.length > 0)
        params.push(searchQuery.trim().toLocaleLowerCase())

      console.debug(search, query, params)
      const result: DBSQLiteValues = await db.query(query, params)

      return result.values as any[]
    })
  }

  searchCustomers<T>(searchQuery: string, limit?: string): Promise<T[]> {
    const custnum = parseInt(searchQuery, 10)

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      // Debug
      let query = 'SELECT c.*, '
        + 'EXISTS (SELECT 1 FROM unsentNotes n WHERE n.customer = c.id AND n.address = c.addressId) AS `hasUnsentNotes` '
        + 'FROM customers c '
        + `WHERE (LOWER(name) LIKE '%' || ? || '%') OR (LOWER(addressName) LIKE '%' || ? || '%') `
        + `OR (LOWER(city) LIKE '%' || ? || '%') OR (LOWER(delvCity) LIKE '%' || ? || '%')`

      if (!isNaN(custnum) && custnum > 0) {
        query += ` OR id = ${custnum} OR address = ${custnum}`
      }

      searchQuery = searchQuery.toLowerCase()
      const result = await db.query(query,
        [searchQuery, searchQuery, searchQuery, searchQuery]
      )

      return result.values as T[]
    })
  }

  async getContacts(id: number, address: number): Promise<IContact[]> {
    if (!id)
      return []

    return await this._db.executeQuery<Promise<IContact[]>>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT *
                                     FROM contacts
                                     WHERE customerId = ?
                                       AND addressId = ?`,
        [id, address])

      return result.values as IContact[]
    })
  }

  async getDeliverySchedule(id: number, address: number): Promise<IAppDeliveryScheduleModel[]> {
    if (!id)
      return []

    return await this._db.executeQuery<Promise<IAppDeliveryScheduleModel[]>>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT *
                                     FROM deliverySchedules
                                     WHERE customerId = ?
                                       AND addressId = ?`,
        [id, address])

      return result.values as IAppDeliveryScheduleModel[]
    })
  }
}

export interface IContact {
  customerId: number
  addressId: number
  id: number
  firstName: string
  name: string
  mailAddress: string
  mobileNr: string
  ordConf: boolean
  bonus: boolean
  invoice: boolean
  comMailing: boolean
  domiciliation: boolean
  reminder: boolean
  avatar?: string
}

export interface IAppDeliveryScheduleModel {
  customerId: number
  addressId: number
  monAMFr: string
  monAMTo: string
  monPMFr: string
  monPMTo: string
  tueAMFr: string
  tueAMTo: string
  tuePMFr: string
  tuePMTo: string
  wedAMFr: string
  wedAMTo: string
  wedPMFr: string
  wedPMTo: string
  thuAMFr: string
  thuAMTo: string
  thuPMFr: string
  thuPMTo: string
  friAMFr: string
  friAMTo: string
  friPMFr: string
  friPMTo: string
}

