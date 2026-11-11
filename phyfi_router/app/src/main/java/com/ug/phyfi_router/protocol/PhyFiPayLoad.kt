package com.ug.phyfi_router.protocol

/**
 * Representação estruturada do pacote de 16-bits após a extração física.
 */
data class PhyFiPayload(
    val actorId: Byte,
    val timestamp: Byte,
    val intent: Byte
)