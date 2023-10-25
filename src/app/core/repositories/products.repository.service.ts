import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { environment } from 'src/environments/environment'
import { DatabaseService } from '../database.service'
import { Customer, CustomerUserType } from '../user.service'
import { IDepartmentT } from './departments.repository.service'

@Injectable({
  providedIn: 'root'
})
export class ProductsRepositoryService {

  constructor(
    private _db: DatabaseService,
    private logger: LoggingProvider
  ) { }

  get(id?: number): Promise<IProduct[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      let query = 'SELECT * FROM products'
      let params = []

      if (id) {
        query += ' WHERE id = ?'
        params = [id]
      }
      const result = await db.query(
        query,
        params
      )

      return result.values as IProduct[]
    })
  }

  getDetail(id: number, customer: Customer, culture: string): Promise<IProductDetailT> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'
    const descriptionString = culture === 'nl-BE' ? 'descriptionNl' : 'descriptionFr'
    const promoString = culture === 'nl-BE' ? 'promoNl' : 'promoFr'
    const groupNameString = culture === 'nl-BE' ? 'groupNameNl' : 'groupNameFr'

    console.time('getDetail')
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const exists = await db.query(`SELECT id FROM products WHERE id = ?`, [id])

      if (exists.values.length === 0) {
        throw new Error('Product not found!')
      }

      const pr = `EXISTS (SELECT * FROM prices WHERE prices.product = p.id AND ( ( prices.customer = 0 AND prices.address = 0 AND prices.[group] = 0 ) OR ( prices.customer = ?2 AND ( prices.address = ?3 OR prices.address = 0 ) AND prices.[group] = 0 ) OR ( prices.customer = 0 AND prices.address = 0 AND prices.[group] = ?4 ) ) AND prices.promo = 1)`

      const productResult = await db.query(`SELECT p.id,
        p.itemnum,
        p.stackSize,
        p.minOrder,
        p.deliverTime,
        p.c1,
        p.c2,
        p.c3,
        p.c4,
        p.c5,
        p.c6,
        p.ean,
        p.supplierItemIdentifier,
        p.relativeQuantity,
        p.AvailableOn as availableOn,
        p.isNew,
        p.type,
        p.contentQuantity,
        CASE ((fav.hi = 0 OR fav.hi IS NULL) AND fav.id IS NOT NULL) WHEN 1 THEN 1 ELSE 0 END as isFavorite,
        fav.hi as favHidden,
        fav.buy as favA,
        fav.lastA as favLastA,
        fav.lastB as favLastB,
        ${pr} as isPromo,
        p.${nameString} as name,
        pu.${nameString} as unit,
        puc.${nameString} as contentUnit,
        productTexts.${descriptionString} as description,
        productTexts.${promoString} as promo,
        p.url,
        p.color
      FROM products AS p
      INNER JOIN packingUnits AS pu ON p.packId = pu.id
      INNER JOIN productTexts ON p.id = productTexts.id
      LEFT JOIN packingUnits AS puc ON p.contentUnit = puc.id
      LEFT OUTER JOIN favorites AS fav ON fav.id = p.id AND fav.cu = ?2 AND fav.ad = ?3
      WHERE p.id = ?1`,
        [
          id,
          customer.id,
          customer.address,
          customer.addressGroup
        ]
      )

      const product = productResult.values[0] as IProductDetailT

      const attributesResult = await db.query(`
      SELECT attributes.${nameString} as name,
        attributes.${groupNameString} as groupName
      FROM productAttributes
      INNER JOIN attributes ON attributes.attribute = productAttributes.attribute
      WHERE productAttributes.product = ?`, [id])

      const similarProducts = await db.query(`SELECT products.${nameString} as name,
        products.itemnum,
        products.id,
        packingUnits.${nameString} as unit,
        products.url,
        products.color
      FROM productRelations AS rel
      INNER JOIN products ON rel.product = products.id
      INNER JOIN packingUnits ON products.packId = packingUnits.id
      WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND rel.item = ?1 AND rel.type = 2 AND products.id != ?1`, [id])

      const similarProductsA = await db.query(`SELECT products.${nameString} as name,
        products.itemnum,
        products.id,
        packingUnits.${nameString} as unit,
        products.url,
        products.color
      FROM products
      INNER JOIN packingUnits ON products.packId = packingUnits.id
      WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND products.c1 = ? AND products.c2 = ? AND products.c3 = ? AND products.c4 = ? AND products.c5 = ? AND products.c6 = ? AND products.id != ?`, [product.c1, product.c2, product.c3, product.c4, product.c5, product.c6, id])

      const relatedProducts = await db.query(`SELECT products.${nameString} as name,
        products.itemnum,
        products.id,
        packingUnits.${nameString} as unit,
        products.url,
        products.color
      FROM productRelations AS rel
      INNER JOIN products ON rel.product = products.id
      INNER JOIN packingUnits ON products.packId = packingUnits.id
      WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND rel.item = ?1 AND rel.type = 1 AND products.id != ?1`, [id])

      const promoProducts = await db.query(`SELECT products.${nameString} as name,
        products.itemnum,
        products.id,
        packingUnits.${nameString} as unit,
        products.url,
        products.color
      FROM productRelations AS rel
      INNER JOIN products ON rel.product = products.id
      INNER JOIN packingUnits ON products.packId = packingUnits.id
      WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND rel.item = ?1 AND rel.type = 3 AND products.id != ?1`, [id])

      const allergens = await db.query(`SELECT code, value FROM productAllergens WHERE product = ? AND LENGTH(code) > 0`, [id])

      const departments = await db.query(`SELECT dep.id, dep.alias, NULL as products
      FROM departmentProducts
      INNER JOIN departments as dep ON departmentProducts.department = dep.id
      WHERE departmentProducts.product = ? AND dep.userCode = ?`, [id, customer.userCode])

      const taxes = await db.query(`SELECT * FROM productTaxes WHERE product = ?`, [id])

      product.attributes = attributesResult.values as IProductAttributeT[]
      product.similarProducts = (similarProducts.values as IProductInfoT[]).concat(similarProductsA.values as IProductInfoT[])
      product.relatedProducts = relatedProducts.values as IProductInfoT[]
      product.promoProducts = promoProducts.values as IProductInfoT[]
      product.allergens = allergens.values as IProductAllergen[]
      product.departments = departments.values as IDepartmentT[]
      product.taxes = taxes.values as IProductTax[]

      product.isNew = product.isNew == 1
      product.isPromo = product.isPromo == 1
      product.isFavorite = product.isFavorite == 1

      const prices = await this.getPrices(product.id, customer, db, product.minOrder)
      if (prices.basePrice > 0) {
        product.prices = prices.prices
        product.basePrice = prices.basePrice
      } else {
        product.basePrice = 0
        product.prices = []
      }

      // attachments

      console.timeEnd('getDetail')

      delete product.c1
      delete product.c2
      delete product.c3
      delete product.c4
      delete product.c5
      delete product.c6

      return product
    })
  }

  query(culture: string = 'nl-BE', page: number = 0, items: number = 48, filters: any, sortOrder: ISortOrder, params: number[]) {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const pr = `( SELECT promo FROM prices WHERE prices.product = products.id AND ( ( prices.customer = 0 AND prices.address = 0 AND prices.[group] = 0 ) OR ( prices.customer = ?1 AND ( prices.address = ?2 OR prices.address = 0 ) AND prices.[group] = 0 ) OR ( prices.customer = 0 AND prices.address = 0 AND prices.[group] = ?3 ) ) AND prices.stack = 1 ORDER BY address DESC, customer DESC, [group] DESC LIMIT 1 )`

      let query = `SELECT products.id,
        products.nameNl,
        products.nameFr,
        products.minOrder,
        products.stackSize,
        products.itemnum,
        products.${nameString} as name,
        products.[type],
        products.isNew,
        packingUnits.${nameString} as unit,
        EXISTS (SELECT favorites.id FROM favorites WHERE favorites.id = products.id AND favorites.cu = ?1 AND favorites.ad = ?2 AND ( favorites.hi = 0 OR favorites.hi IS NULL )) as isFavorite,
        favorites.lastB as favLastB,
        favorites.lastA as favLastA,
        products.AvailableOn as availableOn,
        ${pr} as isPromo,
        ('${environment.pcm_url}/product-images/dis/' || products.itemnum || '?s=thumb') as url,
        'FFFFFF' as color
      FROM products
      INNER JOIN packingUnits ON products.packId = packingUnits.id
      LEFT OUTER JOIN favorites ON favorites.id = products.id AND favorites.cu = ?1 AND favorites.ad = ?2
      WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id)`

      console.log(filters)

      if (filters.category) {
        params.push(filters.category.id)
        query += ` AND (products.c1 = ?4 OR products.c2 = ?4 OR products.c3 = ?4 OR products.c4 = ?4 OR products.c5 = ?4 OR products.c6 = ?4)`
      }
      if (filters.orderState === 'inactive') {
        query += ` AND ( products.[type] != "B" )`
      }
      if (filters.newState === 'active') {
        query += ` AND ( products.isNew = 1 )`
      }
      if (filters.favoriteState === 'active') {
        query += ` AND EXISTS (SELECT favorites.id FROM favorites WHERE favorites.id = products.id AND favorites.cu = ?1 AND favorites.ad = ?2 AND ( favorites.hi = 0 OR favorites.hi IS NULL ))`
      }
      if (filters.favoriteState === 'inactive') {
        query += ` AND ( ( favorites.hi = 1 ) OR NOT EXISTS (SELECT favorites.id FROM favorites WHERE favorites.id = products.id AND favorites.cu = ?1 AND favorites.ad = ?2) )`
      }
      if (filters.promoState === 'active') {
        query += ` AND ( isPromo = 1 )`
      }
      if (filters.query) {
        const filterQuery: string =  filters.query.replace(/(é|ë|ê|è|ę|ė|ē|É|Ë|Ê|È|Ę|Ė|Ē)/g, 'e')
          .replace(/(á|ä|â|à|ã|å|ā|Á|Ä|Â|À|Ã|Å|Ā)/g, 'a')
          .replace(/(í|ï|ì|î|į|ī|Í|Ï|Ì|Î|Į|Ī)/g, 'i')
          .replace(/(œ|Œ)/g, 'oe')
          .replace(/(ó|ö|ô|ò|õ|ø|ō|Ó|Ö|Ô|Ò|Õ|Ø|Ō)/g, 'o')
          .replace(/(ú|ü|û|ù|ū|Ú|Ü|Û|Ù|Ū)/g, 'u')
          .replace(/(æ|Æ)/g, 'ae')
          .toLowerCase()
        const parts = filterQuery.toLowerCase().replace(/\'/g, '\'\'').split(' ')
        for (const part of parts) {
          if (culture === 'nl-BE') {
            query += ` AND (products.searchNameNl LIKE '%${part}%'`
              + `OR products.itemnum LIKE '%${part}%' `
              + `OR products.searchQueryWordsNl LIKE '%${part}%')`
          } else {
            query += ` AND (products.searchNameFr LIKE '%${part}%' `
              + `OR products.itemnum LIKE '${part}%'`
              + `OR products.searchQueryWordsFr LIKE '%${part}%')`
          }
        }
      }
      if (filters.attributes && filters.attributes.length > 0) {
        for (const filter of filters.attributes) {
          const attributes: number[] = filter.selected
          query += ` AND ( ( SELECT COUNT(*) FROM productAttributes WHERE productAttributes.product = products.id AND (`
          for (let j = 0; j < attributes.length; j++) {
            if (j >= 1) {
              query += ` OR `
            }
            query += ` productAttributes.attribute = ${attributes[j]} `
          }
          query += `) LIMIT 1) > 0 )`
        }
      }

      if (sortOrder === 'favoriteBoughtDate$DESC') {
        query += ` ORDER BY favorites.lastB DESC LIMIT ${page * items}, ${items}`
      } else if (filters.favoriteState === 'active') {
        query += ` ORDER BY SUBSTR(products.itemnum || '0000000000', 1, 10) ASC LIMIT ${page * items}, ${items}`
      } else {
        query += ` ORDER BY sortOrder, SUBSTR(products.itemnum || '0000000000', 1, 10) ASC LIMIT ${page * items}, ${items}`
      }

      this.logger.debug('ProductsRepositoryService.query() -- running statement')
      const result = await db.query(
        query,
        params
      )

      return result.values as IProductT[]
    })
  }

  async getPrices(id: number, customer: any, db: SQLiteDBConnection, minQ?: number) {
    this.logger.debug('ProductsRepositoryService.getPrices(' + id + ')')
    console.log(customer)

    let minQuantity = 1

    if (minQ) {
      minQuantity = minQ
    } else {
      const res = await db.query('SELECT minOrder AS minQuantity FROM products where id = ?', [id])

      if (res.values?.length > 0) {
        minQuantity = res.values[0]['minQuantity']
      }
    }

    try {

      const base = await db.query(
        `SELECT price,
        pricepromo,
        stack,
        promo
      FROM prices
      WHERE product = ? AND customer = 0 AND address = 0 AND [group] = 0`,
        [
          id
        ]
      )

      let result = await db.query(
        `SELECT price,
        pricepromo,
        stack,
        promo
      FROM prices
      WHERE product = ? AND customer = ? AND address = ? AND [group] = 0`,
        [
          id,
          customer.id,
          customer.addressId ?? customer.address
        ]
      )

      if (result.values.length < 0) {
        return this.calculatePricesOverview(minQuantity, customer, base.values, result.values)
      }

      result = await db.query(
        `SELECT price,
        pricepromo,
        stack,
        promo
      FROM prices
      WHERE product = ? AND customer = ? AND address = 0 AND [group] = 0`,
        [
          id,
          customer.id
        ]
      )

      if (result.values.length < 0) {
        return this.calculatePricesOverview(minQuantity, customer, base.values, result.values)
      }

      result = await db.query(
        `SELECT price,
        pricepromo,
        stack,
        promo
      FROM prices
      WHERE product = ? AND customer = 0 AND address = 0 AND [group] = ?`,
        [
          id,
          customer.addressGroupId ?? customer.addressGroup
        ]
      )

      if (result.values.length < 0) {
        return this.calculatePricesOverview(minQuantity, customer, base.values, result.values)
      }

      return this.calculatePricesOverview(minQuantity, customer, base.values, [])

    } catch (err) {
      this.logger.error('ProductsRepositoryService.getPrices() -- error', err)
    }
  }

  async getAttachments(id: number, itemnum: string, culture: string = 'nl-BE',): Promise<IAttachmentCollection> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'
    culture = culture.split('-')[0]
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const datasheets = await db.query(
        `SELECT guid, name
        FROM datasheets
        WHERE products LIKE '%${itemnum}%' AND languages LIKE '%\"${culture}\":true%'`,
        []
      )

      const recipes = await db.query(
        `SELECT guid, name
        FROM recipes
        WHERE products LIKE '%${itemnum}%' AND languages LIKE '%\"${culture}\":true%'`,
        []
      )

      const usageManuals = await db.query(
        `SELECT guid, name
        FROM usageManuals
        WHERE products LIKE '%${itemnum}%' AND languages LIKE '%\"${culture}\":true%'`,
        []
      )

      const recipesModule = await db.query(
        `SELECT id, ${nameString} as name
        FROM recipesModule
        WHERE productId = ?`,
        [id]
      )

      return {
        datasheets: datasheets.values ?? [],
        recipes: recipes.values ?? [],
        usageManuals: usageManuals.values ?? [],
        recipesModule: recipesModule.values ?? []
      }
    })
  }

  private calculatePricesOverview(minQuantity: number, customer: Customer, basePrices: IPrice[], extraPrices: IPrice[]): IProductPricesOverview {
    this.logger.debug('ProductsRepositoryService.calculatePricesOverview()', minQuantity, customer, basePrices, extraPrices)
    let basePrice = 0
    let prices = []
    let isPromo = false
    let bonus = customer.bonusPercentage ?? customer.bonus ?? 0

    if (basePrices.length > 0) {
      isPromo = basePrices.some(e => e.promo) && customer.promo == true
      basePrice = basePrices.find(e => e.stack === minQuantity)?.price ?? 0
    }

    if (extraPrices.length > 0) {
      for (let price of extraPrices) {
        let amount = isPromo ? price.pricepromo : price.price
        amount = Math.round((amount - ((amount * bonus) / 100)) * 100) / 100
        prices.push({
          amount,
          quantity: price.stack,
          discount: (100 - Math.round(Math.abs((amount / basePrice) * 100) * 2.0) / 2.0),
          isPromo
        })
      }
    } else {
      for (let price of basePrices) {
        let amount = isPromo ? price.pricepromo : price.price
        amount = Math.round((amount - ((amount * bonus) / 100)) * 100) / 100
        prices.push({
          amount,
          quantity: price.stack,
          discount: (100 - Math.round(Math.abs((amount / basePrice) * 100) * 2.0) / 2.0),
          isPromo
        })
      }
    }
    this.logger.debug('ProductsRepositoryService.calculatePricesOverview() -- complete', { basePrice, prices })

    return {
      basePrice,
      prices
    }
  }
}

