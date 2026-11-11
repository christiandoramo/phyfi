package com.ug.phyfi_router.network

import org.webrtc.SdpObserver
import org.webrtc.SessionDescription

/**
 * Adapter limpo para SdpObserver, evitando boilerplate na classe principal.
 */
open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(p0: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(p0: String?) {}
    override fun onSetFailure(p0: String?) {}
}