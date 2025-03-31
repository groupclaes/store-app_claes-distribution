import { environment } from './../../environments/environment'
import { ApiService, trimParameters } from './api.service'
import { Injectable } from '@angular/core'
import { LoggingProvider } from '../@shared/logging/log.service'
import { StorageProvider } from './storage-provider.service'
import { capSQLiteSet, Changes, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from './database.service'
import { AppCredential, AppCustomerModel, Customer, UserService } from './user.service'
import { timeout } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import { Filesystem, Directory } from '@capacitor/filesystem'

const TIMEOUT_INTERVAL = 240000

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private _checksum: Array<Store> = []

  constructor(
    private api: ApiService,
    private storage: StorageProvider,
    private logger: LoggingProvider,
    private _db: DatabaseService
  ) { }


  private get checksum(): Array<Store> {
    return this._checksum || new Array<Store>()
  }

  dropTables(): Promise<any> {
    this.logger.info('Dropping all tables')
    return this._db.executeQuery(async (db: SQLiteDBConnection) => {
      const tablesToDrop = [
        'images',
        'productTexts', 'productAttributes', 'productAllergens',
        'productExceptions', 'currentExceptions', 'productRelations', 'productTaxes',
        'products',

        'prices', 'packingUnits', 'favorites', 'attributes',
        'reports', 'recipes', 'datasheets', 'usageManuals',

        'departments', 'departmentProducts',
        'categoryAttributes', 'categories',

        'notes', 'contacts', 'shippingCosts', 'deliverySchedules',
        'customers', 'productDescriptionCustomers', 'recipesModule',
        'news', 'dataIntegrityChecksums'
      ]

      for (const table of tablesToDrop) {
        this.logger.debug('Dropping table', table)
        try {
          await db.execute('DROP TABLE IF EXISTS ' + table)
        } catch (err) {
          this.logger.error('Could not drop table', table, err.message)
        }
      }
    })
  }

  async checkDB(): Promise<boolean> {
    let ok = false

    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      ok = true

      await db.execute('DROP TABLE IF EXISTS images')
      await db.execute('CREATE TABLE IF NOT EXISTS dataIntegrityChecksums '
        + '(dataTable STRING PRIMARY KEY, checksum STRING, dateChanged DATETIME);'
        + 'CREATE UNIQUE INDEX IF NOT EXISTS idx_dataIntegrityChecksums_dataTable ON dataIntegrityChecksums(dataTable)')

      const version = this.storage.get('_db_version')
      this.logger.log(`database ${environment.database_name} has been opened in CheckDB!`, version)
    })

    return ok
  }

  async initialize(): Promise<boolean> {
    this.logger.log(`SyncService.Initialize() -- start`)
    const check = await this.checkDB()
    this.logger.log(`SyncService.Initialize() -- after checkdb`)
    const checksum = await this.loadIntegrity()
    this.logger.log(`SyncService.Initialize() -- loaded integrity checksum: ${checksum}`)

    if (!checksum) {
      // this is first run or db issue, add loggin here in future versions
      return check
    }

    this.logger.log(`SyncService.Initialize() -- end`)
    return checksum && check
  }

  public async loadIntegrity(): Promise<boolean> {
    this.logger.log(`SyncService.loadIntegrity() -- start`)
    const result = []

    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      const sqlResult = await db.query(`SELECT * FROM dataIntegrityChecksums`)
      this.logger.log(`SyncService.loadIntegrity() -- after select`)

      if (!sqlResult.values || sqlResult.values.length <= 0) {
        return false
      }

      for (const value of sqlResult.values as Store[]) {
        value.dateChanged = new Date(value.dateChanged) || new Date()
        result.push(value)
      }
    })

    this._checksum = result

    this.logger.log(`SyncService.loadIntegrity() -- end`)
    return true
  }

  /**
   * Full sync procedure for app db
   *
   * @param credential user credentials to determine data-access
   * @param culture cultures thet will be synced to db
   * @param force if true syncronisation and rebuld of table will be forced
   * @memberof SyncService
   */
  public async fullSync(credential: AppCredential, culture?: string, forceSync?: boolean, activeUser?: Customer, user_id?: number) {
    this.logger.log(`SyncService.FullSync() -- start`)
    culture = culture || 'all'

    return new Promise<boolean>(async (resolve, reject) => {
      const timertje = setTimeout(() => reject('timeout_err'), TIMEOUT_INTERVAL)

      this.logger.log('SyncService.FullSync() -- await promises')

      // We used to do a single full sync (running all calls at the same time)
      // But this concurrency is not handled well in the 'new' Capacitor SQLite library, so we changed this to be in 4 steps

      await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
        this.logger.log('CREATE TABLE IF NOT EXISTS customers')
        await db.execute('CREATE TABLE IF NOT EXISTS customers '
          + '(id INTEGER, addressId INTEGER, addressGroupId INTEGER, userCode INTEGER, userType INTEGER, name STRING, '
          + 'address STRING, streetNum STRING, zipCode STRING, city STRING, country STRING, phoneNum STRING, vatNum STRING, '
          + 'language STRING, promo BOOLEAN, fostplus BOOLEAN, bonusPercentage REAL, addressName STRING, delvAddress STRING, '
          + 'delvStreetNum STRING, delvZipCode STRING, delvCity STRING, delvCountry STRING, delvPhoneNum STRING, '
          + 'delvLanguage STRING, PRIMARY KEY (id, addressId))', false)
        this.logger.log('CREATE TABLE IF NOT EXISTS productDescriptionCustomers')
        await db.execute('CREATE TABLE IF NOT EXISTS productDescriptionCustomers (id INTEGER PRIMARY KEY, description STRING)', false)

        await this.updateDataIntegrityChecksum(db, 'lastSync', 'distribution-checksum-sha')
      })

      let results: any[]

      if (user_id) {
        const step1 = await Promise.all([
          this.syncProducts(user_id, culture, forceSync),
          this.syncPackingUnits(user_id, culture, forceSync),
          this.syncAttributes(user_id, culture, forceSync),
          this.syncProductRelations(user_id, culture, forceSync),
          this.syncCategories(user_id, culture, forceSync),
          this.syncCategoryAttributes(user_id, culture, forceSync)
        ])

        const step2 = await Promise.all([
          this.syncFavorites(user_id, culture, forceSync, activeUser?.id, activeUser?.address),
          this.syncPrices(user_id, culture, forceSync, activeUser?.id, activeUser?.address),
          this.syncProductExceptions(user_id, culture, forceSync),
          this.syncProductTaxes(user_id, culture, forceSync),
          this.syncShippingCosts(user_id, culture, forceSync),
          this.syncProductDescriptionCustomers(user_id, culture, forceSync),
          this.syncNews(user_id, culture, forceSync)
        ])

        const step3 = await Promise.all([
          this.syncReports(user_id, culture, forceSync),
          this.syncRecipes(user_id, culture, forceSync),
          this.syncDatasheets(user_id, culture, forceSync),
          this.syncUsageManuals(user_id, culture, forceSync),
          this.syncRecipesModule(user_id, culture, forceSync)
        ])

        const step4 = await Promise.all([
          this.syncContacts(user_id, culture, forceSync),
          this.syncDeliverySchedules(user_id, culture, forceSync),
          this.syncCustomers(user_id, culture, forceSync),
          this.syncNotes(user_id, culture, forceSync)
        ])

        await this.syncDepartments(user_id, culture, forceSync)

        results = step1.concat(step2, step3, step4)
      } else {
        const step1 = await Promise.all([
          this.syncProducts(user_id, culture, forceSync),
          this.syncPackingUnits(user_id, culture, forceSync),
          this.syncProductRelations(user_id, culture, forceSync),
          this.syncProductExceptions(user_id, culture, forceSync)
        ])

        const step2 = await Promise.all([
          this.syncCategories(user_id, culture, forceSync),
          this.syncCategoryAttributes(user_id, culture, forceSync),
          this.syncAttributes(user_id, culture, forceSync)
        ])

        results = step1.concat(step2)
      }

      this.logger.log('SyncService.FullSync() -- promises completed')

      window.clearTimeout(timertje)
      if (results.some(e => e === 'timeout_err')) {
        return reject('timeout_err')
      }

      const checksum = await this.loadIntegrity()

      this.logger.log(`SyncProvider.FullSync() -- end`)
      return resolve(checksum)
    })
  }

  async syncProducts(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProducts()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'products')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('products', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.products) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS products')
          await db.execute('DROP TABLE IF EXISTS productTexts')
          await db.execute('DROP TABLE IF EXISTS productAttributes')
          await db.execute('DROP TABLE IF EXISTS productAllergens')

          await db.execute('CREATE TABLE IF NOT EXISTS products '
            + '(id INTEGER PRIMARY KEY, groupId INTEGER, packId INTEGER, itemnum STRING, nameNl STRING, '
            + 'nameFr STRING, [type] STRING, isNew BOOLEAN, c1 INTEGER, c2 INTEGER, c3 INTEGER, c4 INTEGER, '
            + 'c5 INTEGER, c6 INTEGER, stackSize INTEGER, minOrder INTEGER, deliverTime INTEGER, ean STRING, '
            + 'supplierItemIdentifier STRING, relativeQuantity INTEGER, queryWordsNl STRING, queryWordsFr STRING, '
            + 'sortOrder INTEGER, AvailableOn DateTime NULL, contentQuantity INTEGER NULL, contentUnit INTEGER NULL, '
            + 'url STRING, color STRING NULL, searchQueryWordsNl STRING, searchQueryWordsFr STRING, searchNameNl STRING, '
            + 'searchNameFr STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS productTexts '
            + '(id INTEGER PRIMARY KEY, descriptionNl STRING, descriptionFr STRING, groupNameNl STRING, '
            + 'groupNameFr STRING, PromoNl STRING, PromoFr STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS productAttributes '
            + '(attribute INTEGER, product INTEGER, PRIMARY KEY (attribute, product))')
          await db.execute('CREATE TABLE IF NOT EXISTS productAllergens '
            + '(product INTEGER, code STRING, value STRING, PRIMARY KEY (product, code))')
          await db.execute('DROP INDEX IF EXISTS products_category_ids')
          await db.execute('CREATE INDEX IF NOT EXISTS products_category_ids ON products (c1, c2, c3, c4, c5, c6)')
          await db.execute('DROP INDEX IF EXISTS products_itemnum')
          await db.execute('CREATE INDEX IF NOT EXISTS products_itemnum ON products (id, itemnum)')

          const sqlStatements: capSQLiteSet[] = []
          response.data.products.forEach(async (product: any) => {
            const nameNl: string = (product.name && product.name.nl) ? product.name.nl : null
            const nameFr: string = (product.name && product.name.fr) ? product.name.fr : null
            const descriptionNl: string = (product.description && product.description.nl) ? product.description.nl : null
            const descriptionFr: string = (product.description && product.description.fr) ? product.description.fr : null
            const groupNameNl: string = (product.groupName && product.groupName.nl) ? product.groupName.nl : null
            const groupNameFr: string = (product.groupName && product.groupName.fr) ? product.groupName.fr : null
            const promoNl: string = (product.promotext && product.promotext.nl) ? product.promotext.nl : null
            const promoFr: string = (product.promotext && product.promotext.fr) ? product.promotext.fr : null
            const supplierItemIdentifier: string = product.supplierItemIdentifier ? product.supplierItemIdentifier : null
            const queryWordsNl: string = product.queryWords && product.queryWords.nl ? product.queryWords.nl : null
            const queryWordsFr: string = product.queryWords && product.queryWords.fr ? product.queryWords.fr : null

            const query = 'INSERT INTO products VALUES '
              + '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' // 30
            const textQuery = 'INSERT INTO productTexts VALUES (?, ?, ?, ?, ?, ?, ?)' // 7
            const param = [
              product.id,
              product.groupId,
              product.packId,
              product.itemnum,
              nameNl,
              nameFr,
              product.type,
              product.isNew ? 1 : 0,
              product.c1,
              product.c2,
              product.c3,
              product.c4,
              product.c5,
              product.c6,
              product.stackSize,
              product.minOrder,
              product.deliverTime,
              product.ean,
              supplierItemIdentifier,
              product.relativeQuantity,
              queryWordsNl,
              queryWordsFr,
              product.sortOrder,
              product.availableOn,
              product.contentQuantity,
              product.contentUnit,
              product.url,
              product.color != null ?
                (product.color.startsWith('rgb') ? product.color : '#' + product.color) : null,
              queryWordsNl != null ? this.filterDiacritics(queryWordsNl) : null,
              queryWordsFr != null ? this.filterDiacritics(queryWordsFr) : null,
              nameNl != null ? this.filterDiacritics(nameNl) : null,
              nameFr != null ? this.filterDiacritics(nameFr) : null
            ]
            const textParam = [
              product.id,
              descriptionNl,
              descriptionFr,
              groupNameNl,
              groupNameFr,
              promoNl,
              promoFr
            ]
            sqlStatements.push({ statement: query, values: param })
            sqlStatements.push({ statement: textQuery, values: textParam })
            product.attributes?.forEach((attribute: { id: number }) => {
              sqlStatements.push({
                statement: 'INSERT INTO productAttributes VALUES (?, ?)', values: [
                  attribute.id,
                  product.id
                ]
              })
            })
            if (product.allergens) {
              product.allergens.forEach((allergen: { code: any, value: any }) => {
                sqlStatements.push({
                  statement: 'INSERT INTO productAllergens VALUES (?, ?, ?)', values: [
                    product.id,
                    allergen.code,
                    allergen.value
                  ]
                })
              })
            }
          })
          this.logger.debug(`Inserting ${sqlStatements.length} records into various product tables`)
          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)
          this.logger.log('inserted products; checksum', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'products', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncProducts() -- no changes`)
      }

      return true
    } catch (err) {
      if (err.status === 204) {
        return err
      }
      return 'timeout_err'
    }
  }

  async syncPrices(user_id: number, culture?: string, force?: boolean,
    customer_id?: number, address_id?: number) {
    try {
      this.logger.log(`SyncProvider.syncPrices() -- customer_id: ${customer_id}, address_id: ${address_id}`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'prices')?.checksum ?? '',
        customer_id,
        address_id,
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('prices', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.prices) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS prices')

          await db.execute('CREATE TABLE IF NOT EXISTS prices '
            + '(product INTEGER, price REAL, pricepromo REAL, stack INTEGER, promo BOOLEAN, discount REAL, '
            + 'customer INTEGER, address INTEGER, [group] INTEGER, PRIMARY KEY (product, customer, address, [group], stack))')
          this.logger.log('dropped prices', 'inserts todo: ', response.data.length)

          let sqlStatements: capSQLiteSet[] = []
          if (response.data.length > 40000) {
            const arrays = this.chunkArray(response.data.prices, 40000)
            arrays.forEach(async (array: any[]) => {
              sqlStatements = []
              array.forEach(async (price: $TSFixMe) => {
                sqlStatements.push({
                  statement: 'INSERT INTO prices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  values: [
                    price.product,
                    price.price,
                    price.pricepromo,
                    price.stack,
                    price.promo ? 1 : 0,
                    price.discount,
                    price.customer,
                    price.address,
                    price.group
                  ]
                })
              })
              await db.executeSet(sqlStatements)
              this.logger.log('inserted', array.length, 'prices')
            })
          } else if (response.data.length > 0) {
            response.data.prices.forEach((price: $TSFixMe) => {
              sqlStatements.push({
                statement: 'INSERT INTO prices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                values: [
                  price.product,
                  price.price,
                  price.pricepromo,
                  price.stack,
                  price.promo ? 1 : 0,
                  price.discount,
                  price.customer,
                  price.address,
                  price.group
                ]
              })
            })
            await db.executeSet(sqlStatements)
          }

          this.logger.log('inserted prices', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'prices', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncPrices() -- no changes`)
      }
      return true
    } catch (err) {

    }
  }

  async syncPackingUnits(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncPackingUnits()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'packingUnits')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('packing-units', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.packing_units) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS packingUnits')

          await db.execute('CREATE TABLE IF NOT EXISTS packingUnits (id INTEGER PRIMARY KEY, nameNl STRING, nameFr STRING)')

          const sqlStatements: capSQLiteSet[] = []
          response.data.packing_units.forEach((unit: $TSFixMe) => {
            const nameNl: string = (unit.name && unit.name.nl) ? unit.name.nl : null
            const nameFr: string = (unit.name && unit.name.fr) ? unit.name.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO packingUnits VALUES (?, ?, ?)',
              values: [
                unit.id,
                nameNl,
                nameFr
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted packing-units', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'packingUnits', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncPackingUnits() -- no changes`)
      }
      return true
    } catch (err) {

    }
  }

  async syncFavorites(user_id: number, culture?: string, force?: boolean, customer_id?: number, address_id?: number) {
    try {
      this.logger.log(`SyncProvider.syncFavorites()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'favorites')?.checksum ?? '',
        customer_id,
        address_id,
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('favorites', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.favorites) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS favorites')

          await db.execute('CREATE TABLE IF NOT EXISTS favorites '
            + '(id INTEGER, cu INTEGER, ad INTEGER, buy INTEGER, pro INTEGER, ret INTEGER, lastB DateTime, '
            + 'lastA INTEGER, hi BOOLEAN, PRIMARY KEY (id, cu, ad))')

          this.logger.log('dropped favorites', 'inserts todo: ', response.data.length)
          let sqlStatements: capSQLiteSet[] = []
          if (response.data.favorites.length > 40000) {
            const arrays = this.chunkArray(response.data.favorites, 40000)
            arrays.forEach(async (array: any[]) => {
              sqlStatements = []
              array.forEach((favorite: $TSFixMe) => {
                sqlStatements.push({
                  statement: 'INSERT OR IGNORE INTO favorites VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  values: [
                    favorite.id,
                    favorite.cu,
                    favorite.ad,
                    favorite.buy,
                    favorite.pro,
                    favorite.ret,
                    favorite.lastB,
                    favorite.lastA,
                    favorite.hi ? 1 : 0
                  ]
                })
              })
              await db.executeSet(sqlStatements)
              this.logger.log('inserted', array.length, 'favorites')
            })
          } else if (response.data.length > 0) {
            response.data.favorites.forEach((favorite: $TSFixMe) => {
              sqlStatements.push({
                statement: 'INSERT OR IGNORE INTO favorites VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                values: [
                  favorite.id,
                  favorite.cu,
                  favorite.ad,
                  favorite.buy,
                  favorite.pro,
                  favorite.ret,
                  favorite.lastB,
                  favorite.lastA,
                  favorite.hi ? 1 : 0
                ]
              })
            })
            await db.executeSet(sqlStatements)
          }

          this.logger.log('inserted favorites', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'favorites', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncFavorites() -- no changes`)
      }
      return true
    } catch (err) {
    }
  }

  async syncProductExceptions(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductExceptions()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productExceptions')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('products/exceptions', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.product_exceptions) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productExceptions')
          // We used to delete currentExceptions, due to unexpected outcome we changed this temporarily untill a fix is implemented
          await db.execute('DROP TABLE IF EXISTS currentExceptions')

          await db.execute('CREATE TABLE IF NOT EXISTS productExceptions '
            + '(customer INTEGER, address INTEGER, addressGroup INTEGER, deny BOOLEAN, list STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS currentExceptions (productId INTEGER PRIMARY KEY)')

          this.logger.log('dropped productExceptions')

          const sqlStatements: capSQLiteSet[] = []

          response.data.product_exceptions.forEach((excecption: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productExceptions VALUES (?, ?, ?, ?, ?)',
              values: [
                excecption.customer,
                excecption.address,
                excecption.addressGroup,
                excecption.deny ? 1 : 0,
                excecption.list
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted productExceptions', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'productExceptions', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductExceptions() -- no changes`)
      }

      return true
    } catch (err) {

    }
  }

  async syncAttributes(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncAttributes()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'attributes')?.checksum ?? ''
      })

      const response = await firstValueFrom(
        this.api.sync<any>('attributes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.attributes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS attributes')

          await db.execute('CREATE TABLE IF NOT EXISTS attributes '
            + '(id INTEGER PRIMARY KEY, attribute INTEGER, [group] INTEGER, nameNl STRING, '
            + 'nameFr STRING, groupNameNl STRING, groupNameFr STRING)')

          this.logger.log('dropped attributes')

          const sqlStatements: capSQLiteSet[] = []

          response.data.attributes.forEach((attribute: $TSFixMe) => {
            const nameNl: string = (attribute.name && attribute.name.nl) ? attribute.name.nl : null
            const nameFr: string = (attribute.name && attribute.name.fr) ? attribute.name.fr : null
            const groupNameNl: string = (attribute.groupName && attribute.groupName.nl) ? attribute.groupName.nl : null
            const groupNameFr: string = (attribute.groupName && attribute.groupName.fr) ? attribute.groupName.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO attributes VALUES (?, ?, ?, ?, ?, ?, ?)',
              values: [
                attribute.id,
                attribute.attribute,
                attribute.group,
                nameNl,
                nameFr,
                groupNameNl,
                groupNameFr
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted attributes', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'attributes', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncAttributes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCategoryAttributes(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncCategoryAttributes()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'categoryAttributes')?.checksum ?? ''
      })

      const response = await firstValueFrom(
        this.api.sync<any>('categories/attributes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.category_attributes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS categoryAttributes')

          await db.execute('CREATE TABLE IF NOT EXISTS categoryAttributes '
            + '(categoryId INTEGER, groupId INTEGER, PRIMARY KEY (categoryId, groupId))')

          this.logger.log('dropped categoryAttributes')

          const sqlStatements: capSQLiteSet[] = []

          response.data.category_attributes.forEach((categoryAttribute: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO categoryAttributes VALUES (?, ?)',
              values: [
                categoryAttribute.categoryId,
                categoryAttribute.groupId
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted categoryAttributes', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'categoryAttributes', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncCategoryAttributes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncProductRelations(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductRelations()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productRelations')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('products/relations', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.product_relations) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productRelations')

          await db.execute('CREATE TABLE IF NOT EXISTS productRelations '
            + '(item INTEGER, product INTEGER, type INTEGER, PRIMARY KEY (item, product, type))')

          this.logger.log('dropped productRelations')

          const sqlStatements: capSQLiteSet[] = []

          response.data.product_relations.forEach((productRelation: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productRelations VALUES (?, ?, ?)',
              values: [
                productRelation.item,
                productRelation.product,
                productRelation.type
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted productRelations', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'productRelations', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductRelations() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncReports(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncReports()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'reports')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('reports', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.reports) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS reports')

          await db.execute('CREATE TABLE IF NOT EXISTS reports '
            + '(id INTEGER PRIMARY KEY, extension INTEGER, nameNl STRING, nameFr STRING, onlyAgent BOOLEAN)')

          const sqlStatements: capSQLiteSet[] = []

          response.data.reports.forEach((report: $TSFixMe) => {
            const nameNl: string = (report.name && report.name.nl) ? report.name.nl : null
            const nameFr: string = (report.name && report.name.fr) ? report.name.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO reports VALUES (?, ?, ?, ?, ?)',
              values: [
                report.id,
                report.extension,
                nameNl,
                nameFr,
                report.onlyAgent ? 1 : 0
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted reports', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'reports', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncReports() -- no changes`)
      }


      return true
    } catch (err) {
    }
  }

  async syncRecipes(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncRecipes()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'recipes')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('pcm/recipes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.recipes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS recipes')

          await db.execute('CREATE TABLE IF NOT EXISTS recipes (guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped recipes')

          const sqlStatements: capSQLiteSet[] = []

          response.data.recipes.forEach((recipe: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO recipes VALUES (?, ?, ?, ?)',
              values: [
                recipe.guid,
                recipe.name,
                JSON.stringify(recipe.languages),
                JSON.stringify(recipe.products)
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted recipes', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'recipes', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncRecipes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDatasheets(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDatasheets()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'datasheets')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('pcm/datasheets', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.datasheets) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS datasheets')

          await db.execute('CREATE TABLE IF NOT EXISTS datasheets '
            + '(guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped datasheets')

          const sqlStatements: capSQLiteSet[] = []

          response.data.datasheets.forEach((datasheet: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO datasheets VALUES (?, ?, ?, ?)',
              values: [
                datasheet.guid,
                datasheet.name,
                JSON.stringify(datasheet.languages),
                JSON.stringify(datasheet.products)
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted datasheets', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'datasheets', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncDatasheets() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncUsageManuals(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncUsageManuals()`)
      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'usageManuals')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('pcm/usage-manuals', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.usage_manuals) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS usageManuals')

          await db.execute('CREATE TABLE IF NOT EXISTS usageManuals '
            + '(guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped usageManuals')

          const sqlStatements: capSQLiteSet[] = []

          response.data.usage_manuals.forEach((usageManual: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO usageManuals VALUES (?, ?, ?, ?)',
              values: [
                usageManual.guid,
                usageManual.name,
                JSON.stringify(usageManual.languages),
                JSON.stringify(usageManual.products)
              ]
            })
          })

          console.debug(sqlStatements, response.data.length)

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted usageManuals', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'usageManuals', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncUsageManuals() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDepartments(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDepartments()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'departments')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('departments', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.departments) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS departments')
          await db.execute('DROP TABLE IF EXISTS departmentProducts')

          await db.execute('CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, userCode INTEGER, alias STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS departmentProducts '
            + '(department INTEGER, product INTEGER, PRIMARY KEY (department, product))')

          this.logger.warn('dropped departments', response.data)

          const sqlStatements: capSQLiteSet[] = []

          for (const department of response.data.departments) {
            sqlStatements.push({
              statement: 'INSERT INTO departments VALUES (?, ?, ?)',
              values: [
                department.id,
                department.userCode,
                department.alias
              ]
            })
            if (department.products)
              for (const product of department.products) {
                sqlStatements.push({
                  statement: 'INSERT INTO departmentProducts VALUES (?, ?)',
                  values: [department.id, product.id]
                })
              }
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)

          this.logger.warn('inserted departments', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'departments', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncDepartments() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCategories(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.debug(`SyncProvider.syncCategories()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'categories')?.checksum ?? ''
      })

      const response = await firstValueFrom(
        this.api.sync<any>('categories', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.categories) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          const dropResult = await db.execute('DROP TABLE IF EXISTS categories')

          await db.execute('CREATE TABLE IF NOT EXISTS categories '
            + '(id INTEGER PRIMARY KEY, parentId INTEGER NULL, position INTEGER, nameNl STRING, '
            + 'nameFr STRING, descriptionNl STRING, descriptionFr STRING)')

          this.logger.debug('dropped categories')

          const sqlStatements: capSQLiteSet[] = []

          response.data.categories.forEach((category: $TSFixMe) => {
            const nameNl: string = (category.name && category.name.nl) ? category.name.nl : null
            const nameFr: string = (category.name && category.name.fr) ? category.name.fr : null
            const descriptionNl: string = (category.description && category.description.nl) ? category.description.nl : null
            const descriptionFr: string = (category.description && category.description.fr) ? category.description.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?, ?)',
              values: [
                category.id,
                category.parentId,
                category.position,
                nameNl,
                nameFr,
                descriptionNl,
                descriptionFr
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements).catch(err => {
              this.logger.error(err)
            })
          this.logger.debug('inserted categories', response.data.length, response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'categories', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncCategories() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncNotes(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncNotes()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'notes')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('notes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.notes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS notes')
          await db.execute('CREATE TABLE IF NOT EXISTS notes (customer INTEGER, address INTEGER, date DATETIME, text STRING NULL)')
          await db.execute('CREATE TABLE IF NOT EXISTS unsentNotes ('
            + 'id INTEGER PRIMARY KEY AUTOINCREMENT, customer INTEGER, address INTEGER, date DATETIME, text STRING NULL,'
            + 'nextVisit DATETIME NULL, customerCloseFrom DATETIME NULL, customerOpenFrom DATETIME NULL, toSend BOOLEAN)')
          this.logger.log('dropped notes')

          const sqlStatements: capSQLiteSet[] = []

          for (const note of response.data.notes) {
            sqlStatements.push({
              statement: 'INSERT INTO notes VALUES (?, ?, ?, ?)',
              values: [
                note.customer,
                note.address,
                note.date,
                note.text
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)

          this.logger.log('inserted notes', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'notes', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncNotes() -- no changes`)
      }

      return true
    } catch (err) {
      this.logger.error('Couldn\'t sync notes', JSON.stringify(err))
    }
  }

  async syncProductTaxes(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductTaxes()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productTaxes')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('products/taxes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.product_taxes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productTaxes')
          await db.execute('CREATE TABLE IF NOT EXISTS productTaxes (product INTEGER, description STRING, amount REAL, type STRING)')

          this.logger.log('dropped productTaxes')

          const sqlStatements: capSQLiteSet[] = []

          response.data.product_taxes.forEach((productTax: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productTaxes VALUES (?, ?, ?, ?)',
              values: [
                productTax.product,
                productTax.description,
                productTax.amount,
                productTax.type
              ]
            })
          })

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted productTaxes', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'productTaxes', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductTaxes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncShippingCosts(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncShippingCosts()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'shippingCosts')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('shipping-costs', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.shipping_costs) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS shippingCosts')
          await db.execute('CREATE TABLE IF NOT EXISTS shippingCosts '
            + '(customerId INTEGER, addressId INTEGER, amount REAL, threshold INTEGER)')

          this.logger.log('dropped shippingCosts')

          const sqlStatements: capSQLiteSet[] = []

          for (const shippingCost of response.data.shipping_costs) {
            sqlStatements.push({
              statement: 'INSERT INTO shippingCosts VALUES (?, ?, ?, ?)',
              values: [
                shippingCost.customerId,
                shippingCost.addressId,
                shippingCost.amount,
                shippingCost.threshold
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)

          this.logger.log('inserted shippingCosts', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'shippingCosts', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncShippingCosts() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncContacts(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncContacts()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'contacts')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('contacts', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.contacts) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS contacts')
          await db.execute('CREATE TABLE IF NOT EXISTS contacts '
            + '(id INTEGER, customerId INTEGER, addressId INTEGER, firstName STRING, name STRING, '
            + 'mailAddress STRING, mobileNr STRING, ordConf BOOLEAN, bonus BOOLEAN, invoice BOOLEAN, '
            + 'reminder BOOLEAN, domicilation BOOLEAN, comMailing BOOLEAN, PRIMARY KEY (id, customerId, addressId))')

          this.logger.log('dropped contacts')

          const sqlStatements: capSQLiteSet[] = []

          for (const contact of response.data.contacts) {
            sqlStatements.push({
              statement: 'INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                contact.id,
                contact.customerId,
                contact.addressId,
                contact.firstName,
                contact.name,
                contact.mailAddress,
                contact.mobileNr,
                contact.ordConf ? 1 : 0,
                contact.bonus ? 1 : 0,
                contact.invoice ? 1 : 0,
                contact.reminder ? 1 : 0,
                contact.domicilation ? 1 : 0,
                contact.comMailing ? 1 : 0
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)
          this.logger.log('inserted contacts', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'contacts', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncContacts() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDeliverySchedules(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDeliverySchedules()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'deliverySchedules')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('delivery-schedules', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.delivery_schedules) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS deliverySchedules')
          await db.execute('CREATE TABLE IF NOT EXISTS deliverySchedules '
            + '(customerId INTEGER, addressId INTEGER, monAMFr STRING, monAMTo STRING, monPMFr STRING, monPMTo STRING, '
            + 'tueAMFr STRING, tueAMTo STRING, tuePMFr STRING, tuePMTo STRING, wedAMFr STRING, wedAMTo STRING, wedPMFr STRING, '
            + 'wedPMTo STRING, thuAMFr STRING, thuAMTo STRING, thuPMFr STRING, thuPMTo STRING, friAMFr STRING, friAMTo STRING, '
            + 'friPMFr STRING, friPMTo STRING, PRIMARY KEY (customerId, addressId))')

          this.logger.log('dropped deliverySchedules')

          const sqlStatements: capSQLiteSet[] = []

          for (const deliverySchedule of response.data.delivery_schedules) {
            sqlStatements.push({
              statement: 'INSERT INTO deliverySchedules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                deliverySchedule.customerId,
                deliverySchedule.addressId,
                deliverySchedule.monAMFr,
                deliverySchedule.monAMTo,
                deliverySchedule.monPMFr,
                deliverySchedule.monPMTo,
                deliverySchedule.tueAMFr,
                deliverySchedule.tueAMTo,
                deliverySchedule.tuePMFr,
                deliverySchedule.tuePMTo,
                deliverySchedule.wedAMFr,
                deliverySchedule.wedAMTo,
                deliverySchedule.wedPMFr,
                deliverySchedule.wedPMTo,
                deliverySchedule.thuAMFr,
                deliverySchedule.thuAMTo,
                deliverySchedule.thuPMFr,
                deliverySchedule.thuPMTo,
                deliverySchedule.friAMFr,
                deliverySchedule.friAMTo,
                deliverySchedule.friPMFr,
                deliverySchedule.friPMTo
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)
          this.logger.log('inserted deliverySchedules', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'deliverySchedules', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncDeliverySchedules() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCustomers(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncCustomers()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'customers')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('customers', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.customers) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS customers')
          await db.execute('CREATE TABLE IF NOT EXISTS customers '
            + '(id INTEGER, addressId INTEGER, addressGroupId INTEGER, userCode INTEGER, userType INTEGER, '
            + 'name STRING, address STRING, streetNum STRING, zipCode STRING, city STRING, country STRING, '
            + 'phoneNum STRING, vatNum STRING, language STRING, promo BOOLEAN, fostplus BOOLEAN, bonusPercentage REAL, '
            + 'addressName STRING, delvAddress STRING, delvStreetNum STRING, delvZipCode STRING, delvCity STRING, '
            + 'delvCountry STRING, delvPhoneNum STRING, delvLanguage STRING, PRIMARY KEY (id, addressId))')

          this.logger.log('dropped customers')


          const sqlStatements: capSQLiteSet[] = []

          for (const customer of response.data.customers) {
            sqlStatements.push({
              // 1. id , 2. addressId, 3. addressGroupId, 4. userCode, 5. userType,
              // 6. name, 7. address, 8. streetNum, 9. zipCode, 10. city, 11. country, '
              // 12. phoneNum, 13. vatNum, 14. language, 15. promo, 16. fostplus, 17. bonusPercentage, '
              // 18 addressName STRING, 19 delvAddress STRING, 20 delvStreetNum STRING, 21 delvZipCode STRING, 22 delvCity STRING, '
              // 23 delvCountry STRING, 24 delvPhoneNum STRING, 25 delvLanguage
              statement: 'INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                customer.id, // 1
                customer.addressId, // 2
                customer.addressGroupId, // 3
                customer.userCode, // 4
                customer.userType, // 5
                customer.name, // 6
                customer.address, // 7
                customer.streetNum, // 8
                customer.zipCode, // 9
                customer.city, // 10
                customer.country, // 11
                customer.phoneNum, // 12
                customer.vatNum, // 13
                customer.language, // 14
                customer.promo ? 1 : 0, // 15
                customer.fostplus ? 1 : 0, // 16
                customer.bonusPercentage, // 17
                customer.addressName, // 18
                customer.delvAddress, // 19
                customer.delvStreetNum, // 20
                customer.delvZipCode, // 21
                customer.delvCity, // 22
                customer.delvCountry, // 23
                customer.delvPhoneNum, // 24
                customer.delvLanguage // 25
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)

          this.logger.log('inserted customers', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'customers', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncCustomers() -- no changes`)
      }

      return true
    } catch (err) {
      this.logger.error(err.message, err)
    }
  }

  async syncProductDescriptionCustomers(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductDescriptionCustomers()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productDescriptionCustomers')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('customers/product-descriptions', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.customer_product_descriptions) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productDescriptionCustomers')
          await db.execute('CREATE TABLE IF NOT EXISTS productDescriptionCustomers (id INTEGER PRIMARY KEY, description STRING)')

          this.logger.log('dropped productDescriptionCustomers')

          const sqlStatements: capSQLiteSet[] = []

          for (const descriptionCustomer of response.data.customer_product_descriptions) {
            sqlStatements.push({
              statement: 'INSERT INTO productDescriptionCustomers VALUES (?, ?)',
              values: [
                descriptionCustomer.id,
                descriptionCustomer.description
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements)
          this.logger.log('inserted productDescriptionCustomers', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'productDescriptionCustomers', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductDescriptionCustomers() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncRecipesModule(user_id: number, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncRecipesModule()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'recipesModule')?.checksum ?? '',
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('recipes', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

        if (response && response.data.recipes) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS recipesModule')
          await db.execute('CREATE TABLE IF NOT EXISTS recipesModule '
            + '(id INTEGER, productId INTEGER, nameNl STRING, nameFr STRING, PRIMARY KEY (id, productId))')

          this.logger.log('dropped recipesModule')

          const sqlStatements: capSQLiteSet[] = []

          for (const recipesModule of response.data.recipes) {
            const nameNl: string = (recipesModule.name && recipesModule.name.nl) ? recipesModule.name.nl : null
            const nameFr: string = (recipesModule.name && recipesModule.name.fr) ? recipesModule.name.fr : null

            sqlStatements.push({
              statement: 'INSERT INTO recipesModule VALUES (?, ?, ?, ?)',
              values: [
                recipesModule.id,
                recipesModule.productId,
                nameNl,
                nameFr
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)
          this.logger.log('inserted recipesModule', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'recipesModule', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncRecipesModule() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncNews(user_id: number, culture?: string, force?: boolean, customer_id?: number, address_id?: number) {
    try {
      this.logger.log(`SyncProvider.syncNews()`)

      if (culture === 'all') culture = undefined
      const params = trimParameters({
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'news')?.checksum ?? '',
        customer_id,
        address_id,
        uid: user_id
      })

      const response = await firstValueFrom(
        this.api.sync<any>('news', params)
          .pipe(timeout(TIMEOUT_INTERVAL))
      )

      if (response && response.data.news) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS news')
          await db.execute('CREATE TABLE IF NOT EXISTS news '
            + '(id INTEGER PRIMARY KEY, customerId INTEGER, addressId INTEGER, titleNl STRING, '
            + 'titleFr STRING, contentNl BLOB, contentFr BLOB, promo BOOLEAN, spotlight BOOLEAN, template TINYINT, date DATETIME)')

          this.logger.log('dropped news')

          const sqlStatements: capSQLiteSet[] = []

          for (const newsItem of response.data.news) {
            const titleNl: string = (newsItem.title && newsItem.title.nl) ? newsItem.title.nl : null
            const titleFr: string = (newsItem.title && newsItem.title.fr) ? newsItem.title.fr : null
            const contentNl: string = (newsItem.content && newsItem.content.nl) ? newsItem.content.nl : null
            const contentFr: string = (newsItem.content && newsItem.content.fr) ? newsItem.content.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO news VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                newsItem.id,
                newsItem.customerId,
                newsItem.addressId,
                titleNl,
                titleFr,
                contentNl,
                contentFr,
                newsItem.promo ? 1 : 0,
                newsItem.spotlight ? 1 : 0,
                newsItem.template ? 1 : 0,
                newsItem.date
              ]
            })
          }

          if (response.data.length > 0)
            await db.executeSet(sqlStatements, true)
          this.logger.log('inserted news', response.data.checksum)
          await this.updateDataIntegrityChecksum(db, 'news', response.data.checksum)
        })
      } else {
        this.logger.log(`SyncProvider.syncNews() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async prepareCurrentExceptions(customer: AppCustomerModel): Promise<boolean> {
    let result: boolean = true
    await this._db.executeQuery(async (db: SQLiteDBConnection): Promise<void> => {
      // Check if all tables exist
      const tables = (await db.getTableList()).values
      if (!tables.find(e => e === 'currentExceptions')) {
        this.logger.warn('Creating missing TABLE currentExceptions')
        await db.execute('CREATE TABLE currentExceptions (productId INTEGER PRIMARY KEY)', true)
      }

      if (!tables.find(e => e === 'productExceptions')) {
        this.logger.error('Product Exceptions TABLE does not exist!')
        result = false
        return
      }
      if (!tables.find(e => e === 'products')) {
        this.logger.error('Products TABLE does not exist!')
        result = false
        return
      }

      const defaultExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = 0 '
        + 'AND address = 0 AND addressGroup = 0 LIMIT 1')).values
      const customerExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = ? '
        + 'AND address = 0 AND addressGroup = 0 LIMIT 1', [
        customer.id
      ])).values
      const addressExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = ? '
        + 'AND address = ? AND addressGroup = 0 LIMIT 1', [
        customer.id,
        customer.addressId
      ])).values
      const addressGroupExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = 0 '
        + 'AND address = 0 AND addressGroup = ? AND addressGroup != 0 LIMIT 1', [
        customer.addressGroupId
      ])).values
      const products = (await db.query('SELECT id,itemnum FROM products')).values

      if (products.length <= 0) {
        this.logger.error('No products found!')
        return
      }

      this.logger.info('We have found ' + products.length + ' products!')
      this.logger.info('We have found ' + defaultExceptions.length + ' defaultExceptions!')
      this.logger.info('We have found ' + customerExceptions.length + ' customerExceptions!')
      this.logger.info('We have found ' + addressExceptions.length + ' addressExceptions!')
      this.logger.info('We have found ' + addressGroupExceptions.length + ' addressGroupExceptions!')

      const uniqBy = <T>(a, key): T[] => [
        ...new Map<T, T>(
          a.map(x => [key(x), x])
        ).values()
      ]

      if (defaultExceptions.length <= 0) {
        this.logger.error('No defaultExceptions found!')
        return
      }

      // eslint-disable-next-line no-console
      console.time('preparing')

      const hasCustomerExceptions = (customerExceptions && customerExceptions.length > 0)
      const hasAddressExceptions = (addressExceptions && addressExceptions.length > 0)
      const hasAddressGroupExceptions = (addressGroupExceptions && addressGroupExceptions.length > 0)

      let exceptions: string[]
      let allowed: number[]

      if (!hasCustomerExceptions && !hasAddressExceptions && !hasAddressGroupExceptions) {
        this.logger.warn('This user does not have any product exceptions!')
        exceptions = defaultExceptions[0].list.toString().split(',')

        allowed = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasAddressExceptions && addressExceptions[0].deny === 'true') {
        this.logger.warn('This user has adressExceptions with deny true')
        exceptions = addressExceptions[0].list.toString().split(',')

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasCustomerExceptions && customerExceptions[0].deny === 'true') {
        this.logger.warn('This user has cusomerExceptions with deny true')
        exceptions = customerExceptions[0].list.toString().split(',')

        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasAddressGroupExceptions && addressGroupExceptions[0].deny === 'true') {
        this.logger.warn('This user has addressGroupExceptions with deny true')
        exceptions = addressGroupExceptions[0].list.toString().split(',')

        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }
        if (hasCustomerExceptions) {
          this.logger.warn('This user has additional customerExceptions')
          exceptions = exceptions.concat(customerExceptions[0].list.toString().split(','))
        }

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasCustomerExceptions || hasAddressExceptions || hasAddressGroupExceptions) {
        this.logger.warn('This user has any type of product exceptions')
        exceptions = defaultExceptions[0].list.toString().split(',')
        const temp = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)

        exceptions = []
        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }
        if (hasCustomerExceptions) {
          this.logger.warn('This user has additional customerExceptions')
          exceptions = exceptions.concat(customerExceptions[0].list.toString().split(','))
        }
        if (hasAddressGroupExceptions) {
          this.logger.warn('This user has additional addressGroupExceptions')
          exceptions = exceptions.concat(addressGroupExceptions[0].list.toString().split(','))
        }
        allowed = uniqBy<number>(temp.concat(products.filter(
          e => exceptions.includes(e.itemnum.toString())).map(e => e.id)), JSON.stringify)
      } else {
        this.logger.warn('I dont know what is going on here but default will have to do!')
        exceptions = defaultExceptions[0].list.toString().split(',')

        allowed = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)
      }

      const queries = [{
        statement: 'DELETE FROM currentExceptions',
        values: []
      }]

      for (const product of allowed) {
        // Remove all existing exceptions and insert new ones
        queries.push({
          statement: 'INSERT OR REPLACE INTO currentExceptions VALUES (?)',
          values: [product]
        })
      }

      this.logger.info('Inserting ' + allowed.length + ' records into currentExceptions')
      await db.executeSet(queries, true)

      // eslint-disable-next-line no-console
      console.timeEnd('preparing')
    })
    return result
  }

  async syncThumbnails(user: Customer, options: { force?: boolean, loader?: HTMLIonLoadingElement }) {
    let itemnums: number[]
    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      if (user.id < 1000 && [2, 3].includes(user.type))
        itemnums = (
          await db.query('SELECT itemnum FROM products')
        ).values.map(x => x.itemnum)
      else
        itemnums = (
          await db.query('SELECT p.itemnum FROM currentExceptions c JOIN products p ON p.id = c.productId')
        ).values.map(x => x.itemnum)
    })

    const runner = new SyncTaskRunner<void>(4)
    for (let itemnum of itemnums) {
      runner.push(() => new Promise<void>((x, y) => {
        // check if file exists on disk, if so skip
        Filesystem.stat({
          path: 'thumbnails/' + itemnum + '.blob',
          directory: Directory.Documents
        }).then(file_info => {
          x()
        }).catch(err => {
          firstValueFrom(this.api.pcmGet(`product-images/dis/${itemnum}?s=thumb`)).then(_ => x()).catch(err => y())
        })
      }))
    }

    return new Promise<void>(res => {
      const r = setInterval(() => {
        if (!runner.busy) {
          clearInterval(r)
          res()
        } else {
          if (options.loader)
            options.loader.message = `${options.loader.message.toString().split(' ')[0]} ${itemnums.length - runner.queue_length}/${itemnums.length}`
          console.log(`completed ${itemnums.length - runner.queue_length}/${itemnums.length}`, runner.busy)
        }
      }, 200)
    })
  }

  /**
   * Set the checksum in the database for the given dataTable
   *
   * @private
   * @param dataTable name of table
   * @param checksum sha value of checksum
   * @memberof SyncService
   */
  private async updateDataIntegrityChecksum(db: SQLiteDBConnection, dataTable: string, checksum: string): Promise<Changes> {
    console.log(dataTable, checksum)
    const res = await db.run(`INSERT OR REPLACE INTO dataIntegrityChecksums (dataTable, checksum, dateChanged) VALUES (?, ?, ?)`, [
      dataTable,
      checksum,
      new Date().toJSON()
    ])
    return res.changes
  }

  /**
   * Returns an array with arrays of the given size.
   *
   * @param myArray {Array} array to split
   * @param chunkSize {Integer} Size of every group
   */
  private chunkArray(myArray: any[], chunkSize: number) {
    let index = 0
    const arrayLength = myArray.length
    const tempArray = []

    for (index = 0; index < arrayLength; index += chunkSize) {
      const myChunk = myArray.slice(index, index + chunkSize)
      // Do something if you want with the group
      tempArray.push(myChunk)
    }

    return tempArray
  }

  /**
   * Remove diacritics from a string for easy search
   *
   * @param input input string
   * @returns output string
   */
  private filterDiacritics(input: string): string {
    return input.replace(/(é|ë|ê|è|ę|ė|ē|É|Ë|Ê|È|Ę|Ė|Ē)/g, 'e')
      .replace(/(á|ä|â|à|ã|å|ā|Á|Ä|Â|À|Ã|Å|Ā)/g, 'a')
      .replace(/(í|ï|ì|î|į|ī|Í|Ï|Ì|Î|Į|Ī)/g, 'i')
      .replace(/(œ|Œ)/g, 'oe')
      .replace(/(ó|ö|ô|ò|õ|ø|ō|Ó|Ö|Ô|Ò|Õ|Ø|Ō)/g, 'o')
      .replace(/(ú|ü|û|ù|ū|Ú|Ü|Û|Ù|Ū)/g, 'u')
      .replace(/(æ|Æ)/g, 'ae')
      .toLowerCase()
  }
}

class SyncTaskRunner<T> {
  private queue: Function[] = []
  private concurrency: number
  private active_count: number = 0

  constructor(concurrency: number = 4) {
    this.concurrency = concurrency
  }

  push(fn: Function) {
    if (this.active_count < this.concurrency)
      this.exec(fn)
    else
      this.queue.push(fn)
  }

  async exec(fn: Function): Promise<void> {
    this.active_count++

    try {
      await fn()
    } catch (err) {
      // console.error(err)
    } finally {
      this.active_count--

      if (this.queue.length > 0)
        this.exec(this.queue.shift())
    }
  }

  get busy(): boolean {
    return this.active_count > 0
  }

  get queue_length(): number {
    return this.queue.length + this.active_count
  }
}

export class Store {
  dataTable: string
  checksum: string
  dateChanged: Date
}
