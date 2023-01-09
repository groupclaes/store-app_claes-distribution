import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { LoadingController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { DataIntegrityChecksumsRepositoryService } from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { Store, SyncService } from 'src/app/core/sync.service'
import { UserService } from 'src/app/core/user.service'

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

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private sync: SyncService,
    private repo: DataIntegrityChecksumsRepositoryService,
    private loadingCtrl: LoadingController,
    private logger: LoggingProvider
  ) { }

  ngOnInit() {
    this.load()
  }

  private async load(): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      const dataIntegrity = await this.repo.get<Store>()
      this.lastSync = dataIntegrity.find(e => e.dataTable === 'lastSync').dateChanged
      this.integrityChecksums = dataIntegrity.filter(e => e.dataTable != 'lastSync')
      console.log(dataIntegrity)
    } catch (err) {
      this.logger.error('SyncPage.load() error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async fullSync() {
    this.loader = await this.loadingCtrl.create({
      spinner: 'lines',
      message: this.translate.instant('syncPage')
    })
  }

  get internalUser(): boolean {
    return this.user.userinfo.id < 1000
  }

  get culture(): string {
    return this.translate.currentLang
  }
}
