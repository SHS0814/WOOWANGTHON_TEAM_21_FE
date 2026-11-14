package kr.dementiacheck.fullscreen

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** 복약 시간에 질문 화면을 잠금 화면 위로 띄우는 알람 (어르신 폰, "화면에 띄우기" 방식) */
class WoowangFullScreenModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WoowangFullScreen")

    /** Android 14 부터는 사용자가 설정에서 허용해야 한다. 그 전 버전은 항상 된다 */
    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openFullScreenSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + context.packageName))
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("schedule") { id: String, atMs: Double, title: String, body: String, url: String ->
      AlarmStore.schedule(context, DoseAlarm(id, atMs.toLong(), title, body, url))
    }

    Function("cancel") { id: String ->
      AlarmStore.cancel(context, id)
    }

    Function("cancelAll") {
      AlarmStore.cancelAll(context)
    }

    Function("scheduledIds") {
      AlarmStore.ids(context)
    }
  }
}
