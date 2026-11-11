package com.ug.phyfi_router.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView

class RouterUI(context: Context) {

    val layout =
            LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(32, 32, 32, 32)
                setBackgroundColor(Color.parseColor("#0F1115"))
            }

    val pinInput =
            EditText(context).apply {
                hint = "Digite o PIN da Sala"
                setHintTextColor(Color.DKGRAY)
                setTextColor(Color.WHITE)
                inputType = InputType.TYPE_CLASS_NUMBER
                textSize = 18f
                gravity = Gravity.CENTER
                isEnabled = false // Bloqueado por padrão
            }

    val connectBtn =
            Button(context).apply {
                text = "AGUARDANDO PAREAMENTO..."
                setBackgroundColor(Color.DKGRAY)
                setTextColor(Color.GRAY)
                isEnabled = false // Bloqueado por padrão
            }

    private val ledWebRtc = createLed(context, "WebRTC P2P")
    private val ledBluetooth = createLed(context, "Bluetooth HID")

    private val logToggle =
            Switch(context).apply {
                text = "Exibir Logs Analíticos"
                setTextColor(Color.LTGRAY)
                isChecked = true
                setPadding(0, 32, 0, 16)
            }

    private val terminalUI =
            TextView(context).apply {
                text = "Subsistemas inativos.\n"
                textSize = 12f
                setTextColor(Color.parseColor("#AAAAAA"))
                typeface = Typeface.MONOSPACE
            }

    private val scrollContainer = ScrollView(context).apply { addView(terminalUI) }

    init {
        val titleUI =
                TextView(context).apply {
                    text = "PHY-FI ROUTER"
                    textSize = 20f
                    setTypeface(null, Typeface.BOLD)
                    setTextColor(Color.WHITE)
                    gravity = Gravity.CENTER
                    setPadding(0, 0, 0, 32)
                }

        val statusLayout =
                LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER
                    setPadding(0, 32, 0, 32)
                    addView(ledWebRtc.first)
                    addView(ledBluetooth.first)
                }

        layout.addView(titleUI)
        layout.addView(pinInput)
        layout.addView(connectBtn)
        layout.addView(statusLayout)
        layout.addView(logToggle)
        layout.addView(scrollContainer)

        logToggle.setOnCheckedChangeListener { _, isChecked ->
            scrollContainer.visibility = if (isChecked) View.VISIBLE else View.GONE
        }
    }

    private fun createLed(context: Context, label: String): Pair<LinearLayout, View> {
        val container =
                LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(16, 0, 16, 0)
                }
        val dot =
                View(context).apply {
                    layoutParams =
                            LinearLayout.LayoutParams(24, 24).apply { setMargins(0, 0, 16, 0) }
                    setBackgroundColor(Color.RED)
                }
        val text =
                TextView(context).apply {
                    this.text = label
                    setTextColor(Color.LTGRAY)
                    textSize = 12f
                }
        container.addView(dot)
        container.addView(text)
        return Pair(container, dot)
    }

    fun setReadyState(isReady: Boolean) {
        pinInput.isEnabled = isReady
        connectBtn.isEnabled = isReady
        if (isReady) {
            connectBtn.text = "INICIAR ROTEAMENTO"
            connectBtn.setBackgroundColor(Color.parseColor("#222222"))
            connectBtn.setTextColor(Color.parseColor("#00FF66"))
        } else {
            connectBtn.text = "AGUARDANDO PAREAMENTO..."
            connectBtn.setBackgroundColor(Color.DKGRAY)
            connectBtn.setTextColor(Color.GRAY)
        }
    }

    fun setWebRtcLed(active: Boolean) {
        ledWebRtc.second.setBackgroundColor(if (active) Color.parseColor("#00FF66") else Color.RED)
    }

    fun setBluetoothLed(active: Boolean) {
        ledBluetooth.second.setBackgroundColor(
                if (active) Color.parseColor("#00FF66") else Color.RED
        )
    }

    fun log(message: String) {
        if (logToggle.isChecked) {
            terminalUI.append("\n> $message")
            scrollContainer.post { scrollContainer.fullScroll(View.FOCUS_DOWN) }
        }
    }

    fun clearLogs() {
        terminalUI.text = "Sistema limpo.\n"
    }

    fun setRoutingActiveState() {
        pinInput.isEnabled = false
        connectBtn.isEnabled = false
        connectBtn.text = "ROTEAMENTO ATIVO"
        connectBtn.setBackgroundColor(Color.parseColor("#004411"))
        connectBtn.setTextColor(Color.parseColor("#00FF66"))
    }
}