export type ISortOrder = 'itemNum$ASC' | 'favoriteBoughtDate$DESC'

export interface IProduct {
  /* Unique identifier */
  id: number
  groupId: number
  packId: number
  itemnum: string
  nameNl: string
  nameFr: string
  type: string
  isNew: boolean
  c1: number
  c2: number
  c3: number
  c4: number
  c5: number
  c6: number
  stackSize: number
  minOrder: number
  deliverTime: number
  ean: string
  supplierItemIdentifier: string
  relativeQuantity: number
  queryWordsNl: string
  queryWordsFr: string
  sortOrder: number
  AvailableOn?: Date
  contentQuantity?: number
  contentUnit?: number
}

export interface IProductInfoT {
  id: number
  itemnum: string
  name: string
  unit: string
  url: string
  color: string
}

export interface IProductT extends IProductInfoT {
  type: 'B' | string
  isNew: boolean
  isFavorite: boolean
  isPromo: boolean
  availableOn: Date
  favLastB: Date
  favLastA: number
  minOrder: number
  stackSize: number
  amount: number
}

export interface IPdocructFav {
  favHidden: boolean | null
  favA: number,
  favLastB: Date
  favLastA: number
}

export interface IProductCats {
  c1: number
  c2: number
  c3: number
  c4: number
  c5: number
  c6: number
}

