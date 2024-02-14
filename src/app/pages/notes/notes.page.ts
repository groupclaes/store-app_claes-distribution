import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { ApiService } from 'src/app/core/api.service';
import { IUnsentVisitNote, IVisitNote, NotesRepositoryService } from 'src/app/core/repositories/notes.repository.service';
import { UserService } from 'src/app/core/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.page.html',
  styleUrls: ['./notes.page.scss'],
})
export class NotesPage {
  showCreate = false;
  isEditing = false;
  notes: IVisitNote[]
  newNote: IUnsentVisitNote

  constructor(private user: UserService,
    private translate: TranslateService,
    private alert: AlertController,
    private ref: ChangeDetectorRef,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private api: ApiService,
    private logger: LoggingProvider,
    private notesRepository: NotesRepositoryService,
    private toast: ToastController) { }

  get culture(): string {
    return this.translate.currentLang
  }

  get debugging() {
    return !environment.production
  }

  ionViewWillEnter() {
    return this.loadNotes()
  }

  async ionViewDidEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('LoginPage')
    } else {
      await this.loadNotes()

      // eslint-disable-next-line eqeqeq
      if (this.route.snapshot.queryParams.createNote === true) {
        const lastUnsent = await this.notesRepository.getLastUnsentNote(this.user.activeUser.id, this.user.activeUser.address)
        if (lastUnsent != null && lastUnsent.date.toLocaleDateString() === new Date().toLocaleDateString()) {
          // Check if last note is made today, otherwise create new
          this.addNote(lastUnsent)
        } else {
          this.addNote()
        }
      }

      this.ref.markForCheck()
    }
  }

  ionViewWillLeave() {
    if (this.route.snapshot.queryParams.selectedCust == null) {
      this.notesRepository.hasUnsentNotes(this.user.activeUser.id, this.user.activeUser.address)
        .then(hasUnsentNotes => {
          if (hasUnsentNotes) {
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
        })
    }
  }

  addNote(noteSource?: IVisitNote) {
    this.newNote = {
      id: null,
      date: noteSource ? noteSource.date : new Date(),
      text: noteSource ? noteSource.text : '',
      customer: this.user.activeUser.id,
      address: this.user.activeUser.address,
      nextVisit: new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      customerCloseFrom: null,
      customerOpenFrom: null,
      toSend: false
    }
    if (noteSource != null && 'id' in noteSource) {
      if ('toSend' in noteSource && !noteSource.toSend) {
        this.newNote.id = noteSource.id as number;
      }

      // IUnsentVisitNote
      this.newNote.customerCloseFrom = (noteSource as IUnsentVisitNote).customerCloseFrom
      this.newNote.customerOpenFrom = (noteSource as IUnsentVisitNote).customerOpenFrom
    }

    this.showCreate = true
    this.ref.markForCheck()
  }

  deleteNote(note: IUnsentVisitNote) {
    this.alert.create({
      header: this.translate.instant('pages.notes.confirmDelete.title'),
      subHeader: this.translate.instant('pages.notes.confirmDelete.description'),
      buttons: [
        {
          text: this.translate.instant('actions.delete'),
          handler: async () => {
            try {
              await this.notesRepository.deleteUnsentNote(note.id)
              await this.loadNotes()

              this.newNote = undefined
              this.showCreate = false
              this.ref.markForCheck()
            } catch (err) {
              this.logger.error('Couldn\'t delete unsent note', JSON.stringify(err))
            }
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
    try {
      const result = await this.notesRepository.getUnsentNotes(this.user.activeUser.id,
        this.user.activeUser.address) as IVisitNote[]
      console.log(result)

      const notes = await this.notesRepository.getCustomerNotes(this.user.activeUser.id,
        this.user.activeUser.address)

      // Trim notes and add to the result
      for (const note of notes) {
        note.text = note.text.split(`''`).join(`'`)
        while (note.text.startsWith('\n')) {
          note.text = note.text.substring(2)
        }

        result.push(note)
      }
      this.notes = result
      this.ref.markForCheck()
    } catch (err) {
      this.logger.error('Couldn\'t fetch notes for customer', JSON.stringify(err))
    }
  }

  async save(note: IUnsentVisitNote) {
    await this.notesRepository.saveNote(note, false)

    this.showCreate = false
    this.newNote = undefined
    this.ref.markForCheck()

    if (!this.completUserSwitch()) {
      return this.loadNotes()
    }
  }

  async send(note: IUnsentVisitNote) {
    this.showCreate = false
    this.newNote = undefined
    this.ref.markForCheck()

    await this.notesRepository.saveNote(note, true)

    try {
      // Try to send all unsent notes
      const unsentNotes = await this.notesRepository.getUnsentNotes(this.user.activeUser.id,
        this.user.activeUser.address)

      let counterSent = 0
      let counterFailed = 0
      for (const unsentNote of unsentNotes) {
        if (unsentNote.toSend) {
          try {
            const result = await firstValueFrom(this.api.post('app/notes/create', unsentNote))
            if (result) {
              await this.notesRepository.deleteUnsentNote(unsentNote.id)
              counterSent++
            } else {
              this.logger.error('Couldn\'t send backlog note ', result)
              counterFailed++
            }
          } catch (err) {
            counterFailed++
            this.logger.debug('Something wen\'t wrong when sending note', JSON.stringify(err))
          }
        }
      }

      this.toast.create({
        message: (this.translate.instant('pages.notes.deletedResult') as string)
          .replace('{{SENT}}', counterSent + '')
          .replace('{{FAILED}}', counterFailed + ''),
        duration: 5000
      }).then(x => x.present())

      if (!this.completUserSwitch()) {
        await this.loadNotes()
      }
    } catch (err) {
      this.logger.debug('Something wen\'t wrong when posting new note', JSON.stringify(err))
    }
  }

  isUnsentNote(note: IVisitNote) {
    return 'id' in note && 'toSend' in note
      && note.id != null && note.toSend === false
  }

  completUserSwitch() {
    if (this.route.snapshot.queryParams.selectedCust != null) {
      this.navCtrl.navigateRoot('/customers', { queryParams: { selectedCust: this.route.snapshot.queryParams.selectedCust } })
      return true
    }

    return false
  }
}
