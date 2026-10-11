# OfficeAI: instalación, puesta a punto y operación

## 1. Qué contiene el repositorio

OfficeAI es un monorepo basado en Node.js/TypeScript que incluye:

- `apps/workspace`: servidor, navegador y almacenamiento local de Workspace.
- `apps/agent`: agente local para conversaciones y revisión de documentos.
- `apps/cli`: CLI para automatizar Workspace.
- `packages/`: componentes, viewers e integraciones reutilizables.
- `apps/sales-pos`: POS local conectado con la base SQLite de Workspace.

## 2. Requisitos

- Node.js 24 o superior.
- pnpm 11.
- Licencia Univer para las capacidades que la requieran.
- En Windows, PowerShell o una terminal compatible.

Verificar:

```powershell
node --version
pnpm --version
```

## 3. Instalación inicial

Desde la raíz:

```powershell
cd C:\proyectos\officeai
pnpm install
Copy-Item apps/workspace/.env.example apps/workspace/.env
```

Editar `apps/workspace/.env` con los valores locales. No subir ese archivo a GitHub. Para OAuth, las URLs deben coincidir exactamente con las registradas en GitHub o Discord.

El almacenamiento local de Workspace queda en `apps/workspace/.data/`. Esa carpeta contiene datos operativos y debe mantenerse fuera del control de versiones y de cualquier publicación.

## 4. Arranque en desarrollo

Terminal 1, servidor:

```powershell
cd C:\proyectos\officeai
pnpm workspace:dev:server
```

Servidor Workspace:

- API y servidor: `http://127.0.0.1:3020`
- OpenAPI: `http://127.0.0.1:3020/openapi.yaml`
- Documentación API: `http://127.0.0.1:3020/api-docs`

Terminal 2, navegador:

```powershell
cd C:\proyectos\officeai
pnpm workspace:dev:web
```

Abrir:

`http://127.0.0.1:5173`

El navegador de desarrollo usa Vite y proxifica API/WebSocket hacia el servidor en el puerto 3020.

## 5. Arranque del POS

El POS usa el mismo SQLite local de Workspace. Con el servidor Workspace preparado, iniciar:

```powershell
cd C:\proyectos\officeai\apps\sales-pos
node src/server.js
```

POS:

`http://127.0.0.1:4050`

La skill `officeai` permite consultar el catálogo, ventas, clientes y documentos, crear cotizaciones/facturas y enviar documentos por SMTP cuando se solicite expresamente.

## 6. Verificación antes de usarlo

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Si solo se necesita probar el flujo local, verificar manualmente que:

1. Workspace abre en el puerto 5173.
2. El API responde en el puerto 3020.
3. POS responde en el puerto 4050.
4. La base `.data/univer-workspace.sqlite` existe.
5. Una cotización de prueba genera su PDF correctamente.
6. El correo SMTP se prueba con una cuenta de pruebas antes de usar destinatarios reales.

## 7. Puesta en producción

Antes de desplegar:

- Ejecutar `pnpm install`, `pnpm typecheck`, `pnpm test` y `pnpm build` en un entorno limpio.
- Usar `pnpm workspace:start` para iniciar el servidor compilado.
- Configurar un reverse proxy HTTPS delante del servidor.
- Mantener los puertos internos 3020 y 4050 sin exposición pública directa.
- Definir secretos mediante variables de entorno o un gestor de secretos.
- Usar OAuth Apps separadas para local y producción.
- Cambiar `GITHUB_CALLBACK_URL` y `DISCORD_CALLBACK_URL` a URLs HTTPS reales.
- Configurar cookies seguras y revisar la configuración de producción.
- Respaldar `.data/univer-workspace.sqlite`, `.data/univer-collaboration.sqlite` y blobs según una política probada de recuperación.
- Ejecutar migraciones compatibles; no usar `db:reset` sobre datos reales.
- Configurar logs, monitoreo, límites de tamaño y límites de solicitudes.
- Proteger SMTP y no dejar el endpoint del POS accesible sin autenticación si se expone fuera del equipo local.

El POS actual es principalmente local: sus APIs no deben publicarse directamente en Internet sin una capa de autenticación y endurecimiento adicional. También conviene separar su base de datos de la base interna de Workspace antes de convertirlo en servicio multiusuario.

## 8. Higiene antes de subir a GitHub

No incluir:

- `apps/workspace/.env` ni otros `.env`.
- `apps/workspace/.data/`.
- Bases SQLite, PDFs de clientes, facturas, cotizaciones o datos reales.
- Credenciales SMTP, OAuth, Discord o tokens.
- `node_modules/`, `dist/`, logs y archivos temporales.

Antes de publicar:

```powershell
git status --short
git diff --check
git ls-files | Select-String -Pattern '(^|/)(\.env|\.data|node_modules|dist)(/|$)|\.sqlite$|\.pdf$'
```

Revisar manualmente cada archivo nuevo y cada cambio del lockfile. El directorio `apps/sales-pos` apareció como no rastreado durante la revisión y contiene datos locales; no debe añadirse completo sin filtrar esos archivos.

