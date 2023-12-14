import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-optional-input-modal',
  templateUrl: './optional-input-modal.component.html',
  styleUrls: ['./optional-input-modal.component.scss'],
})
export class OptionalInputModalComponent {
  @Input()
  cancelButton: string
  @Input()
  confirmButton: string
  @Input()
  title: string

  @Input()
  label: string
  @Input()
  placeholder: string

  inputValue: string

  constructor(private modalCtrl: ModalController) {}

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    return this.modalCtrl.dismiss(this.inputValue, 'confirm');
  }
}
