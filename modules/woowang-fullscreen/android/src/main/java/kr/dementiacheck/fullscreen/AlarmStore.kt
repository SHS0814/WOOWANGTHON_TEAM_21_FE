package kr.dementiacheck.fullscreen

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject

/** 예약한 복약 질문. 재부팅 뒤 다시 걸 수 있게 기기에 적어 둔다 */
data class DoseAlarm(val id: String, val at: Long, val title: String, val body: String, val url: String)

object AlarmStore {
  private const val PREFS = "woowang_fullscreen_alarms"
  const val EXTRA_ID = "woowang_alarm_id"
  /** 이 값이 붙은 인텐트로 열린 화면만 잠금 화면 위에 보인다 */
  const val EXTRA_FULL_SCREEN = "woowang_fullscreen"

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun ids(context: Context): List<String> = prefs(context).all.keys.toList()

  fun get(context: Context, id: String): DoseAlarm? {
    val raw = prefs(context).getString(id, null) ?: return null
    return try {
      val o = JSONObject(raw)
      DoseAlarm(id, o.getLong("at"), o.getString("title"), o.getString("body"), o.getString("url"))
    } catch (e: Exception) {
      null
    }
  }

  fun schedule(context: Context, alarm: DoseAlarm) {
    val json = JSONObject().put("at", alarm.at).put("title", alarm.title).put("body", alarm.body).put("url", alarm.url)
    prefs(context).edit().putString(alarm.id, json.toString()).apply()
    setAlarm(context, alarm)
  }

  fun cancel(context: Context, id: String) {
    prefs(context).edit().remove(id).apply()
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    manager.cancel(alarmIntent(context, id))
  }

  fun cancelAll(context: Context) = ids(context).forEach { cancel(context, it) }

  /** 울린 뒤에는 기록만 지운다 */
  fun forget(context: Context, id: String) {
    prefs(context).edit().remove(id).apply()
  }

  /** 재부팅·앱 업데이트 뒤: 아직 오지 않은 시각만 다시 건다 */
  fun rescheduleAll(context: Context) {
    val now = System.currentTimeMillis()
    for (id in ids(context)) {
      val alarm = get(context, id)
      if (alarm == null || alarm.at <= now) forget(context, id) else setAlarm(context, alarm)
    }
  }

  private fun alarmIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, DoseAlarmReceiver::class.java)
      .setAction("kr.dementiacheck.fullscreen.DOSE_ALARM")
      // 건마다 다른 PendingIntent 가 되게 한다
      .setData(Uri.parse("woowang-alarm:" + Uri.encode(id)))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun setAlarm(context: Context, alarm: DoseAlarm) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val operation = alarmIntent(context, alarm.id)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
    if (exact) {
      // 정시 전달 (기존 알림의 delivery: 'alarmClock' 과 같은 방식)
      val show = PendingIntent.getActivity(
        context, 0, launchIntent(context, alarm.url, false), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(alarm.at, show), operation)
    } else {
      // 정확한 알람 권한이 없으면 몇 분 늦을 수 있다 (기존 알림과 같은 한계)
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.at, operation)
    }
  }

  /** 앱의 질문 화면을 여는 인텐트. 딥링크를 받을 화면을 못 찾으면 앱 첫 화면을 연다 */
  fun launchIntent(context: Context, url: String, fullScreen: Boolean): Intent {
    var intent: Intent? = Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName)
    if (intent?.resolveActivity(context.packageManager) == null) {
      intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    }
    return (intent ?: Intent())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra(EXTRA_FULL_SCREEN, fullScreen)
  }
}
