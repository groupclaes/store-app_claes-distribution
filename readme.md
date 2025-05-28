# Store App - Claes Distribution

## Incremental updates
```sh
# Bump the version to a new patch version
bash ./tools/update_version.sh

# Bump the version to a new minor version
bash ./tools/update_version.sh minor

# Bump to a new major version
bash ./tools/update_version.sh major
```


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

### Settings plugin fix
There is a script that will automatically patch the Plugin to use the current format:
```sh
bash ./tools/patch_modules.sh
```


Path: `node_modules/capacitor-read-native-setting\ios\Plugin\Plugin.swift`
```swift
import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CapacitorReadNativeSetting)
public class CapacitorReadNativeSetting: CAPPlugin {
    let userDefaults = UserDefaults.standard
    var registered = false

    func configureSettingsBundle() {
        guard let settingsBundle = Bundle.main.url(forResource: "Settings", withExtension:"bundle") else {
            print("Settings.bundle not found")
            return;
        }
        
        guard let settings = NSDictionary(contentsOf: settingsBundle.appendingPathComponent("Root.plist")) else {
            print("Root.plist not found in settings bundle")
            return
        }
        
        guard let preferences = settings.object(forKey: "PreferenceSpecifiers") as? [[String: AnyObject]] else {
            print("Root.plist has invalid format")
            return
        }
        
        var defaultsToRegister = [String: AnyObject]()
        for pref in preferences {
            if let key = pref["Key"] as? String, let val = pref["DefaultValue"] {
                print("\(key)==> \(val)")
                defaultsToRegister[key] = val
            }
        }
        userDefaults.register(defaults: defaultsToRegister)
        registered = true
    }

    @objc func read(_ call: CAPPluginCall) {
        if (!registered) {
            configureSettingsBundle()
        }
        
        let userDefault = UserDefaults.standard
        // Fetch value from Setting bundle
        
        let key = call.getString("key") ?? ""

        print("Getting value for (\(key))")
        
        if let value = userDefault.value(forKey: key) {
            call.resolve([
                "value": value
            ])
        } else {
            call.resolve([
                "value": nil
            ])
        }
    }
}
```
