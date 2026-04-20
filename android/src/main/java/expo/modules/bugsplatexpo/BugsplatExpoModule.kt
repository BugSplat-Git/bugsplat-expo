package expo.modules.bugsplatexpo

import android.app.Activity
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import com.bugsplat.android.BugSplatBridge

class BugsplatExpoModule : Module() {
  private var database: String = ""
  private var applicationName: String = ""
  private var applicationVersion: String = ""
  private var appKey: String = ""
  private var userName: String = ""
  private var userEmail: String = ""
  private var attributes: MutableMap<String, String> = mutableMapOf()
  private var attachments: Array<String>? = null
  private var initialized = false

  private val currentActivity: Activity
    get() = appContext.currentActivity ?: throw Exceptions.MissingActivity()

  override fun definition() = ModuleDefinition {
    Name("BugsplatExpo")

    AsyncFunction("init") { database: String, application: String, version: String, options: Map<String, Any>? ->
      this@BugsplatExpoModule.database = database
      this@BugsplatExpoModule.applicationName = application
      this@BugsplatExpoModule.applicationVersion = version

      options?.let { opts ->
        (opts["appKey"] as? String)?.let { appKey = it; attributes["appKey"] = it }
        (opts["userName"] as? String)?.let { userName = it; attributes["userName"] = it }
        (opts["userEmail"] as? String)?.let { userEmail = it; attributes["userEmail"] = it }
        (opts["description"] as? String)?.let { attributes["description"] = it }
        @Suppress("UNCHECKED_CAST")
        (opts["attributes"] as? Map<String, String>)?.let { attributes.putAll(it) }
        @Suppress("UNCHECKED_CAST")
        (opts["attachments"] as? List<String>)?.let { attachments = it.toTypedArray() }
      }

      // Run initBugSplat on the main thread — Crashpad handler setup requires it
      val activity = currentActivity
      val attrs = if (attributes.isNotEmpty()) attributes else null
      val attach = attachments
      val latch = java.util.concurrent.CountDownLatch(1)
      var initError: Exception? = null

      activity.runOnUiThread {
        try {
          if (attrs != null || attach != null) {
            BugSplatBridge.initBugSplat(activity, database, application, version, attrs ?: mutableMapOf(), attach)
          } else {
            BugSplatBridge.initBugSplat(activity, database, application, version)
          }
        } catch (e: Exception) {
          Log.e("BugsplatExpo", "initBugSplat failed", e)
          initError = e
        } finally {
          latch.countDown()
        }
      }

      latch.await()
      initError?.let { throw it }
      initialized = true
    }

    Function("setUser") { name: String, email: String ->
      userName = name
      userEmail = email
      attributes["userName"] = name
      attributes["userEmail"] = email

      if (initialized) {
        BugSplatBridge.setAttribute("userName", name)
        BugSplatBridge.setAttribute("userEmail", email)
      }
    }

    Function("setAttribute") { key: String, value: String ->
      attributes[key] = value

      if (initialized) {
        BugSplatBridge.setAttribute(key, value)
      }
    }

    Function("removeAttribute") { key: String ->
      attributes.remove(key)

      if (initialized) {
        BugSplatBridge.removeAttribute(key)
      }
    }

    Function("crash") {
      BugSplatBridge.crash()
    }

    Function("hang") {
      // BugSplatBridge.hang() blocks the calling thread in a native infinite
      // loop — ANR detection requires hanging the main/UI thread, so dispatch
      // there and return immediately to avoid blocking the JS bridge.
      appContext.currentActivity?.runOnUiThread {
        BugSplatBridge.hang()
      } ?: throw Exceptions.MissingActivity()
    }
  }
}
