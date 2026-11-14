package kr.dementiacheck.fullscreen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 재부팅하거나 앱을 업데이트하면 알람이 사라지므로 적어 둔 것을 다시 건다 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      AlarmStore.rescheduleAll(context)
    }
  }
}
