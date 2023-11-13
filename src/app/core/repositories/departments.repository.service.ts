import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'
import { IProductInfoT } from './products.repository.service'

@Injectable({
  providedIn: 'root'
})
export class DepartmentsRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(userCode: number): Promise<IDepartmentT[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT departments.id, departments.alias, (
           SELECT COUNT(*)
           FROM departmentProducts
           WHERE departmentProducts.department = departments.id
             AND EXISTS (
               SELECT *
               FROM currentExceptions
               WHERE currentExceptions.productId = departmentProducts.product
             )
           GROUP BY departmentProducts.department
         ) as products
         FROM departments
         LEFT OUTER JOIN departmentProducts ON departmentProducts.department = departments.id
         WHERE departments.userCode = ?
         GROUP BY departments.id`,
        [
          userCode
        ]
      )

      return result.values as IDepartmentT[]
    })
  }

  delete(id: number): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.executeSet([
        {
          statement: 'DELETE FROM departmentProducts WHERE department = ?',
          values: [
            id
          ]
        }, {
          statement: 'DELETE FROM departments WHERE id = ?',
          values: [
            id
          ]
        }
      ])

      return result.changes && result.changes.changes > 0
    })
  }

  create(id: number, userCode: number, alias: string): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        `INSERT INTO departments VALUES (?,?,?)`,
        [
          id,
          userCode,
          alias
        ]
      )

      return result.changes && result.changes.changes > 0
    })
  }

  updateName(id: number, alias: string): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        `UPDATE departments SET alias = ? WHERE id = ?`,
        [
          alias,
          id
        ]
      )

      return result.changes && result.changes.changes > 0
    })
  }

  getDetail(id: number, culture: string = 'nl-BE'): Promise<IDepartmentDetailT> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT id, alias
         FROM departments
         WHERE id = ?`,
        [
          id
        ]
      )

      if (result.values?.length === 0) {
        return undefined
      }

      const department = result.values[0] as IDepartmentDetailT
      const resultP = await db.query(
        `SELECT p.itemnum, p.id, p.${nameString} as name, pu.${nameString} as unit, p.url, p.color
         FROM departmentProducts
         INNER JOIN products p ON p.id = departmentProducts.product
         INNER JOIN packingUnits pu ON p.packId = pu.id
         WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = p.id) AND departmentProducts.department = ?`,
        [
          id
        ]
      )

      if (resultP.values === null || resultP.values.length === 0) {
        department.products = []
      } else {
        department.products = resultP.values as IProductInfoT[]
      }

      return department
    })
  }
}

export interface IDepartmentT {
  id: number
  alias: string
  products: number
}

export interface IDepartmentDetailT {
  id: number
  alias: string
  products: IProductInfoT[]
}