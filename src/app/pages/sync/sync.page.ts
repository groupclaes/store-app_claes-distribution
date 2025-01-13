import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { LoadingController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { DatabaseService } from 'src/app/core/database.service'
import { DataIntegrityChecksumsRepositoryService } from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { Store, SyncService } from 'src/app/core/sync.service'
import { AppCustomerModel, UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-sync',
  templateUrl: './sync.page.html',
  styleUrls: ['./sync.page.scss'],
})
export class SyncPage implements OnInit {
  loader: HTMLIonLoadingElement
  loading = true
  lastSync: Date
  integrityChecksums: Array<Store> = []

  productcount = 0
  imagecount = 0

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private sync: SyncService,
    private repo: DataIntegrityChecksumsRepositoryService,
    private loadingCtrl: LoadingController,
    private logger: LoggingProvider,
    private _db: DatabaseService,
    public network: NetworkService
  ) { }

  get internalUser(): boolean {
    return this.user.userinfo.id < 1000
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get agent(): boolean {
    return this.user.hasAgentAccess
  }

  ngOnInit() {
    this.load()
  }

  async fullSync($event?: any) {
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

    await promise.then(_ => this.loader.dismiss())
      .then(_ => {
        this.load()
        $event?.target.complete()
      })

    if (this.user.activeUser.id != null && this.user.activeUser.address != null) {
      const customer = {
        id: this.user.activeUser.id,
        addressId: this.user.activeUser.address
      } as AppCustomerModel
      await this.sync.prepareCurrentExceptions(customer)
    }
  }

  async syncAllThumbnails() {
    this.loader = await this.loadingCtrl.create({
      spinner: 'lines',
      message: this.translate.instant('syncPage')
    })

    await this.loader.present()

    this.sync.syncThumbnails(this.user.userinfo, { force: true, loader: this.loader })
      .then(_ => this.loader.dismiss())
      .then(_ => this.load())
  }

  private async load(): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      const dataIntegrity = await this.repo.get<Store>()
      this.lastSync = dataIntegrity.find(e => e.dataTable === 'lastSync').dateChanged
      this.integrityChecksums = dataIntegrity.filter(e => e.dataTable !== 'lastSync')

      this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
        const result = await db.query('select count(*) as c from currentExceptions')
        if (result.values)
          this.productcount = result.values[0]['c']
        this.ref.markForCheck()
      })

      Filesystem.readdir({
        path: 'thumbnails',
        directory: Directory.Documents
      }).then(result => {
        this.imagecount = result.files.length
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
