import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CustomersRepositoryService {

  constructor(private _db: DatabaseService) { }

  get<T>(id?: number, address?: number, limit: number = null): Promise<T> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      if (!id && !address) {
        const customers = await db.query(
          'SELECT * FROM customers' + (limit != null ? ' LIMIT ' + limit : '')
        )

        return customers.values as T[]
      }
      const result = await db.query(
        `SELECT * FROM customers WHERE id = ? AND addressId = ?` + (limit != null ? ' LIMIT ' + limit : ''),
        [ id, address ]
      )

      if (result.values?.length === 1) {
        return result.values[0] as T
      }

      return result.values as T[]
    })
  }

  searchCustomers<T>(searchQuery: string, limit?: string): Promise<T[]> {
    const custnum = parseInt(searchQuery, 10)

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      // Debug
      let query = 'SELECT * FROM customers '
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

  async getAllNotes() {
    return await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT * FROM notes ORDER BY date DESC`)

      return result.values as IVisitNote[]
    })
  }

  async getNotes(id: number, address: number, limit?: number): Promise<IVisitNote[]> {
    if (id === null || address === null) {
      return []
    }

    return await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT date, text FROM notes WHERE customer = ? AND address = ? `
        + `ORDER BY date DESC`
        + (limit != null ? ` LIMIT ${limit}` : ''),
        [ id, address ])

      return result.values as IVisitNote[]
    })
  }

  async getContacts(id: number, address: number): Promise<IContact[]> {
    if (!id || !address) {
      return []
    }

    return await this._db.executeQuery<Promise<IContact[]>>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT * FROM contacts WHERE customerId = ? AND addressId = ?`,
        [ id, address ])

      return result.values as IContact[]
    })
  }

  async getDeliverySchedule(id: number, address: number): Promise<IAppDeliveryScheduleModel[]> {
    if (!id || !address) {
      return []
    }

    return await this._db.executeQuery<Promise<IAppDeliveryScheduleModel[]>>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT * FROM deliverySchedules WHERE customerId = ? AND addressId = ?`,
        [ id, address ])

      return result.values as IAppDeliveryScheduleModel[]
    })
  }
}

export interface IVisitNote {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Id: number;
  date: Date;
  text: string;
  nextVisit?: string;
  customer: number;
  address: number;
  customerCloseFrom?: string;
  customerOpenFrom?: string;


  _savedDate: Date;
  _isSent: boolean;
}

export interface IContact {
  customerId: number;
  addressId: number;
  id: number;
  firstName: string;
  name: string;
  mailAddress: string;
  mobileNr: string;
  ordConf: boolean;
  bonus: boolean;
  invoice: boolean;
  comMailing: boolean;
  domiciliation: boolean;
  reminder: boolean;
  avatar?: string;
}

export interface IAppDeliveryScheduleModel {
  customerId: number;
  addressId: number;
  monAMFr: string;
  monAMTo: string;
  monPMFr: string;
  monPMTo: string;
  tueAMFr: string;
  tueAMTo: string;
  tuePMFr: string;
  tuePMTo: string;
  wedAMFr: string;
  wedAMTo: string;
  wedPMFr: string;
  wedPMTo: string;
  thuAMFr: string;
  thuAMTo: string;
  thuPMFr: string;
  thuPMTo: string;
  friAMFr: string;
  friAMTo: string;
  friPMFr: string;
  friPMTo: string;
}

