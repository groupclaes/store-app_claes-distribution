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
import { environment } from '../../../environments/environment'

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
  reports: $TSFixMe[] = []
  my_reports: IRequestedReportDisplay[] = []
  offline_reports: $TSFixMe[] = []

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

  ngOnInit(): void {
    this.load().finally((): void => {
      this.loading = false
    })
  }

  async load(): Promise<void> {
    await this.loadAvailableReports()

    if (this.network.online)
      await this.loadRequestedReports()
    else
      await this.loadOfflineReports()
  }

  async loadAvailableReports(): Promise<void> {
    if (this.reports && this.reports.length) {
      return
    }
    this.loading = true
    this.ref.markForCheck()

    try {
      this.reports = await this.reportsRepository.get(this.user.hasAgentAccess, this.culture)
    } finally {
      this.loading = false
      this.ref.markForCheck()
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
        reports.push({ name: file.name, uri: file.uri })
      }

      this.offline_reports = reports
    } catch {
      this.offline_reports = []
    }
  }

  async loadRequestedReports($event?: $TSFixMe): Promise<void> {
    // only enable loading when there are no requested reports yet
    if (this.my_reports.length === 0)
      this.loading = true
    this.ref.markForCheck()

    try {
      const resp: IBaseApiResponse<IRequestedReport[]> = await firstValueFrom(this.api.getShop<IBaseApiResponse<IRequestedReport[]>>('reports/list', {
        uid: this.user.userinfo.userId,
        usercode: this.user.activeUser.userCode
      }))
      const my_reports: IRequestedReportDisplay[] = resp?.data || []

      for (const report of my_reports) {
        report.offline = false
      }

      this.my_reports = my_reports

      for (const report of this.my_reports) {
        this.checkStorage(report)
      }
    } finally {
      this.loading = false
      this.ref.markForCheck()
      $event?.target.complete()
    }
  }

  checkStorage(report: IRequestedReportDisplay): Promise<void> {
    if (report.progress < 1)
      return

    Filesystem.stat({
      directory: Directory.Documents,
      path: this.getReportPath(report.name)
    }).then((): void => {
      report.offline = true
      this.ref.markForCheck()
    }).catch((): void => {
      this.downloadTask(report.id, report.name, report)
    })
  }

  async downloadTask(task_id: string, filename: string, report?: $TSFixMe): Promise<void> {
    if (report && report.downloading)
      await new Promise<void>((r: () => void): void => {
        let t: number = window.setInterval((): void => {
          if (!report.downloading && report.offline) {
            r()
            clearInterval(t)
          }
        }, 80)
      })
    else if (report)
      report.downloading = true
    this.ref.markForCheck()

    return Filesystem.downloadFile({
      url: `${environment.shop_api}/reports/queue/${task_id}?usercode=${this.user.userinfo.userCode}`,
      directory: Directory.Documents,
      path: this.getReportPath(filename),
      recursive: true
    }).then((res: DownloadFileResult): void => {
      if (report)
        report.offline = true
      this.ref.markForCheck()
    }).finally((): void => {
      if (report)
        report.downloading = false
      this.ref.markForCheck()
    })
  }

  get menuItemActive(): boolean {
    if (!this.user.activeUser && this.user.userinfo && [2, 3, 4].includes(this.user.userinfo.type))
      return false
    return true
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

  openReport(uri: string, type?: string): void {
    const fileOpenerOptions: FileOpenerOptions = {
      filePath: uri,
      contentType: type ?? uri.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.ms-excel',
      openWithDefault: true
    }
    FileOpener.open(fileOpenerOptions)
  }

  async confirmRunReport(report: $TSFixMe): Promise<boolean> {
    return this.selectExtension(report)
  }

  async deleteTask(report: IRequestedReport): Promise<void> {
    try {
      await this.deleteReport(report.name)
    } finally {
      await firstValueFrom(this.api.deleteShop(`reports/queue/${report.id}`, { usercode: this.user.userinfo.userCode }))
      await this.loadRequestedReports()
    }
  }

  async deleteReport(name: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        directory: Directory.Documents,
        path: this.getReportPath(name)
      })
    } finally {
      this.offline_reports = this.offline_reports.filter(e => e.name !== name)
      this.ref.markForCheck()
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

  async downloadReportFinal(report: IRequestedReportDisplay): Promise<void> {
    // check if file exists
    if (report.downloading) {
      await new Promise<void>((r: () => void): void => {
        let t: number = window.setInterval((): void => {
          if (!report.downloading && report.offline) {
            r()
            clearInterval(t)
          }
        }, 80)
      })
    }

    try {
      const stat: StatResult = await Filesystem.stat({
        directory: Directory.Documents,
        path: this.getReportPath(report.name)
      })
      report.offline = true
      report.downloading = false
      this.ref.markForCheck()
      this.openReport(stat.uri)
    } catch {
      report.offline = false
      report.downloading = true
      this.ref.markForCheck()

      const result: DownloadFileResult = await Filesystem.downloadFile({
        url: `${environment.shop_api}/reports/queue/${report.id}?usercode=${this.user.userinfo.userCode}`,
        directory: Directory.Documents,
        path: this.getReportPath(report.name),
        recursive: true
      })
      report.offline = true
      report.downloading = false
      this.ref.markForCheck()
      this.openReport(result.path)
    }
  }

  getReportPath(filename: string): string {
    let path: string = 'reports/'

    if (this.currentCustomer)
      path += this.currentCustomer + '/'
    path += filename

    return 'reports/' + filename
  }

  get currentCustomer(): string {
    if (this.user.hasAgentAccess)
      return this.user.activeUser.addressName != null ? `${this.user.activeUser.address} ${this.user.activeUser.addressName}` : `${this.user.activeUser.id} ${this.user.activeUser.name}`
    else if (this.user.multiUser)
      return this.user.activeUser.addressName != null ? this.user.activeUser.addressName : this.user.activeUser.name

    return undefined
  }

  private handleReport(report: $TSFixMe, type: number, mode: number): void {
    this.api.postShop(`reports/${report.id}/queue`, undefined, {
      mode: mode === 4 ? 'mail' : 'download',
      type: type === 8 ? 'xls' : 'pdf',
      usercode: this.user.userinfo.userCode,
      customer_id: this.user.activeUser.id,
      address_id: this.user.activeUser.address,
      culture: this.translate.currentLang.split('-')[0]
    }).subscribe((resp: IBaseApiResponse<IQueueReport>): void => {
      if (mode === 1) {
        this.loadRequestedReports().then((): void => {
          const _report: IRequestedReportDisplay = this.my_reports.find((x: IRequestedReport): boolean => x.id === resp.data.uuid)
          // this.statistics.reportQueue(this.user.userinfo.userId, report.id)
          this.checkReportProgress(_report, mode)
        })
      }
    })
  }

  private checkReportProgress(report: IRequestedReportDisplay, count: number = 0): void {
    setTimeout((): void => {
      firstValueFrom(this.api.getShop('reports/queue/' + report.id, { usercode: this.user.userinfo.userCode }))
        .catch((err: any): void => {
          if (err.status === 400) {
            // busy, check again
            console.log(err)
            if (count > MAX_COUNT)
              return
            this.checkReportProgress(report, count + 1)
          } else if (err.status === 200) {
            // done
            this.downloadReportFinal(report)
          }
        })
    }, 500)
  }
}

export interface IBaseApiResponse<T> {
  status: 'success' | 'error' | 'failure'
  code: number
  executionTime?: number
  data: T
}

export interface IRequestedReport {
  id: string
  name: string
  mode: {
    download: number
    mail: number
  }
  executionTime: Date
  completionTime?: Date
  progress: number
}

export interface IQueueReport {
  uuid: string
  uri: string
}

export interface IRequestedReportDisplay extends IRequestedReport {
  offline?: boolean
  downloading?: boolean
}
