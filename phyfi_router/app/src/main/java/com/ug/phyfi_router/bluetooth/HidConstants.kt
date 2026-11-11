package com.ug.phyfi_router.bluetooth

import android.bluetooth.BluetoothHidDeviceAppSdpSettings

object HidConstants {
    const val REPORT_ID_KEYBOARD = 1
    const val SUBCLASS_KEYBOARD = 0x40.toByte()

    val KEYBOARD_DESCRIPTOR =
            intArrayOf(
                            0x05,
                            0x01, // Usage Page (Generic Desktop)
                            0x09,
                            0x06, // Usage (Keyboard)
                            0xA1,
                            0x01, // Collection (Application)
                            0x85,
                            REPORT_ID_KEYBOARD, // Report ID
                            0x05,
                            0x07, // Usage Page (Key Codes)
                            0x19,
                            0xE0, // Usage Minimum (224)
                            0x29,
                            0xE7, // Usage Maximum (231)
                            0x15,
                            0x00, // Logical Minimum (0)
                            0x25,
                            0x01, // Logical Maximum (1)
                            0x75,
                            0x01, // Report Size (1)
                            0x95,
                            0x08, // Report Count (8)
                            0x81,
                            0x02, // Input (Data, Variable, Absolute) - Modifiers
                            0x95,
                            0x01, // Report Count (1)
                            0x75,
                            0x08, // Report Size (8)
                            0x81,
                            0x01, // Input (Constant) - Reserved padding
                            0x95,
                            0x05, // Report Count (5)
                            0x75,
                            0x01, // Report Size (1)
                            0x05,
                            0x08, // Usage Page (Page# for LEDs)
                            0x19,
                            0x01, // Usage Minimum (1)
                            0x29,
                            0x05, // Usage Maximum (5)
                            0x91,
                            0x02, // Output (Data, Variable, Absolute) - LEDs
                            0x95,
                            0x01, // Report Count (1)
                            0x75,
                            0x03, // Report Size (3)
                            0x91,
                            0x01, // Output (Constant) - LED padding
                            0x95,
                            0x06, // Report Count (6)
                            0x75,
                            0x08, // Report Size (8)
                            0x15,
                            0x00, // Logical Minimum (0)
                            0x25,
                            0x65, // Logical Maximum (101)
                            0x05,
                            0x07, // Usage Page (Key codes)
                            0x19,
                            0x00, // Usage Minimum (0)
                            0x29,
                            0x65, // Usage Maximum (101)
                            0x81,
                            0x00, // Input (Data, Array) - Key array
                            0xC0 // End Collection
                    )
                    .map { it.toByte() }
                    .toByteArray()

    val SDP_SETTINGS =
            BluetoothHidDeviceAppSdpSettings(
                    "PhyFi Kine-Fi Module",
                    "Unwalled Gardens",
                    "Hardware Interface Emulator",
                    SUBCLASS_KEYBOARD,
                    KEYBOARD_DESCRIPTOR
            )
}
