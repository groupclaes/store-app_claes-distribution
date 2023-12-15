import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Network } from '@capacitor/network';
import { AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { ApiService } from 'src/app/core/api.service';
import { IVisitNote, CustomersRepositoryService } from 'src/app/core/repositories/customers.repository.service';
import { StorageProvider } from 'src/app/core/storage-provider.service';
import { SyncService } from 'src/app/core/sync.service';
import { UserService } from 'src/app/core/user.service';

export const LS_SAVED_NOTES = 'saved_notes';
export const LS_TOSEND_NOTES = 'notesToSend';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.page.html',
  styleUrls: ['./notes.page.scss'],
})
export class NotesPage {
  showCreate = false;
  notes: IVisitNote[]
  newNote: IVisitNote

  constructor(private storage: StorageProvider,
    private user: UserService,
    private translate: TranslateService,
    private alert: AlertController,
    private ref: ChangeDetectorRef,
    private customers: CustomersRepositoryService,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private api: ApiService,
    private logger: LoggingProvider,
    private sync: SyncService) { }

  get culture(): string {
    return this.translate.currentLang
  }

  private get savedNotes(): IVisitNote[] {
    return this.getCustomerSavedNotes({
      customer: this.user.activeUser.id,
      address: this.user.activeUser.address
    } as IVisitNote)
  }

  ionViewDidEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('LoginPage')
    } else {
      this.loadNotes().then(_ => this.ref.markForCheck())
    }
  }

  ionViewWillLeave() {
    if (this.savedNotes.length > 0) {
      this.alert.create({
        header: this.translate.instant('pages.notes.unsavedNotes.title'),
        subHeader: this.translate.instant('pages.notes.unsavedNotes.description'),
        buttons: [
          {
            text: this.translate.instant('actions.show'),
            handler: () => { this.navCtrl.navigateRoot('/notes') }
          },
          {
            text: this.translate.instant('actions.cancel'),
            role: 'cancel'
          }
        ]
      }).then(alert => alert.present())
    }
  }

  addNote(noteSource?: IVisitNote) {

    this.newNote = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Id: null,
      date: noteSource ? noteSource.date : new Date(),
      text: noteSource ? noteSource.text : '',
      customer: this.user.activeUser.id,
      address: this.user.activeUser.address,
      nextVisit: new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      customerCloseFrom: null,
      customerOpenFrom: null,
      _savedDate: null,
      _isSent: false
    }

    if (noteSource) {
      if (noteSource._isSent !== null) {
        this.newNote._isSent = noteSource._isSent
      }
      if (noteSource._savedDate !== null) {
        this.newNote._savedDate = noteSource._savedDate
      }
    }

    this.showCreate = true
    this.ref.markForCheck()
  }

  deleteNote(note: IVisitNote) {
    this.alert.create({
      header: this.translate.instant('pages.notes.confirmDelete.title'),
      subHeader: this.translate.instant('pages.notes.confirmDelete.description'),
      buttons: [
        {
          text: this.translate.instant('actions.delete'),
          handler: () => {
            this.storage.set(LS_SAVED_NOTES, this.getFilteredNotes(note))

            this.showCreate = false
            this.loadNotes()
          }
        },
        {
          text: this.translate.instant('actions.cancel'),
          role: 'cancel'
        }
      ]
    }).then(alert => alert.present())
  }


  async loadNotes() {
    const notes = await this.customers.getNotes(this.user.activeUser.id,
      this.user.activeUser.address)
    const result: IVisitNote[] = [];

    for (const note of notes) {
      note.text = note.text.split(`''`).join(`'`)
      while (note.text.startsWith('\n')) {
        note.text = note.text.substring(2)
      }


      result.push(note)
    }

    result.unshift(...this.savedNotes);

    this.notes = result;
    this.ref.markForCheck();
  }

  save(note: IVisitNote) {
    const savedNotes = this.getFilteredNotes(note)

    note._savedDate = new Date();
    savedNotes.push(note)
    console.log(savedNotes)

    this.showCreate = false
    this.newNote = undefined
    this.ref.markForCheck()

    this.storage.set(LS_SAVED_NOTES, savedNotes)
    this.loadNotes()
  }

  async send(note: IVisitNote) {
    this.showCreate = false
    this.newNote = undefined
    this.ref.markForCheck()

    const savedDate = note._savedDate;
    const opennotes: any[] = this.storage.get(LS_TOSEND_NOTES) || [];

    const newOpenNotes = [];
    try {
      const result = await firstValueFrom(this.api.post('app/notes/create', note))
      if (result) {
        this.ref.markForCheck()
        for (const oldNote of opennotes) {
          try {
            const q = await firstValueFrom(this.api.post('app/notes/create', oldNote));
            if (!q) {
              newOpenNotes.push(oldNote)
            }
          } catch {
            newOpenNotes.push(oldNote)
          }
        }

        this.storage.set(LS_SAVED_NOTES,
          this.storage.get<IVisitNote[]>(LS_SAVED_NOTES)
            .filter((x: IVisitNote) => x._savedDate !== savedDate))
        this.notes = this.notes.filter(x => x._savedDate !== note._savedDate)

        note._isSent = true
        delete note._savedDate

        this.navCtrl.navigateRoot('/customers', { queryParams: { selectedCust: this.route.snapshot.params.selectedCust } })

        Network.getStatus().then(async status => {
          if (status.connected) {
            this.sync.syncNotes(this.user.credential, this.user.userinfo.language, true)
          }
        })
      } else {
        console.error(result)
      }

      this.storage.set(LS_TOSEND_NOTES, newOpenNotes);
      this.ref.markForCheck();
    } catch (err) {
      this.logger.debug('Something wen\'t wrong when posting new note', err)
      newOpenNotes.push(note);
      this.storage.set(LS_TOSEND_NOTES, newOpenNotes);
    }
  }

  private getFilteredNotes(note: IVisitNote): IVisitNote[] {
    const savedNotes: IVisitNote[] = this.storage.get(LS_SAVED_NOTES) || []

    return savedNotes.filter(x => (x.customer !== note.customer && x.address !== note.address) || x._savedDate !== note._savedDate)
  }

  private getCustomerSavedNotes(noteToExclude: IVisitNote): IVisitNote[] {
    const savedNotes: IVisitNote[] = this.storage.get(LS_SAVED_NOTES) || [];

    return savedNotes.filter(x => (x.customer === noteToExclude.customer && x.address === noteToExclude.address)
      && x._savedDate !== noteToExclude._savedDate)
  }
}

