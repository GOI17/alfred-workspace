# Acceso remoto con Cloudflare Tunnel

Alfred puede iniciar y detener un túnel nombrado mediante el ejecutable local `cloudflared`. No inicia el túnel al arrancar ni abre puertos del router. El servidor local ya debe estar ejecutándose.

## Configuración inicial

1. Instala `cloudflared` desde la distribución oficial de Cloudflare. Debe estar disponible en el PATH del proceso que inicia Alfred.
2. Configura un túnel **administrado localmente** con tu cuenta de Cloudflare. No lo instales como servicio si quieres que Alfred controle su ciclo de vida.
3. Asocia el hostname elegido al túnel mediante Cloudflare. Para esta instalación: `alfredworkspace.alfredlabs.org`.
4. Guarda la configuración de cloudflared fuera del repositorio. Por ejemplo:

```yaml
tunnel: UUID-DEL-TUNEL
credentials-file: /ruta/privada/UUID-DEL-TUNEL.json
ingress:
  - hostname: alfredworkspace.alfredlabs.org
    service: http://127.0.0.1:4310
  - service: http_status:404
```

El UUID y el archivo de credenciales se obtienen al crear el túnel. No compartas las credenciales ni las incluyas en mensajes, archivos del proyecto o control de versiones. Restringe su lectura al usuario que ejecuta Alfred.

Esta integración usa `cloudflared tunnel --config ... run ...`; **no utiliza tokens de túneles administrados remotamente**. Si ya tienes un túnel administrado remotamente, no pegues su token en el campo del nombre ni en el repositorio.

5. Configura estas variables en el entorno del proceso de Alfred:

```sh
export ALFRED_PUBLIC_ORIGIN=https://alfredworkspace.alfredlabs.org
export ALFRED_CLOUDFLARE_TUNNEL=UUID-DEL-TUNEL
export ALFRED_CLOUDFLARE_CONFIG=/ruta/privada/config.yml
pnpm dev
```

También puedes usar el nombre del túnel en `ALFRED_CLOUDFLARE_TUNNEL`. En una instalación compilada inicia con `pnpm start`, después de compilar.

Las tres variables son obligatorias conjuntamente. El origen debe ser HTTPS, sin ruta ni barra final. El puerto del servicio en el YAML debe coincidir con el de Alfred. Mantén la escucha en `127.0.0.1`; no necesitas `--share`. El HTTPS público termina en Cloudflare y el tramo local del ejemplo usa HTTP por loopback. Si Alfred usa TLS local, ajusta el servicio y la confianza del certificado en cloudflared; no desactives la verificación de certificados.

## Protección

Antes de publicar, configura una aplicación de Cloudflare Access para el hostname y limita quién puede entrar. Alfred mantiene además su autenticación por código. No incluyas ese código en la URL ni en un QR.

El servidor reconoce únicamente el origen público configurado para esta conexión y usa cookies Secure al iniciar sesión por ese hostname. No confía indiscriminadamente en cabeceras forwarded.

Publicar Alfred permite acceder a las capacidades habilitadas de tu workspace a quienes puedan autenticarse. El tráfico pasa por Cloudflare. La computadora debe permanecer encendida y conectada a Internet.

## Uso

1. Abre **Conectar teléfono**.
2. Revisa y acepta la autorización de publicación.
3. Pulsa **Conectar teléfono** y espera el estado **Disponible**.
4. Abre el enlace desde el teléfono, supera Cloudflare Access si está configurado e inicia sesión con el código de Alfred.
5. Pulsa **Desconectar** para cerrar el proceso de túnel iniciado por Alfred.

Cerrar el diálogo no cierra el túnel. Cerrar normalmente el servidor sí solicita su terminación. No se detienen conectores externos, servicios u otros procesos de cloudflared: si los hay, el hostname podría seguir accesible.

**Disponible** significa que cloudflared informó de una conexión al servicio de túneles; no prueba que DNS, Access y el enrutamiento al servidor estén correctamente configurados. Comprueba el acceso desde datos móviles antes de dar por concluida la instalación.

## Diagnóstico

- **Sin configurar:** faltan las variables; configura el entorno y reinicia Alfred.
- **No se pudo ejecutar cloudflared:** comprueba instalación y PATH.
- **Error o espera agotada:** desconecta antes de intentarlo nuevamente; revisa localmente configuración, credenciales, DNS y conectividad.
- **El enlace abre pero no carga Alfred:** verifica el hostname de ingress y el puerto del servicio local.
- **No autentica:** verifica el origen HTTPS exacto, el Host enviado al servidor y el código de Alfred.

La interfaz no muestra los logs crudos de cloudflared porque podrían contener información sensible. Actualmente muestra el enlace; no genera un QR.
