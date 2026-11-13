package kr.dementiacheck.fullscreen

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

/** 복약 시각에 깨어나 질문 화면을 띄우는 알림을 낸다. 화면이 꺼져 있거나 잠겨 있으면 화면이 바로 열리고, 폰을 쓰는 중이면 위쪽 알림으로 보인다 */
class DoseAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmStore.EXTRA_ID) ?: return
    val alarm = AlarmStore.get(context, id) ?: return
    AlarmStore.forget(context, id)

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    ensureChannel(manager)

    // 요청 코드를 건마다 다르게 해서 여러 알림이 서로의 인텐트를 덮어쓰지 않게 한다
    val open = PendingIntent.getActivity(
      context, id.hashCode(), AlarmStore.launchIntent(context, alarm.url, true),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(alarm.title)
      .setContentText(alarm.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(alarm.body))
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .build()
    try {
      manager.notify(id, NOTIFICATION_ID, notification)
    } catch (e: SecurityException) {
      // 알림 권한이 꺼져 있으면 낼 수 없다. 권한 상태는 앱이 보호자에게 따로 알린다
    }
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "복약 시간 (화면에 띄우기)", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "약 드실 시간에 질문 화면을 띄워요"
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 800, 400, 800)
      // 기존 복약 알림 채널과 같이 알람 볼륨으로 울린다
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
      )
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "dose-ask-screen"
    const val NOTIFICATION_ID = 7301
  }
}
