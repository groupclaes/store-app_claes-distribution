#!/bin/bash

echo 'import Foundation
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
}' > ./node_modules/capacitor-read-native-setting/ios/Plugin/Plugin.swift