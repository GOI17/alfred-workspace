# Interfaz móvil servida por el host

## Usar Alfred desde el navegador, sin instalar una app

La entrada nueva es **Settings → Mobile → Open in browser** (también en la página Mobile).
Ese botón descubre el puerto del desktop y abre el navegador local, sin introducir una dirección.
Para el teléfono, el desktop genera un QR con un enlace a `mobile-browser.html`. Abrir ese enlace
empareja automáticamente y descarga las pantallas desde el desktop por RPC/relay
autenticado y cifrado. No necesita contenedor nativo, Metro, Expo, EAS ni una instalación de store.
El desktop debe permanecer encendido, conectado y con relay disponible.

### Preparar el acceso al teléfono

1. Compile el desktop de esta rama con `pnpm run build:desktop`. Incluye las pantallas reales en
   `out/mobile-web` y la entrada de navegador en `out/web/mobile-browser.html`.
2. El director relay necesita el cambio de esta rama que permite CORS en **POST /v1/resolve**.
   Esa ruta conserva su autorización con credencial en el cuerpo, sin cookies; permite resolver
   un endpoint nuevo al reconectar. Un director antiguo puede permitir la primera conexión y
   fallar al recuperar una asignación movida. Los clientes nativos no necesitan CORS.
3. Publique **sólo el contenido de `out/mobile-browser/`** en un sitio HTTPS de confianza,
   conservando `mobile-browser.html` y su carpeta `assets/`. Es una página estática con el cliente
   de emparejamiento, no una copia pública de las pantallas ni de los archivos del host. Configure
   el HTML con `Cache-Control: no-cache`, los assets con hash como inmutables y tipos MIME HTML,
   JavaScript y CSS correctos. Evite redirecciones que descarten el fragmento del enlace.
4. Abra el desktop compilado, despliegue **Access from your phone**, indique la dirección HTTPS
   completa de esa página y pulse **Create phone link**. Escanee el QR con la cámara del teléfono
   o abra el enlace copiado; la UI carga automáticamente sin confirmar ni pegar códigos.
5. Abra un workspace y una terminal; use **Live input** para ejecutar, por ejemplo,
   `node -p "6*7"` cuando Node esté instalado en el host. Debe aparecer `42`.
6. Edite la UI, ejecute `pnpm run build:mobile-web`, espere el fin del build y pulse **Reload UI**
   en el navegador. Confirme el descarte de borradores. No necesita reconstruir ni publicar la
   página de entrada por cada cambio de pantallas.

**Estado de entrega:** artefactos y cambios listos localmente; no se ha publicado la página ni
desplegado el cambio del director. Hace falta elegir/autorizar su destino HTTPS y despliegue
antes de escanear desde un teléfono fuera del entorno local. No se abrió ningún puerto público.
La página pública es el arranque del navegador; después descarga y acciones comparten la misma
conexión RPC/relay. No se añade otro transporte de actualizaciones.

Para comprobar localmente la entrada sin publicarla, el mismo listener HTTP/RPC del desktop sirve
`http://localhost:<puerto-RPC>/mobile-browser.html` (en desarrollo suele ser **6769**, mientras el
desktop instalado suele usar 6768). Pulse **Open in browser**: detecta el puerto real, genera el
enlace y lo abre en el navegador de esa computadora. **Copy link** queda como opción adicional.
Esta opción genera emparejamiento directo, sin pedir una
invitación a Relay. Un build de desarrollo sin `ORCA_CLOUD_API_URL`/`ORCA_CLOUD_CLIENT_ID` no configura
Relay; una entrada HTTPS remota sigue requiriendo su configuración y autenticación, sin degradarse
automáticamente a LAN. `localhost` en el teléfono apunta al propio teléfono, no al desktop. Una IP LAN con
HTTP no sustituye a HTTPS: el navegador necesita un contexto seguro para emparejar.

Un enlace con invitación conecta y abre la UI automáticamente, sin pegar ni confirmar el código.
También funciona al pegar el enlace en una pestaña que ya tenía abierta la
entrada. Si esa pestaña cargó una versión anterior de la entrada, recárguela una vez antes de pegar
el enlace; reconstruir el desktop no reemplaza el JavaScript que ya ejecuta el navegador.

### Sesión, aislamiento y límites del navegador

