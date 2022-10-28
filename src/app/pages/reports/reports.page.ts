import { Component, ChangeDetectionStrategy, OnInit, ChangeDetectorRef } from '@angular/core'
import { ActionSheetController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { ApiService } from 'src/app/core/api.service'
import { UserService } from 'src/app/core/user.service'
import { ReportsRepositoryService } from 'src/app/core/repositories/reports.repository.service'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPage implements OnInit {
  loading = true
  private _reports: $TSFixMe[]
  private _myreports: $TSFixMe[]

  constructor(
    private translate: TranslateService,
    private actionSheetCtrl: ActionSheetController,
    private api: ApiService,
    private user: UserService,
    private ref: ChangeDetectorRef,
    private logger: LoggingProvider,
    private reportsRepository: ReportsRepositoryService
    // private statistics: StatisticsProvider
  ) { }

  ngOnInit() {
    this.loadReports()
  }

  async loadReports() {
    if (this._reports && this._reports.length) { return; }
    this.loading = true
    this.ref.markForCheck()

    try {
      this._reports = await this.reportsRepository.get(this.user.hasAgentAccess, this.culture)
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

  loadReportList() {
    this.loading = true
    this.ref.markForCheck()

    this.api.get('reports/list', {
      userCode: this.user.userinfo.userCode
    }).subscribe((resp: $TSFixMe) => {
      this._myreports = resp || []
      this.loading = false
      this.ref.markForCheck()
    })
  }

  async confirmRunReport(report: $TSFixMe): Promise<boolean> {
    const shouldRunReport = await this.selectExtension(report)
    return shouldRunReport
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
      this.checkReportProgress(resp, mode)
    })
  }

  private checkReportProgress(reportGuid: $TSFixMe, mode: number): void {
    setTimeout(() => {
      this.api.get(`reports/queue/${reportGuid}/status`, {
        userCode: this.user.userinfo.userCode
      }).subscribe((resp: $TSFixMe) => {
        if (resp && resp === true) {
          // done
          this.loadReportList()
          this.ref.markForCheck()
          if (mode === 1) {
            this.downloadReport(reportGuid)
          }
        } else {
          this.checkReportProgress(reportGuid, mode)
        }
      })
    }, 200)
  }

  async showActionMenu(report: $TSFixMe) {
    const actionSheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: 'Verwijderen', /* | translate */
          role: 'destructive',
          handler: () => {
            this.api.delete(`reports/${report.TaskId}`, {
              params: {
                userCode: this.user.userinfo.userCode
              }
            }).subscribe((resp) => {
              // this.statistics.reportDelete(this.user.userinfo.userId, report.TaskId)
              this.loadReportList()
            })
          }
        },
        {
          text: 'Downloaden',
          handler: () => {
            this.downloadReport(report.TaskId)
          }
        },
        {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel',
          handler: () => { }
        }
      ]
    })
    await actionSheet.present()
  }

  async selectExtension(report): Promise<boolean> {
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

  async selectMode(report, extension) {
    let resolveRunning
    const canRunning = new Promise<Boolean>(resolve => resolveRunning = resolve)
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('messages.choseDeliveryMethod'),
      buttons: [
        {
          text: this.translate.instant('actions.download'),
          handler: () => {
            this.handleReport(report, extension, 1)
            return resolveRunning(true)
          }
        },
        {
          text: this.translate.instant('actions.mail'),
          handler: () => {
            this.handleReport(report, extension, 4)
            return resolveRunning(true)
          }
        }, {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel',
          handler: () => {
            return resolveRunning(false)
          }
        }
      ]
    })
    await actionSheet.present()
    return canRunning
  }

  downloadReport(reportGuid: string): void {
    // this.statistics.reportDownload(this.user.userinfo.userId, reportGuid)
    window.open(
      `${this.api.url}/reports/queue/${reportGuid}?userCode=${this.user.userinfo.userCode}`,
      '_system',
    )
    // this.iab.create(`${this.api.url}/reports/queue/${reportGuid}?userCode=${this.user.userinfo.userCode}`, '_system', 'location=yes')
  }

  get menuItemActive(): boolean {
    if (!this.user.activeUser && this.user.userinfo && (this.user.userinfo.type === 2 || this.user.userinfo.type === 3 || this.user.userinfo.type === 4)) {
      return false
    }
    return true
  }

  get reports(): $TSFixMe[] {
    return this._reports || []
  }

  get myreports(): $TSFixMe[] {
    if (this._myreports) {
      return this._myreports
    }
    return []
  }

  get culture(): string {
    return this.translate.currentLang
  }
}
