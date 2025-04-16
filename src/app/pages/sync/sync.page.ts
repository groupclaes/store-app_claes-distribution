import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Directory, FileInfo, Filesystem, ReaddirResult } from '@capacitor/filesystem'
import { AlertController, LoadingController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { NetworkService } from 'src/app/@shared/network.service'
import { DatabaseService } from 'src/app/core/database.service'
import {
  DataIntegrityChecksumsRepositoryService
} from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { Store, SyncService } from 'src/app/core/sync.service'
import { AppCustomerModel, UserService } from 'src/app/core/user.service'
import { LoggerService } from '../../@shared/logging/log.service'

const TASK_COUNT = 6
const logger = new LoggerService('SyncService')

@Component({
  selector: 'app-sync',
  templateUrl: './sync.page.html',
  styleUrls: ['./sync.page.scss']
})
export class SyncPage implements OnInit {
  loader: HTMLIonLoadingElement
  loading: boolean = true
  isLoading: boolean = true
  lastSync: Date
  integrityChecksums: Array<Store> = []

  leafletCount: number = undefined
  datasheetCount: number = undefined
  productCount: number = undefined
  imageCount: number = undefined
  cacheSize: number = undefined
  reportCount: number = undefined

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private sync: SyncService,
    private repo: DataIntegrityChecksumsRepositoryService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private _db: DatabaseService,
    public network: NetworkService
  ) {
  }

  get internalUser(): boolean {
    return this.user.userinfo.id > 0 && this.user.userinfo.id < 1000
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get agent(): boolean {
    return this.user.hasAgentAccess
  }

  ngOnInit(): void {
    this.load()
  }

  async fullSync($event?: any): Promise<void> {
    this.loader = await this.loadingCtrl.create({
      spinner: 'lines',
      message: this.translate.instant('syncPage')
    })

    this.loader.present()

    let promise
    let culture = this.agent ? 'all' : this.translate.currentLang.split('-')[0]
    if (this.user.activeUser != null)
      promise = this.sync.fullSync(this.user.credential, culture, $event === undefined, this.user.activeUser, this.user.userinfo.userId)
    else
      promise = this.sync.fullSync(this.user.credential, culture, $event === undefined, undefined, this.user.userinfo.userId)
    try {
      await promise

      if (this.user.activeUser.id != null && this.user.activeUser.address != null) {
        const customer = {
          id: this.user.activeUser.id,
          addressId: this.user.activeUser.address
        } as AppCustomerModel
        await this.sync.prepareCurrentExceptions(customer)
      }
    } catch (err) {
    } finally {
      this.loader.dismiss()
      this.load()
      $event?.target.complete()
    }
  }

  async syncAllThumbnails(): Promise<void> {
    this.loader = await this.loadingCtrl.create({
      spinner: 'lines',
      message: this.translate.instant('syncPage')
    })

    await this.loader.present()

    this.sync.syncThumbnails(this.user.userinfo, { force: true, loader: this.loader })
      .then((): Promise<boolean> => this.loader.dismiss())
      .then((): Promise<void> => this.load())
  }

  async purgeThumbnails(): Promise<void> {
    try {
      const alert: HTMLIonAlertElement = await this.alertCtrl.create({
        header: this.translate.instant('thumbnailsDeletionWarning'),
        buttons: [
          {
            text: this.translate.instant('actions.cancel'),
            role: 'cancel',
            handler: (): void => {
            }
          }, {
            text: this.translate.instant('yes'),
            role: 'destructive',
            handler: () => this.sync.deleteThumbnailsFolder().then(async (): Promise<void> => await this.load())
          }
        ]
      })
      await alert.present()
    } catch (err) {
      logger.error('SyncPage.purgeThumbnails() error', err)
    }
  }

  private async load(): Promise<void> {
    let tasks: number = 0
    try {
      this.leafletCount = undefined
      this.productCount = undefined
      this.imageCount = undefined
      this.cacheSize = undefined
      this.reportCount = undefined
      this.datasheetCount = undefined
      this.loading = true
      this.isLoading = true
      this.ref.markForCheck()

      const dataIntegrity: Store[] = await this.repo.get<Store>()
      this.lastSync = dataIntegrity.find((e: Store): boolean => e.dataTable === 'lastSync').dateChanged
      this.integrityChecksums = dataIntegrity.filter((e: Store): boolean => e.dataTable !== 'lastSync')
      this.ref.markForCheck()

      await this._db.executeQuery<any>(async (db: SQLiteDBConnection): Promise<void> => {
        const result: DBSQLiteValues = await db.query('select count(*) as c from ' + (this.agent ? 'products' : 'currentExceptions'))
        if (result.values)
          this.productCount = result.values[0]['c']
        this.ref.markForCheck()
      })

      Filesystem.readdir({
        path: 'thumbnails',
        directory: Directory.Cache
      })
        .then((result: ReaddirResult): void => {
          this.imageCount = result.files.length
          this.ref.markForCheck()
        })
        .catch((): void => {
          this.imageCount = 0
          this.ref.markForCheck()
        })
        .finally((): void => {
          tasks++
          this.isLoading = !(tasks >= TASK_COUNT)
          this.ref.markForCheck()
        })

      Filesystem.readdir({
        path: '',
        directory: Directory.Data
      })
        .then((result: ReaddirResult): void => {
          console.log(result.files)
          this.leafletCount = result.files.filter(x => /^([0-9]{6})_(nl|fr).pdf$/g.test(x.name)).length
          this.ref.markForCheck()
        })
        .catch((): void => {
          this.leafletCount = 0
          this.ref.markForCheck()
        })
        .finally((): void => {
          tasks++
          this.isLoading = !(tasks >= TASK_COUNT)
          this.ref.markForCheck()
        })

      this.getCount('reports')
        .then((result: number): void => {
          this.reportCount = result
          this.ref.markForCheck()
        })
        .catch((): void => {
          this.reportCount = 0
          this.ref.markForCheck()
        })
        .finally((): void => {
          tasks++
          this.isLoading = !(tasks >= TASK_COUNT)
          this.ref.markForCheck()
        })

      this.getCount('datasheets', Directory.Cache)
        .then((result: number): void => {
          this.datasheetCount = result
          this.ref.markForCheck()
        })
        .catch((): void => {
          this.datasheetCount = 0
          this.ref.markForCheck()
        })
        .finally((): void => {
          tasks++
          this.isLoading = !(tasks >= TASK_COUNT)
          this.ref.markForCheck()
        })

      this.getSize()
        .then((result: number): void => {
          this.cacheSize = result
          this.ref.markForCheck()
        })
        .catch((): void => {
          this.cacheSize = 0
          this.ref.markForCheck()
        })
        .finally((): void => {
          tasks++
          this.isLoading = !(tasks >= TASK_COUNT)
          this.ref.markForCheck()
        })
    } catch (err) {
      logger.error('SyncPage.load() error', err)
    } finally {
      tasks++
      this.isLoading = !(tasks >= TASK_COUNT)
      this.loading = false
      this.ref.markForCheck()
    }
  }

  private async getCount(path: string = '', directory: Directory = Directory.Data): Promise<number> {
    try {
      const result: ReaddirResult = await Filesystem.readdir({ path, directory })
      const files: FileInfo[] = result.files.filter((e: FileInfo): boolean => e.type === 'file')
      const dirs: FileInfo[] = result.files.filter((e: FileInfo): boolean => e.type === 'directory')
      let dirSize: number = 0
      for (const dir of dirs) {
        dirSize += await this.getCount(path + '/' + dir.name, directory)
      }
      return files.length + dirSize
    } catch {
      return 0
    }
  }

  private async getSize(path: string = '', directory: Directory = Directory.Cache): Promise<number> {
    try {
      const result: ReaddirResult = await Filesystem.readdir({ path, directory })
      const files: FileInfo[] = result.files.filter((e: FileInfo): boolean => e.type === 'file')
      const dirs: FileInfo[] = result.files.filter((e: FileInfo): boolean => e.type === 'directory')
      let dirSize: number = 0
      for (const dir of dirs) {
        dirSize += await this.getSize(path + '/' + dir.name, directory)
      }
      return files.reduce((prev: number, next: FileInfo): number => prev + next.size, 0) + dirSize
    } catch {
      return 0
    }
  }
}
