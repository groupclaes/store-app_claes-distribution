import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { NavController, MenuController } from '@ionic/angular'

export interface Slide {
  title: string
  description: string
  image: string
}

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.page.html',
  styleUrls: ['./tutorial.page.scss'],
})
export class TutorialPage implements OnInit {
  constructor(
    private navCtrl: NavController,
    private menu: MenuController,
    private ref: ChangeDetectorRef
  ) {
    this.menu.enable(false)
    const tutorialCompleted = localStorage.getItem('tutorialCompleted')
    if (tutorialCompleted === 'true') {
      this.navCtrl.navigateRoot('/account/login')
      this.menu.enable(true)
    }
  }

  ngOnInit() {
  }

  startApp() {
    localStorage.setItem('tutorialCompleted', 'true')
    // enable the root left menu when leaving the tutorial page
    this.menu.enable(true)
    this.navCtrl.navigateRoot('/account/login', {
      animated: true
    })
  }
}
