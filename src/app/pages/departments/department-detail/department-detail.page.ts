import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { DepartmentsRepositoryService } from 'src/app/core/repositories/departments.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { SyncService } from 'src/app/core/sync.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-department-detail',
  templateUrl: './department-detail.page.html',
  styleUrls: ['./department-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentDetailPage implements OnInit {
  loading = true
  private _department: $TSFixMe
  displayThumbnail: boolean

  constructor(
    route: ActivatedRoute,
    settings: SettingsService,
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private api: ApiService,
    private user: UserService,
    private departmentsRepository: DepartmentsRepositoryService,
    private sync: SyncService,
    private alertCtrl: AlertController,
    private logger: LoggingProvider
  ) {
    settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
      this.ref.markForCheck()
    })
    route.params.subscribe(params => {
      this.load(+params['id'])
    })
  }

  ngOnInit() {
  }

  async load(id: number) {
    this.loading = true
    this.ref.markForCheck()

    try {
      this._department = await this.departmentsRepository.getDetail(id, this.culture)
    } catch (err) {
      this.logger.error('DepartmentDetailPage.load() error!', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async modify() {
    try {

    } catch (err) {
      this.logger.error('DepartmentDetailPage.modify() error', err)
    } finally {

    }
  }

  async handleUpdate() {

  }

  async reload() {

  }

  async delete() {
    try {
      const acceptDelete = await this.showDeleteConfirmation()
      if (acceptDelete) {
        alert('hi')
      }
    } catch (err) {
      this.logger.error('DepartmentDetailPage.delete() error', err)

    } finally {

    }
  }

  async showDeleteConfirmation(): Promise<boolean> {
    let resolveH: Function
    const promise = new Promise<boolean>(resolve => resolveH = resolve)
    try {
      const alert = await this.alertCtrl.create({
        header: 'Are you sure you want to delete this department?',
        buttons: [
          {
            text: 'Yes',
            role: 'submit',
            handler: () => resolveH(true)
          }, {
            text: 'No',
            role: 'cancel',
            handler: () => resolveH(false)
          }
        ]
      })
      await alert.present()
    } catch (err) {
      this.logger.error('DepartmentDetailPage.showDeleteConfirmation() error', err)
    }
    return promise
  }

  get department() {
    if (this._department) {
      return this._department
    }
    return {}
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
