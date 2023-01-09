import { Location } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { ErrorAlertsService } from 'src/app/core/error-alerts.service'
import { DepartmentsRepositoryService, IDepartmentDetailT } from 'src/app/core/repositories/departments.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-department-detail',
  templateUrl: './department-detail.page.html',
  styleUrls: ['./department-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentDetailPage implements OnInit {
  loading = true
  private _department: IDepartmentDetailT
  displayThumbnail: boolean

  constructor(
    route: ActivatedRoute,
    settings: SettingsService,
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private api: ApiService,
    private user: UserService,
    private departmentsRepository: DepartmentsRepositoryService,
    private alertCtrl: AlertController,
    private logger: LoggingProvider,
    private error: ErrorAlertsService,
    private location: Location
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

  private async update(data: { name: string }) {
    try {
      const res = await this.api.put<{ Id: number }>(`departments/${this.department.id}`, {
        Alias: data.name
      }, {
        userCode: this.user.activeUser.userCode
      }).toPromise()
      if (res.Id === this.department.id) {
        if (await this.departmentsRepository.updateName(this.department.id, data.name)) {
          this.department.alias = data.name
          this.ref.markForCheck()
        }
      }
    } catch (err) {
      this.logger.error('DepartmentDetailPage.delete() error', err)
      await this.error.alert(
        this.translate.instant('errors.department-detail.delete.title'),
        this.translate.instant('errors.department-detail.delete.message'),
        [
          'ok'
        ]
      )
    } finally {

    }
  }

  private async delete() {
    try {
      await this.api.delete(`departments/${this.department.id}`, {
        userCode: this.user.activeUser.userCode
      }).toPromise()
      if (await this.departmentsRepository.delete(this.department.id)) {
        this.location.back()
      }
    } catch (err) {
      this.logger.error('DepartmentDetailPage.delete() error', err)
      await this.error.alert(
        this.translate.instant('errors.department-detail.delete.title'),
        this.translate.instant('errors.department-detail.delete.message'),
        [
          'ok'
        ]
      )
    } finally {

    }
  }

  async showUpdateInput(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('modifyDepartment'),
      inputs: [
        {
          name: 'name',
          placeholder: this.translate.instant('deparmtentChangeName')
        }
      ],
      buttons: [
        {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('actions.modify'),
          handler: data => this.update(data)
        }
      ]
    })
    await alert.present()
  }

  async showDeleteConfirmation(): Promise<void> {
    try {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('departmentDeletionWarning'),
        buttons: [
          {
            text: this.translate.instant('actions.cancel'),
            role: 'cancel',
            handler: () => { }
          }, {
            text: this.translate.instant('yes'),
            role: 'destructive',
            handler: () => this.delete()
          }
        ]
      })
      await alert.present()
    } catch (err) {
      this.logger.error('DepartmentDetailPage.showDeleteConfirmation() error', err)
    }
  }

  get department(): IDepartmentDetailT {
    return this._department || { id: 0, alias: '', products: [] }
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
