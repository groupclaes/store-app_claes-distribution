import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { CartService } from 'src/app/core/cart.service'
import { DepartmentsRepositoryService, IDepartmentT } from 'src/app/core/repositories/departments.repository.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-departments',
  templateUrl: './departments.page.html',
  styleUrls: ['./departments.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentsPage implements OnInit {
  loading = true
  private _departments: IDepartmentT[]
  private _query: string

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private api: ApiService,
    private logger: LoggingProvider,
    private departmentsRepository: DepartmentsRepositoryService,
    private alertCtrl: AlertController,
    private cart: CartService
  ) { }

  ngOnInit() {
  }

  ionViewDidEnter() {
    this.load(true)
  }

  async load(force?: boolean) {
    if (this._departments && !force) return

    this.loading = true
    this.ref.markForCheck()

    try {
      this._departments = await this.departmentsRepository.get(this.user.activeUser.userCode)
    } catch (err) {
      this.logger.error('DepartmentsPage.load() error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  filterDepartments(event: $TSFixMe): boolean {
    this._query = event.target.value
    return true
  }

  async create(data: { name: string }) {
    try {
      this.loading = true
      this.ref.markForCheck()
      const res = await this.api.post<{ Id: number }>(`departments`, {
        Alias: data.name
      }, {
        userCode: this.user.activeUser.userCode
      }).toPromise()
      if (res && res.Id) {
        if (await this.departmentsRepository.create(res.Id, this.user.activeUser.userCode, data.name))
          this.departments.push({
            id: res.Id,
            alias: data.name,
            products: undefined
          })
      }
      console.log(res)
    } catch (err) {
      this.logger.error('DepartmentsPage.create() error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async showCreateInput() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('addDepartment'),
      inputs: [
        {
          name: 'name',
          placeholder: this.translate.instant('deparmtentCreatenew')
        }
      ],
      buttons: [
        {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('actions.add'),
          handler: data => this.create(data)
        }
      ]
    })
    await alert.present()
  }

  get departments(): IDepartmentT[] {
    return this._departments || []
  }

  get searchTerm(): string {
    return this._query || ''
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) params.push(this.cart.active.id)
    return params
  }
}
