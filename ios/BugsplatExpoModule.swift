import ExpoModulesCore
import BugSplat

class BugsplatDelegate: NSObject, BugSplatDelegate {
  func bugSplatWillSendCrashReport(_ bugSplat: BugSplat) {
    NSLog("[BugsplatExpo] Will send crash report")
  }

  func bugSplatDidFinishSendingCrashReport(_ bugSplat: BugSplat) {
    NSLog("[BugsplatExpo] Finished sending crash report")
  }

  func bugSplat(_ bugSplat: BugSplat, didFailWithError error: Error) {
    NSLog("[BugsplatExpo] Failed to send crash report: %@", error.localizedDescription)
  }

  func bugSplatWillCancelSendingCrashReport(_ bugSplat: BugSplat) {
    NSLog("[BugsplatExpo] User cancelled sending crash report")
  }
}

public class BugsplatExpoModule: Module {
  private var database: String = ""
  private var applicationName: String = ""
  private var applicationVersion: String = ""
  private var appKey: String = ""
  private var userName: String = ""
  private var userEmail: String = ""
  private var attributes: [String: String] = [:]
  private let bugsplatDelegate = BugsplatDelegate()

  public func definition() -> ModuleDefinition {
    Name("BugsplatExpo")

    AsyncFunction("init") { (database: String, application: String, version: String, options: [String: Any]?) in
      self.database = database
      self.applicationName = application
      self.applicationVersion = version

      let bs = BugSplat.shared()
      bs.delegate = self.bugsplatDelegate
      bs.bugSplatDatabase = database
      bs.applicationName = application
      bs.applicationVersion = version
      bs.autoSubmitCrashReport = true

      if let opts = options {
        if let autoSubmit = opts["autoSubmitCrashReport"] as? Bool {
          bs.autoSubmitCrashReport = autoSubmit
        }
        if let name = opts["userName"] as? String {
          bs.userName = name
          self.userName = name
        }
        if let email = opts["userEmail"] as? String {
          bs.userEmail = email
          self.userEmail = email
        }
        if let key = opts["appKey"] as? String {
          bs.appKey = key
          self.appKey = key
        }
        if let desc = opts["description"] as? String {
          bs.notes = desc
        }
        if let attrs = opts["attributes"] as? [String: String] {
          for (key, value) in attrs {
            _ = bs.set(value, for: key)
            self.attributes[key] = value
          }
        }
      }

      bs.start()
    }

    Function("setUser") { (name: String, email: String) in
      self.userName = name
      self.userEmail = email
      BugSplat.shared().userName = name
      BugSplat.shared().userEmail = email
    }

    Function("setAttribute") { (key: String, value: String) in
      self.attributes[key] = value
      _ = BugSplat.shared().set(value, for: key)
    }

    Function("removeAttribute") { (key: String) in
      self.attributes.removeValue(forKey: key)
      _ = BugSplat.shared().set(nil, for: key)
    }

    Function("crash") {
      let array = NSArray()
      _ = array.object(at: 99)
    }
  }
}
