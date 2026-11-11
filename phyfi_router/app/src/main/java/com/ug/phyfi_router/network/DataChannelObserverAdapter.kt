package com.ug.phyfi_router.network

import org.webrtc.DataChannel

/**
 * Encapsula o recebimento bruto de bytes do canal P2P.
 */
class DataChannelObserverAdapter(
    private val onDataReceived: (ByteArray) -> Unit
) : DataChannel.Observer {
    override fun onBufferedAmountChange(p0: Long) {}
    override fun onStateChange() {}
    
    override fun onMessage(buffer: DataChannel.Buffer?) {
        if (buffer == null || !buffer.data.hasRemaining()) return
        val data = ByteArray(buffer.data.remaining())
        buffer.data.get(data)
        onDataReceived(data)
    }
}