export interface IProductDetailT extends IProductInfoT, IProductCats, IProductPricesOverview, IProductOrderInfo {
  description: string
  promo: string
  type: 'B' | string
  isNew: boolean | number
  isPromo: boolean | number
  isFavorite: boolean | number
  availableOn: Date
  deliverTime: number
  ean: string
  supplierItemIdentifier: string
  relativeQuantity: number
  contentQuantity: number
  contentUnit: string
  amount: number
  favHidden: boolean | null
  favA: number
  favLastB: Date
  favLastA: number
  attributes: IProductAttributeT[]
  similarProducts: IProductInfoT[]
  relatedProducts: IProductInfoT[]
  promoProducts: IProductInfoT[]
  allergens: IProductAllergen[]
  departments: IDepartmentT[]
  taxes: IProductTax[]
}

export interface IProductAttributeT {
  name: string
  groupName: string
}

export interface IProductAllergen {
  code: string
  value: string
}

export interface IProductTax {
  product: number
  description: string
  amount: number
  type: string
}

export interface IProductOrderInfo {
  minOrder: number
  stackSize: number
}

export interface IPrice {
  price: number,
  pricepromo: number,
  stack: number,
  promo: boolean
}

export interface IProductPricesOverview {
  basePrice: number
  prices: IProductPrice[]
}

export interface IProductPrice {
  amount: number
  quantity: number
  discount: number
  isPromo: boolean
}

export interface IAttachmentCollection {
  datasheets: IPCMAttachmentEntry[]
  recipes: IPCMAttachmentEntry[]
  usageManuals: IPCMAttachmentEntry[]
  recipesModule: IRecipeModuleEntry[]
}

export interface IPCMAttachmentEntry {
  guid: string
  name: string
}

export interface IRecipeModuleEntry {
  id: number
  name: string
}