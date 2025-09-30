# app-lab-back

Backend minimal para autenticación (Express) conectado a TiDB Cloud.

Setup rápido

1. Instala dependencias:

   npm install

2. Variables de entorno (opcional):

   set JWT_SECRET=tu_secreto_aqui

3. Ejecuta en desarrollo:

   npm run dev

Notas

- La conexión a la base de datos está en `db.js` y actualmente usa credenciales embebidas para desarrollo local. Reemplaza por variables de entorno en producción.
- Asegúrate de que `certs/ca.pem` existe (ya incluido) para la conexión SSL a TiDB Cloud.
- Endpoints:
  - POST /api/auth/register  { email, password } -> { token }
  - POST /api/auth/login     { email, password } -> { token }
  - GET  /api/auth/me        (Bearer token) -> { id, email }
# app-lab-back

Small Node.js back-end for local development.

Quick start (Windows PowerShell):

1. Ensure Node.js is installed: `node -v` (recommended Node 24.x as in `.nvmrc`).
2. Install dependencies: `npm install` (no deps by default).
3. Start server: `npm start`.

If you don't have Node installed, install nvm for Windows: https://github.com/coreybutler/nvm-windows and then run:

```powershell
nvm install 24.9.0
nvm use 24.9.0
node -v
```
