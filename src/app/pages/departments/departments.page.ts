import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { DepartmentsRepositoryService } from 'src/app/core/repositories/departments.repository.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-departments',
  templateUrl: './departments.page.html',
  styleUrls: ['./departments.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentsPage implements OnInit {
  loading = true
  private _departments: $TSFixMe[]
  private _query: string

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private api: ApiService,
    private logger: LoggingProvider,
    private departmentsRepository: DepartmentsRepositoryService
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

  create() {

  }

  get departments(): $TSFixMe[] {
    return this._departments || []
  }

  get searchTerm(): string {
    return this._query || ''
  }

  private get culture(): string {
    return this.translate.currentLang
  }
}
