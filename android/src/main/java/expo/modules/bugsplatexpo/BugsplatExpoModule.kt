package expo.modules.bugsplatexpo

import android.app.Activity
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import com.bugsplat.android.BugSplatBridge
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

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

    AsyncFunction("post") { message: String, callstack: String, options: Map<String, Any>? ->
      val postDatabase = database
      val postApp = applicationName
      val postVersion = applicationVersion
      var postAppKey = appKey
      var postUser = userName
      var postEmail = userEmail
      var postDescription = ""

      options?.let { opts ->
        (opts["appKey"] as? String)?.let { postAppKey = it }
        (opts["user"] as? String)?.let { postUser = it }
        (opts["email"] as? String)?.let { postEmail = it }
        (opts["description"] as? String)?.let { postDescription = it }
      }

      try {
        val url = URL("https://$postDatabase.bugsplat.com/post/js/")
        val boundary = UUID.randomUUID().toString()
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")

        val writer = OutputStreamWriter(connection.outputStream)

        fun writeField(name: String, value: String) {
          writer.write("--$boundary\r\n")
          writer.write("Content-Disposition: form-data; name=\"$name\"\r\n\r\n")
          writer.write("$value\r\n")
        }

        writeField("database", postDatabase)
        writeField("appName", postApp)
        writeField("appVersion", postVersion)
        writeField("appKey", postAppKey)
        writeField("user", postUser)
        writeField("email", postEmail)
        writeField("description", postDescription)
        writeField("callstack", callstack)

        if (attributes.isNotEmpty()) {
          val json = org.json.JSONObject(attributes as Map<*, *>).toString()
          writeField("attributes", json)
        }

        writer.write("--$boundary--\r\n")
        writer.flush()
        writer.close()

        val responseCode = connection.responseCode
        connection.disconnect()

        if (responseCode == 200) {
          mapOf("success" to true)
        } else {
          mapOf("success" to false, "error" to "HTTP $responseCode")
        }
      } catch (e: Exception) {
        mapOf("success" to false, "error" to (e.message ?: "Unknown error"))
      }
    }

    Function("setUser") { name: String, email: String ->
      userName = name
      userEmail = email
      attributes["userName"] = name
      attributes["userEmail"] = email

      // Re-init BugSplatBridge with updated attributes (idempotent)
      if (initialized) {
        BugSplatBridge.initBugSplat(
          currentActivity,
          database,
          applicationName,
          applicationVersion,
          attributes,
          attachments
        )
      }
    }

    Function("setAttribute") { key: String, value: String ->
      attributes[key] = value

      // Re-init BugSplatBridge with updated attributes (idempotent)
      if (initialized) {
        BugSplatBridge.initBugSplat(
          currentActivity,
          database,
          applicationName,
          applicationVersion,
          attributes,
          attachments
        )
      }
    }

    Function("crash") {
      BugSplatBridge.crash()
    }
  }
}
