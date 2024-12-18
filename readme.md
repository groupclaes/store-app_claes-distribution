# Store App - Claes Distribution


### iOS design Guidelines - iOS 18
#### ion-list usage
```html
<ion-text class="list-header">
  <ion-note translate>header</ion-note>
</ion-text>

<ion-list inset="true">
  <ion-item>item</ion-item>
</ion-list>

<ion-text class="list-footer">
   <ion-note translate>footer</ion-note>
</ion-text>
```
#### actions in ion-list
```html
<ion-list inset="true">
  <ion-item detail="false" button tappable (click)="logout()">
    <ion-label color="danger" style="text-align:center">{{ 'pages.settings.account.logout' | translate }</ion-label>
  </ion-item>
</ion-list>
```