- La invitación viaja en el fragmento `#pairing=...`, que se elimina al abrir la página y no se
  envía al servidor HTTP. Abra sólo invitaciones de su desktop y aloje la entrada en un origen
  que controle: ese cliente sí maneja las credenciales.
- Se recuerda **un desktop por pestaña** en `sessionStorage`; recargar esa pestaña restaura el
  acceso. Cerrar la sesión del navegador puede requerir volver a emparejar. **Disconnect** cierra
  la conexión; **Forget this browser** borra la credencial de esa pestaña. Para revocar el permiso
  en el host, elimine el dispositivo desde desktop.
- La UI se ejecuta en un iframe con origen opaco, sin acceso al almacenamiento o DOM de la
  entrada, sin sockets propios ni navegación superior. Recibe un puente RPC con los mismos
  límites móviles. Sólo llegan id/nombre del host, nunca su token. Sus preferencias locales
  duran esa generación; no equivalen a la persistencia nativa.
- Los bytes se verifican con el manifiesto/SHA-256 antes de montar una generación completa.
  La caché de la UI en navegador es en memoria: al recargar la página vuelve a descargarse.
  Una desconexión conserva la UI mostrada; **Reload UI** vuelve a consultar al desktop.
- Browser entry requiere módulos/import maps y contexto seguro; versiones incompatibles muestran
  recuperación. Audio, adjuntos, notificaciones push, portapapeles y gestos avanzados no tienen
  paridad nativa validada. No hay garantía de conexión activa con el navegador suspendido.
- Se validó con Chromium/Electron oculto mediante Playwright CDP; Safari/iOS, Chrome/Android
  físicos y el relay público desplegado siguen pendientes. No se afirma validación en iPhone.

### Agregar proyectos desde la web

Pulse **+ (New workspace) → Add project**. Explore las carpetas del host o escriba una ruta y
pulse **Browse**; elija **Git repository** o **Folder project** y pulse **Add this folder**.
Se registra la carpeta existente en ese desktop y queda seleccionada para crear un workspace.
No se suben archivos del teléfono ni se abre un selector de archivos en la computadora.
También funciona cuando aún no hay proyectos registrados.

La exploración usa `files.browseServerDir` y el alta usa `repo.add` por el puente/RPC autenticado,
incluido relay. No se habilitan clonado ni eliminación de proyectos. Un desktop anterior que
no permita `repo.add` a clientes móviles muestra la indicación de actualizar y reconectar.
Esta primera actualización requiere reconstruir y reiniciar desktop por el cambio de permisos;
las siguientes ediciones de pantallas siguen llegando por **Reload UI**.

La carpeta pertenece al host emparejado. Agregar nuevos proyectos en un destino SSH requiere
desktop; los proyectos SSH ya registrados conservan el selector de ejecución existente.
Los drawers compartidos incluyen dependencias explícitas para sus animaciones web y omiten
las APIs nativas de teclado y BackHandler que React Native Web no implementa.

La prueba `ORCA_BACKGROUND_LAUNCH=1 pnpm test config/scripts/mobile-browser-journey.test.mjs`
recorre emparejamiento automático en pestaña nueva y existente, descarga, folder workspace,
terminal y una acción Node real; corta el
relay, recupera la conexión, cambia el bundle sin reiniciar el host y restaura la pestaña.
La admisión del relay y la ejecución de workspace son fixtures locales; RPC/NaCl E2EE son reales.
TLS se sustituye por WS de loopback únicamente en esa prueba. Evidencia:
`out/mobile-browser-validation/{workspace.png,terminal.png,result.json}`. El test de packaging
comprueba entrada y assets dentro de un `app.asar` real. Los checks nativos siguen cubriendo
compatibilidad, caché, integridad y selección de host.

## Alternativa: contenedor móvil instalado

La app móvil abre su interfaz de trabajo desde el desktop emparejado. La pantalla inicial nativa
permite emparejar, elegir y administrar hosts. Al seleccionar un host o terminar de emparejarlo,
se descarga y abre su UI automáticamente. Ya no requiere activar un preview en Troubleshoot ni
configurar `EXPO_PUBLIC_ORCA_HOST_UI_PREVIEW`.

