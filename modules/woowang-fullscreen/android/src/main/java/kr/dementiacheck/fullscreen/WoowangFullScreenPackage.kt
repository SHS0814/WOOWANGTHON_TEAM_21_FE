package kr.dementiacheck.fullscreen

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.WindowManager
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/**
 * 복약 알람이 연 화면만 잠금 화면 위에 보이고 화면을 켠다.
 * 다른 경로(앱 아이콘, 보호자 푸시)로 연 화면은 평소처럼 잠금 해제 뒤에 보인다
 */
class WoowangFullScreenPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(LockScreenListener())
}

class LockScreenListener : ReactActivityLifecycleListener {
  private var activityRef: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    activityRef = WeakReference(activity)
    apply(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    activityRef?.get()?.let { apply(it, intent) }
    return false
  }

  /** 알람으로 화면을 띄우는 중인지 */
  private var active = false
  /** 띄운 뒤 화면이 실제로 앞에 나왔는지. 나오기 전에 오는 onPause 에서 되돌리면 화면이 켜지지 않는다 (S22 Ultra 에서 확인) */
  private var shown = false

  override fun onResume(activity: Activity) {
    if (active) shown = true
  }

  /**
   * 화면이 꺼지면 원래대로 돌린다.
   * 그대로 두면 전원 버튼으로 화면을 꺼도 다시 켜지고, 다음에 켤 때 잠금 해제 없이 앱이 보인다
   */
  override fun onPause(activity: Activity) {
    if (!active || !shown) return
    val power = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!power.isInteractive) reset(activity)
  }

  /** 홈 버튼 등으로 앱을 떠날 때도 돌린다 */
  override fun onUserLeaveHint(activity: Activity) {
    if (active && shown) reset(activity)
  }

  private fun reset(activity: Activity) {
    active = false
    shown = false
    set(activity, false)
  }

  private fun apply(activity: Activity, intent: Intent?) {
    if (intent?.getBooleanExtra(AlarmStore.EXTRA_FULL_SCREEN, false) != true) return
    // 같은 인텐트로 두 번 켜지지 않게 표시를 지운다 (화면 회전 등으로 Activity 가 다시 만들어질 때)
    intent.removeExtra(AlarmStore.EXTRA_FULL_SCREEN)
    active = true
    shown = false
    set(activity, true)
  }

  private fun set(activity: Activity, on: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(on)
      activity.setTurnScreenOn(on)
    } else {
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      @Suppress("DEPRECATION")
      if (on) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
    }
  }
}
