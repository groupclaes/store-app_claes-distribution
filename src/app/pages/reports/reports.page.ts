import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActionSheetController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { ApiService } from 'src/app/core/api.service'
import { UserService } from 'src/app/core/user.service'
import { ReportsRepositoryService } from 'src/app/core/repositories/reports.repository.service'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { CartService } from 'src/app/core/cart.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { Directory, DownloadFileResult, Filesystem, ReaddirResult, StatResult } from '@capacitor/filesystem'
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener'
import { firstValueFrom } from 'rxjs'

// after 15 tries we will stop checking progress
const MAX_COUNT = 15

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPage implements OnInit {
  loading: boolean = true
  private _reports: $TSFixMe[]
  private _myreports: $TSFixMe[]
  private _offline_reports: $TSFixMe[]

  constructor(
    private translate: TranslateService,
    private actionSheetCtrl: ActionSheetController,
    private api: ApiService,
    private user: UserService,
    private ref: ChangeDetectorRef,
    private logger: LoggingProvider,
    private reportsRepository: ReportsRepositoryService,
    private cart: CartService,
    public network: NetworkService
  ) {
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  get menuItemActive(): boolean {
    if (!this.user.activeUser && this.user.userinfo && [2, 3, 4].includes(this.user.userinfo.type))
      return false
    return true
  }

  get reports(): $TSFixMe[] {
    return this._reports || []
  }

  get offline_reports(): $TSFixMe[] {
    return this._offline_reports || []
  }

  get myreports(): $TSFixMe[] {
    if (this._myreports)
      return this._myreports
    return []
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) {
      params.push(this.cart.active.id)
    }
    return params
  }

  ngOnInit() {
    this.loadReports()
  }

  async loadReports() {
    if (this._reports && this._reports.length) {
      return
    }
    this.loading = true
    this.ref.markForCheck()

    try {
      this._reports = await this.reportsRepository.get(this.user.hasAgentAccess, this.culture)
      await this.loadOfflineReports()
      this.ref.markForCheck()

    } catch (err) {
      this.logger.error('ReportsPage.loadReports() error: ', err)
    } finally {
      this.loadReportList()
      // this.statistics.reportView(this.user.userinfo.userId, null)
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async loadReportList($event?: any) {
    this.loading = true
    this.ref.markForCheck()

    try {
      const resp: $TSFixMe = await firstValueFrom(this.api.get('reports/list', { userCode: this.user.userinfo.userCode }))

      this._myreports = resp || []

      for (const report of this.myreports) {
        // if the report is not completed, skip download
        if (report.Progress < 1)
          continue
        try {
          Filesystem.stat({
            directory: Directory.Documents,
            path: this.getReportPath(report.Filename)
          }).then(stat => {
            report.offline = true
            this.ref.markForCheck()
          }).catch(err => {
            if (!report.downloading) {
              report.downloading = true
              this.ref.markForCheck()
              Filesystem.downloadFile({
                url: `${this.api.url}/reports/queue/${report.TaskId}?userCode=${this.user.userinfo.userCode}`,
                directory: Directory.Documents,
                path: this.getReportPath(report.Filename),
                recursive: true
              }).then((): void => {
                report.offline = true
                report.downloading = false
                this.ref.markForCheck()
              })
            }
          })
        } catch {
          console.log('catch ?')
        }
      }
    } finally {
      this.loading = false
      this.ref.markForCheck()
      $event?.target.complete()
    }
  }

  async loadOfflineReports(): Promise<void> {
    try {
      const result: ReaddirResult = await Filesystem.readdir({
        directory: Directory.Documents,
        path: this.getReportPath('')
      })
      const reports: any[] = []
      for (let file of result.files) {
        reports.push({
          name: file.name,
          uri: file.uri
        })
      }
      this._offline_reports = reports
    } catch {
      this._offline_reports = []
    }
  }

  openReport(uri: string, type?: string): void {
    const fileOpenerOptions: FileOpenerOptions = {
      filePath: uri,
      contentType: type ?? uri.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.ms-excel',
      openWithDefault: true
    }
    FileOpener.open(fileOpenerOptions)
  }

  async confirmRunReport(report: $TSFixMe): Promise<boolean> {
    const shouldRunReport = await this.selectExtension(report)
    return shouldRunReport
  }

  async deleteTask(report: $TSFixMe): Promise<void> {
    try {
      await this.deleteReport(report.Filename)
    } finally {
      await firstValueFrom(this.api.delete(`reports/${report.TaskId}`, {
        userCode: this.user.userinfo.userCode
      }))
      // this.statistics.reportDelete(this.user.userinfo.userId, report.TaskId)
      await this.loadReportList()
    }
  }

  async deleteReport(name: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        directory: Directory.Documents,
        path: this.getReportPath(name)
      })
    } finally {
      await this.loadOfflineReports()
    }
  }

  async selectExtension(report: $TSFixMe): Promise<boolean> {
    const buttons = []
    switch (report.extension) {
      case 8:
        buttons.push({
          text: 'Excel',
          handler: () => {
            this.selectMode(report, 8)
            return true
          }
        })
        break

      case 16:
        buttons.push({
          text: 'PDF',
          handler: () => {
            this.selectMode(report, 16)
            return true
          }
        })
        break

      case 24:
        buttons.push({
          text: 'Excel',
          handler: () => {
            this.selectMode(report, 8)
            return true
          }
        })
        buttons.push({
          text: 'PDF',
          handler: () => {
            this.selectMode(report, 16)
            return true
          }
        })
        break
    }
    buttons.push({
      text: this.translate.instant('actions.cancel'),
      role: 'cancel',
      handler: () => false
    })

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('messages.choseFiletype'),
      buttons
    })

    await actionSheet.present()
    const result = await actionSheet.onDidDismiss()
    return result.role !== 'cancel'
  }

  async selectMode(report: $TSFixMe, extension: number): Promise<boolean> {
    let resolveRunning: (value: boolean) => void
    const canRun = new Promise<boolean>((resolve: (value: boolean) => void): (value: boolean) => void => resolveRunning = resolve)

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('messages.choseDeliveryMethod'),
      buttons: [
        {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel',
          handler: (): void => {
            return resolveRunning(false)
          }
        },
        {
          text: this.translate.instant('actions.download'),
          handler: (): void => {
            this.handleReport(report, extension, 1)
            return resolveRunning(true)
          }
        },
        {
          text: this.translate.instant('actions.mail'),
          handler: (): void => {
            this.handleReport(report, extension, 4)
            return resolveRunning(true)
          }
        }
      ]
    })
    await actionSheet.present()
    return canRun
  }

  async downloadReportFinal(report: $TSFixMe): Promise<void> {
    // check if file exists
    try {
      const stat: StatResult = await Filesystem.stat({
        directory: Directory.Documents,
        path: this.getReportPath(report.Filename)
      })
      this.openReport(stat.uri)
    } catch {
      const result: DownloadFileResult = await Filesystem.downloadFile({
        url: `${this.api.url}/reports/queue/${report.TaskId}?userCode=${this.user.userinfo.userCode}`,
        directory: Directory.Documents,
        path: this.getReportPath(report.Filename),
        recursive: true
      })
      this.openReport(result.path)
    }
  }

  async downloadReport(report: $TSFixMe, reportGuid: string): Promise<void> {
    const newReport = this._myreports.find(e => e.TaskId === reportGuid)
    if (newReport) {
      newReport.downloading = true
      newReport.offline = false
      this.ref.markForCheck()

      const result = await Filesystem.downloadFile({
        url: `${this.api.url}/reports/queue/${reportGuid}?userCode=${this.user.userinfo.userCode}`,
        directory: Directory.Documents,
        path: this.getReportPath(newReport.Filename),
        recursive: true
      })
      newReport.downloading = false
      newReport.offline = true
      this.ref.markForCheck()

      this.openReport(result.path)
    } else {
      await this.loadReportList()
      await this.downloadReport(report, reportGuid)
    }
  }

  getReportPath(filename: string): string {
    let path: string = 'reports/'

    if (this.currentCustomer)
      path += this.currentCustomer + '/'
    path += filename

    return path
  }

  get currentCustomer(): string {
    if (this.user.hasAgentAccess)
      return this.user.activeUser.addressName != null ? `${this.user.activeUser.address} ${this.user.activeUser.addressName}` : `${this.user.activeUser.id} ${this.user.activeUser.name}`
    else if (this.user.multiUser)
      return this.user.activeUser.addressName != null ? this.user.activeUser.addressName : this.user.activeUser.name

    return undefined
  }

  private handleReport(report: $TSFixMe, type: number, mode: number): void {
    this.api.get(`reports/${report.id}`, {
      mode: mode,
      type: type,
      userCode: this.user.userinfo.userCode,
      customerId: this.user.activeUser.id,
      addressId: this.user.activeUser.address,
      culture: this.translate.currentLang
    }).subscribe(resp => {
      // this.statistics.reportQueue(this.user.userinfo.userId, report.id)
      this.checkReportProgress(report, resp, mode)
    })
  }

  private checkReportProgress(report: $TSFixMe, reportGuid: $TSFixMe, mode: number, count: number = 0): void {
    setTimeout((): void => {
      this.api.get(`reports/queue/${reportGuid}/status`, {
        userCode: this.user.userinfo.userCode
      }).subscribe((resp: $TSFixMe) => {
        if (resp && resp === true) {
          // done
          this.loadReportList()
          this.ref.markForCheck()
          if (mode === 1) {
            this.downloadReport(report, reportGuid)
          }
        } else {
          if (count > MAX_COUNT)
            return
          this.checkReportProgress(report, reportGuid, mode, count + 1)
        }
      })
    }, 250)
  }
}
