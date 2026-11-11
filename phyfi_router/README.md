Esse APP estava sendo desenvolvido para ter máxima performance usando o celular como roteador WebRTC-Ondas Sonoras-Teclado Bluetooth (Chamado de protocolo de rede "Phy-Fi").

---

###### rascunho durante desenvolvimento

gradle wrapper --gradle-version 9.5.0

./gradlew clean assembleDebug --no-build-cache

adb devices

adb install -r app/build/outputs/apk/debug/app-debug.apk

adb shell am start -n "com.ug.phyfi_router/com.ug.phyfi_router.MainActivity"

adb logcat -c

adb logcat -s "PhyFi"






adb uninstall com.ug.phyfi_router
./gradlew clean assembleDebug --no-build-cache
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n "com.ug.phyfi_router/com.ug.phyfi_router.ui.MainActivity"


para pegar erros de crash (suar no vs code quando for abrir o app com erro (antes de abrir))
adb logcat AndroidRuntime:E *:S



mkdir -p app/libs
wget https://github.com/JorenSix/TarsosDSP/releases/download/v2.4/TarsosDSP-2.4-bin.jar -O app/libs/TarsosDSP-2.4.jar