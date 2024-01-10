import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { shell } from 'electron';

@Injectable({
  providedIn: 'root'
})
export class BrowserService {

  constructor() { }

  open(url: string, target: string = null, features: string = null) {
    if (Capacitor.getPlatform() === 'electron') {
      // Dikke pech
      shell.openExternal(url)
    } else {
      window.open(url, target, features)
    }
  }
}
