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

    AsyncFunction("post") { (message: String, callstack: String, options: [String: Any]?) -> [String: Any] in
      let postDatabase = self.database
      let postApp = self.applicationName
      let postVersion = self.applicationVersion
      var postAppKey = self.appKey
      var postUser = self.userName
      var postEmail = self.userEmail
      var postDescription = ""

      if let opts = options {
        if let key = opts["appKey"] as? String { postAppKey = key }
        if let user = opts["user"] as? String { postUser = user }
        if let email = opts["email"] as? String { postEmail = email }
        if let desc = opts["description"] as? String { postDescription = desc }
      }

      let url = URL(string: "https://\(postDatabase).bugsplat.com/post/js/")!
      let boundary = UUID().uuidString
      var request = URLRequest(url: url)
      request.httpMethod = "POST"
      request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

      var body = Data()

      func appendField(_ name: String, _ value: String) {
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(value)\r\n".data(using: .utf8)!)
      }

      appendField("database", postDatabase)
      appendField("appName", postApp)
      appendField("appVersion", postVersion)
      appendField("appKey", postAppKey)
      appendField("user", postUser)
      appendField("email", postEmail)
      appendField("description", postDescription)
      appendField("callstack", callstack)

      if !self.attributes.isEmpty {
        if let json = try? JSONSerialization.data(withJSONObject: self.attributes),
           let jsonString = String(data: json, encoding: .utf8) {
          appendField("attributes", jsonString)
        }
      }

      body.append("--\(boundary)--\r\n".data(using: .utf8)!)
      request.httpBody = body

      do {
        let (_, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
          return ["success": true]
        } else {
          let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
          return ["success": false, "error": "HTTP \(statusCode)"]
        }
      } catch {
        return ["success": false, "error": error.localizedDescription]
      }
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

    Function("crash") {
      let array = NSArray()
      _ = array.object(at: 99)
    }
  }
}
