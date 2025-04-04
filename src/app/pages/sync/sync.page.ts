import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DBSQLiteValues, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { AlertController, LoadingController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { DatabaseService } from 'src/app/core/database.service'
import {
  DataIntegrityChecksumsRepositoryService
} from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { Store, SyncService } from 'src/app/core/sync.service'
import { AppCustomerModel, UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-sync',
  templateUrl: './sync.page.html',
  styleUrls: ['./sync.page.scss']
})
export class SyncPage implements OnInit {
  loader: HTMLIonLoadingElement
  loading: boolean = true
  lastSync: Date
  integrityChecksums: Array<Store> = []

  productcount: number = 0
  imagecount: number = 0

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private sync: SyncService,
    private repo: DataIntegrityChecksumsRepositoryService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private logger: LoggingProvider,
    private _db: DatabaseService,
    public network: NetworkService
  ) {
  }

  get internalUser(): boolean {
    return this.user.activeUser.id > 0 && this.user.activeUser.id < 1000
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
      this.logger.error('SyncPage.purgeThumbnails() error', err)
    }
  }

  private async load(): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      const dataIntegrity: Store[] = await this.repo.get<Store>()
      this.lastSync = dataIntegrity.find((e: Store): boolean => e.dataTable === 'lastSync').dateChanged
      this.integrityChecksums = dataIntegrity.filter((e: Store): boolean => e.dataTable !== 'lastSync')

      await this._db.executeQuery<any>(async (db: SQLiteDBConnection): Promise<void> => {
        const result: DBSQLiteValues = await db.query('select count(*) as c from ' + (this.agent ? 'products' : 'currentExceptions'))
        if (result.values)
          this.productcount = result.values[0]['c']
        this.ref.markForCheck()
      })

      Filesystem.readdir({
        path: 'thumbnails',
        directory: Directory.Cache
      }).then(result => {
        this.imagecount = result.files.length
        this.ref.markForCheck()
      }).catch(err => {
        this.imagecount = 0
        this.ref.markForCheck()
      })
    } catch (err) {
      this.logger.error('SyncPage.load() error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }
}