El desktop entrega las pantallas de `mobile/app/h/` como HTML, JS y CSS mediante
`mobileWeb.bundle.manifest/chunk`. Descarga y acciones usan el mismo cliente RPC autenticado,
incluido relay cifrado. Agentes, terminales y archivos permanecen en el host de ejecución.

## Actualización inicial del contenedor

Para recibir esta navegación por defecto hay que actualizar **una vez la app móvil** con el código
de esta rama y el módulo `orca-mobile-web-shell`. Una app antigua o la preview anterior no cambia
su navegación nativa al pulsar Reload UI. Las nuevas builds de desarrollo y Release usan la shell
por defecto; los flags antiguos guardados ya no intervienen. Expo Go no incluye el módulo nativo.

Para una prueba remota autónoma, use Release con su JavaScript nativo incluido. No requiere EAS ni
Metro en ejecución. Xcode/firma en iOS y SDK/JDK/firma en Android se necesitan para construir e
instalar ese contenedor inicial, no para iterar sobre las pantallas posteriores.

En el simulador iOS de este Mac, el comando manual de actualización es:

```bash
cd mobile
pnpm exec expo run:ios --device "iPhone 17 Pro" --configuration Release --no-bundler
```

La build Release de esta entrega compiló para simulador y se instaló en el iPhone 17 Pro local,
sin iniciar la app. Cierre y vuelva a abrir Orca manualmente, y seleccione su desktop emparejado.
El artefacto local está en `out/mobile-native-simulator/Build/Products/Release-iphonesimulator/Orca.app`.
Esta compilación no valida la navegación en un dispositivo físico.

Android puede construirse sin iniciar la app desde `mobile/`:

