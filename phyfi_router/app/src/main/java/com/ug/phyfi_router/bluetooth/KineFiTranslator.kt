package com.ug.phyfi_router.bluetooth

import com.ug.phyfi_router.protocol.PhyFiPayload
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Traduz a intenção lógica (16-bits) em comandos mecânicos (Bluetooth HID), injetando ruído
 * anatômico (Jitter) para evasão de heurísticas anti-trapaça.
 */
class KineFiTranslator(private val hidManager: BluetoothHidManager) {
    private val scope = CoroutineScope(Dispatchers.IO)

    fun processIncomingPayload(payload: PhyFiPayload) {
        val report = buildHidReport(payload.intent)

        scope.launch {
            // Jitter KeyDown: flutuação de 5ms a 22ms exigida na documentação
            val downJitter = Random.nextLong(5, 23)
            delay(downJitter)
            hidManager.sendKeyboardReport(report)

            // Duração do contato mecânico simulado
            val pressDuration = Random.nextLong(30, 80)
            delay(pressDuration)

            // Jitter KeyUp: imperfeição na liberação da tecla
            val upJitter = Random.nextLong(5, 23)
            delay(upJitter)
            hidManager.sendKeyboardReport(emptyReport())
        }
    }

    private fun buildHidReport(intent: Byte): ByteArray {
        val report = ByteArray(8)
        // Padrão de relatório HID Keyboard:
        // [0: Modificador, 1: Reservado, 2: Tecla1, 3: Tecla2, 4: Tecla3, 5: Tecla4, 6: Tecla5, 7:
        // Tecla6]

        // Estruturação do Chord Obscuro: Left Ctrl (0x01) + F15 (0x6A) + Tecla Dinâmica
        report[0] = 0x01
        report[2] = 0x6A
        report[3] = intent

        return report
    }

    private fun emptyReport(): ByteArray {
        return ByteArray(8)
    }
}
