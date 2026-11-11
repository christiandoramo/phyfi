package com.ug.phyfi_router.protocol

/**
 * Utilitário estrito para serialização e deserialização do protocolo binário.
 * Estrutura: [4-bits Actor ID] + [4-bits Timestamp] + [8-bits Intent] = 16 bits.
 */
object Protocol16Bit {
    
    fun pack(actorId: Byte, timestamp: Byte, intent: Byte): Short {
        val a = (actorId.toInt() and 0x0F) shl 12
        val t = (timestamp.toInt() and 0x0F) shl 8
        val i = intent.toInt() and 0xFF
        return (a or t or i).toShort()
    }

    fun unpack(payload: Short): PhyFiPayload {
        val data = payload.toInt()
        val actorId = ((data shr 12) and 0x0F).toByte()
        val timestamp = ((data shr 8) and 0x0F).toByte()
        val intent = (data and 0xFF).toByte()
        
        return PhyFiPayload(actorId, timestamp, intent)
    }
}