```bash
pnpm install --frozen-lockfile
pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

En Windows use `./gradlew.bat assembleRelease`. El APK queda en
`mobile/android/app/build/outputs/apk/release/`; requiere instalación con la firma apropiada.
No se publicaron builds. Los procesos de pruebas lanzados por agentes siempre deben llevar
`ORCA_BACKGROUND_LAUNCH=1`, correr en segundo plano y mantener ventanas ocultas.

## Preparar y probar el desktop

Desde este worktree:

```bash
pnpm install --frozen-lockfile
pnpm --dir mobile install --frozen-lockfile
pnpm run build:desktop
pnpm start
```

Use el desktop compilado desde esta rama. `pnpm start` ejecuta el build local; no actualiza otra
instalación de Orca. Para una prueba manual visible, no conserve `ORCA_BACKGROUND_LAUNCH=1`, porque
esa variable oculta la ventana. Puede aislar el perfil con `ORCA_DEV_USER_DATA_PATH`.

1. Genere el código de emparejamiento en Settings → Mobile de ese desktop.
2. Empareje en móvil; en el simulador use **Paste code instead**. Después de las decisiones nativas
   pendientes de notificaciones se abre la interfaz del host. Para hosts ya emparejados, selecciónelos
   desde la pantalla inicial.
3. Espere la descarga; abra un workspace y una terminal. Con **Live input**, envíe una orden inocua,
   por ejemplo `node -p "6*7"` si el host tiene Node, y compruebe `42`.
4. **Hosts** vuelve al selector nativo. Está disponible también ante errores. La administración de
   endpoints, emparejamiento, permisos y diagnóstico de conexión sigue en nativo.
5. Los enlaces nativos a sesiones, archivos y tareas conservan su destino dentro de la shell. El
   navegador nativo sigue montado para las notificaciones, pero sus pantallas de trabajo se renderizan
   desde el bundle. El editor de host permanece nativo.

La primera descarga ronda 7.9 MB. Para demostrar relay público, use una red que no alcance directamente
al desktop y confirme la ruta en los diagnósticos **nativos**; la etiqueta de la página no basta.
La UI siempre pertenece a la instalación desktop emparejada, incluso al trabajar sobre SSH: los
métodos del bundle no se reenvían al host SSH. Folder workspaces y git worktrees usan las rutas existentes.

## Editar y recargar

1. Edite una pantalla de `mobile/app/h/` o un componente de `mobile/src/`.
2. Desde la raíz ejecute `pnpm run build:mobile-web` y espere que termine correctamente.
3. Pulse **Reload UI → Reload** en móvil. Los borradores de esa vista se descartan; el trabajo del
   host continúa. Una apertura normal vuelve a la lista; una entrada por enlace vuelve a ese destino.

No necesita recompilar móvil ni reiniciar el host de desarrollo para estos cambios de UI.
`build:desktop` y el empaquetado incluyen las pantallas reales de `out/mobile-web`.
`build:mobile-web:app` es un alias; el diagnóstico separado va a `out/mobile-web-diagnostic`.
Un desktop empaquetado lee su propio `app.asar`: editar este worktree no cambia esa instalación,
y actualizar el artefacto instalado requiere el reinicio habitual.

El host relee el manifiesto después de reconstruir e invalida verificaciones de archivos modificados.
Una descarga durante el reemplazo del árbol puede fallar: espere el build y reintente. Se rechazan
chunks de generaciones retiradas y se verifica SHA-256 antes de publicar la caché completa por host.
Nunca se activa una mezcla de generaciones. Una reconexión conserva la UI ya mostrada; sólo una
recarga explícita consulta y activa el cambio. No hay HMR, video ni una segunda conexión pública.

## Compatibilidad y límites

- Se conservan autenticación, E2EE, allowlists, integridad y aislamiento nativo. La página no abre
  sockets ni navega fuera de su documento privado; Expo mantiene la navegación en memoria.
- El init del puente añade datos opcionales del host, alias de cliente y destino inicial. La ruta
  queda limitada al host seleccionado. El token de emparejamiento no entra en ese init; el puente
  nativo vincula la identidad de los RPC al cliente existente.
- Un host antiguo sin bundle muestra la indicación de actualizar desktop. Una incompatibilidad de
  protocolo mantiene su pantalla de recuperación. No se abre silenciosamente la antigua UI nativa.
  Las credenciales temporalmente inaccesibles permiten reintentar sin borrar el emparejamiento.
- Terminal básica validada. Audio, adjuntos, navegador embebido y gestos avanzados de terminal siguen
  sin soporte web. Se ocultan audio/adjuntos; no se declara paridad de chat, portapapeles, selección
  táctil, accesibilidad ni recuperación tras suspensión física.

## Evidencia reproducible

Ejecute las pruebas en segundo plano, con logs y `ORCA_BACKGROUND_LAUNCH=1`:

```bash
ORCA_BACKGROUND_LAUNCH=1 pnpm --dir mobile typecheck
ORCA_BACKGROUND_LAUNCH=1 pnpm --dir mobile check:tests-typecheck
ORCA_BACKGROUND_LAUNCH=1 pnpm tc
ORCA_BACKGROUND_LAUNCH=1 pnpm run build:mobile-web
ORCA_BACKGROUND_LAUNCH=1 pnpm --dir mobile test src/mobile-web-shell src/home src/onboarding src/transport/client-context.web.test.tsx src/storage/preferences.test.ts
ORCA_BACKGROUND_LAUNCH=1 pnpm test config/scripts/mobile-web-host-journey.test.mjs
ORCA_BACKGROUND_LAUNCH=1 pnpm run check:code-quality:changed
```

El recorrido automatizado usa `CloudRelayTransport`, NaCl E2EE v2 y el descargador móvil reales,
con relay en loopback y admisión de nube simulada. El backend de workspace/terminal es una fixture:
ejecuta un proceso Node y escribe un archivo, pero no es el runtime PTY completo de Orca. El renderer
Electron permanece oculto y se controla mediante Playwright CDP, con el CSP nativo y sólo los bytes
descargados. El HTTP local representa al handler de assets nativo, no al transporte de producción.

Verifica lista, workspace, terminal, identidad del cliente, acción y salida, cambio de generación,
entrada directa a una sesión y ausencia de sockets de página, errores JS y ventanas visibles.
La evidencia está en `out/mobile-web-validation/{workspaces.png,terminal.png,page.json,result.json}`.
`orca-ui-proof` sólo existe en esa fixture. Otros tests cubren contenedor por defecto, retorno a Hosts,
credenciales, rutas, notificaciones, empaquetado real en asar, caché y compatibilidad.

La actualización por Reload UI fue confirmada por el usuario en su entorno. No se ha confirmado que
esa conexión fuera relay público. Siguen pendientes dispositivo físico iOS/Android, SSH real y
artefactos Windows/Linux. Actions está deshabilitado en el repositorio de destino; los checks de esta
entrega se ejecutaron localmente. Ninguna build se publicó ni se fusionaron cambios.
