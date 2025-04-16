import { Injectable } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CategoriesRepositoryService {

  constructor(private _db: DatabaseService) {
  }

  get(culture: string = 'nl-BE'): Promise<ICategoryT[]> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT categories.id, categories.${nameString} as name
         FROM categories`
      )

      return result.values as ICategoryT[]
    })
  }

  getAssortment(culture: string = 'nl-BE', id?: number): Promise<ICategoryT[]> {
    const nameString: 'nameNl' | 'nameFr' = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      let result

      if (!id) {
        result = await db.query(
          'SELECT cat1.id as id_parent, ' +
          ' cat1.' + nameString + ' AS name_parent, ' +
          ' cat2.id, ' +
          ' cat2.parentId, ' +
          ' cat2.' + nameString + ' as name ' +
          // ' (SELECT COUNT(products.id)' +
          // '  FROM products' +
          // '  WHERE (products.c1 = cat2.id OR products.c2 = cat2.id OR products.c3 = cat2.id OR products.c4 = cat2.id OR products.c5 = cat2.id OR products.c6 = cat2.id)' +
          // '    AND EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id)' +
          // ' ) as products ' +
          'FROM categories AS cat1 ' +
          'INNER JOIN categories AS cat2 ON cat2.parentId = cat1.id ' +
          'WHERE cat1.parentId IS NULL ' +
          'ORDER BY cat1.position, cat2.position'
        )
      } else {
        result = await db.query(
          'SELECT cat1.id as id_parent, ' +
          ' cat1.' + nameString + ' AS name_parent, ' +
          ' cat2.id, ' +
          ' cat2.parentId, ' +
          ' cat2.' + nameString + ' as name, ' +
          ' (SELECT COUNT(products.id)' +
          '  FROM products' +
          '  WHERE (products.c1 = cat2.id OR products.c2 = cat2.id OR products.c3 = cat2.id OR products.c4 = cat2.id OR products.c5 = cat2.id OR products.c6 = cat2.id)' +
          '    AND EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id)' +
          ' ) as products ' +
          'FROM categories AS cat1 ' +
          'INNER JOIN categories AS cat2 ON cat2.parentId = cat1.id ' +
          'WHERE cat1.id = ? ' +
          'ORDER BY cat1.position, cat2.position',
          [
            id
          ]
        )
      }

      return result.values.reduce((prev: ICategoryT[], category: any) => {
        const cat: ICategoryT = prev.find((x: ICategoryT): boolean => x.id === category.id_parent)
        if (cat) {
          cat.categories.push({
            id: category.id,
            name: category.name,
            parentId: category.parentId,
            products: category.products
          })
        } else {
          prev.push({
            id: category.id_parent,
            name: category.name_parent,
            categories: [{
              id: category.id,
              name: category.name,
              parentId: category.parentId,
              products: category.products
            }]
          })
        }
        return prev
      }, [])
      // return categories
    })
  }

  find(id: number, culture: string = 'nl-BE'): Promise<ICategoryT> {
    const nameString: 'nameNl' | 'nameFr' = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection): Promise<ICategoryT> => {
      const result: DBSQLiteValues = await db.query(
        `SELECT categories.id, categories.${nameString} as name
         FROM categories
         WHERE categories.id = ?
         ORDER BY categories.position`,
        [
          id
        ]
      )

      return result.values[0] as ICategoryT
    })
  }

  findChildren(id: number, culture: string = 'nl-BE'): Promise<ICategoryT[]> {
    const nameString: 'nameNl' | 'nameFr' = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection): Promise<ICategoryT[]> => {
      const result: DBSQLiteValues = await db.query(
        `SELECT categories.id, categories.${nameString} as name
         FROM categories
         WHERE categories.parentId = ?
         ORDER BY categories.position`,
        [
          id
        ]
      )

      return result.values as ICategoryT[]
    })
  }

  async getAssortmentCounts(categories: ICategoryT[]): Promise<void> {
    // get all allowed products from db
    return this._db.executeQuery<void>(async (db: SQLiteDBConnection): Promise<void> => {
      const products = await db.query('SELECT products.c1, products.c2, products.c3, products.c4, products.c5, products.c6 FROM products WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id)')

      for (const category of categories) {
        for (const sub of category.categories) { // p.c1 === sub.id ||    || p.c5 === sub.id || p.c6 === sub.id
          sub.products = products.values.filter(p => p.c2 === sub.id || p.c3 === sub.id || p.c4 === sub.id).length
        }
      }
    })
  }
}

export interface ICategoryT {
  id: number
  name: string
  categories: ICategoryST[]
}

export interface ICategoryST {
  id: number
  name: string
  parentId: number
  products: number
}
