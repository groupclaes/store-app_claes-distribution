import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

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

      if (result.values.length === 0) {
        return undefined
      }

      const department = result.values[0] as IDepartmentDetailT
      const resultP = await db.query(
        `SELECT products.itemnum,
          products.id,
          products.${nameString} as name,
          packingUnits.${nameString} as unit
         FROM departmentProducts
         INNER JOIN products ON products.id = departmentProducts.product
         INNER JOIN packingUnits ON products.packId = packingUnits.id
         WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND departmentProducts.department = ?`,
        [
          id
        ]
      )

      if (resultP.values.length === 0) {
        department.products = []
      } else {
        department.products = resultP.values as IDepartmentDetailProductT[]
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
  products: IDepartmentDetailProductT[]
}

export interface IDepartmentDetailProductT {
  id: number
  itemnum: string
  name: string
  unit: string
}