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

## DB setup for Insumos and Catálogo

Run the SQL script to create the new tables for insumos and catalogo_insumos (manual numeric Item and optional image):

- File: `src/db/db_insumos.sql`

How to apply (example via MySQL CLI):

```powershell
# Replace with your connection values
mysql -h $env:HOST -u $env:DB_USER -p$env:DB_PASSWORD < .\src\db\db_insumos.sql
```

Notes
- The column `catalogo_insumos.imagen` is defined as MEDIUMBLOB to allow images up to ~16MB. The API caps uploads at 5MB; if your existing column is BLOB, run this ALTER to avoid ER_DATA_TOO_LONG:

```sql
ALTER TABLE catalogo_insumos MODIFY imagen MEDIUMBLOB NULL;
```

- Ensure the backend is using the intended database (`DB_NAME`) in your environment. The scripts default to `lab`.


Cuentas

auxiliar@gmail.com  123456
admin@gmail.com 123456
superadmin@gmail.com 123456