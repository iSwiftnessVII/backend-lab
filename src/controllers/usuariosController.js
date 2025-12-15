const pool = require('../config/db');
const bcrypt = require('bcrypt');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

const SALT_ROUNDS = 10;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const codes = new Map(); // email -> { code, expiresAt }

function generateCode() {
  const digits = Math.random() < 0.5 ? 4 : 5;
  const max = digits === 4 ? 10000 : 100000;
  return String(Math.floor(Math.random() * max)).padStart(digits, '0');
}

async function sendMail(to, subject, text, html) {
  if (!nodemailer) {
    console.log(`[email] nodemailer no disponible; simulando envío: to=${to} subject="${subject}" text="${text}"`);
    return { simulated: true };
  }
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `no-reply@backend-lab`;
  if (!host || !user || !pass) {
    console.warn('[email] SMTP env incompletos; simulando envío');
    console.log(`[email] to=${to} text=${text}`);
    return { simulated: true };
  }
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const info = await transport.sendMail({ from, to, subject, text, html });
  return { messageId: info.messageId };
}

const usuariosController = {
  /* POST /api/usuarios/verificacion/enviar-codigo - Enviar código al email */
  enviarCodigoVerificacion: async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      const code = generateCode();
      const expiresAt = Date.now() + CODE_TTL_MS;
      codes.set(email, { code, expiresAt });
      const text = `Tu código de verificación es: ${code}\nExpira en 10 minutos.`;
      const html = `<p>Tu código de verificación es: <strong>${code}</strong></p><p>Expira en 10 minutos.</p>`;
      const r = await sendMail(email, 'Código de verificación', text, html);
      return res.json({ ok: true, expiresAt, ...r });
    } catch (err) {
      console.error('Error enviarCodigoVerificacion:', err);
      return res.status(500).json({ error: 'No se pudo enviar el código' });
    }
  },

  /* POST /api/usuarios/verificacion/verificar-codigo - Validar código ingresado */
  verificarCodigoVerificacion: async (req, res) => {
    try {
      const body = req.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const codigo = String(body.codigo || '').trim();
      if (!email || !codigo) {
        return res.status(400).json({ valido: false, error: 'Email y código son requeridos' });
      }
      const entry = codes.get(email);
      if (!entry) {
        return res.status(400).json({ valido: false, error: 'No hay código enviado para este email' });
      }
      if (Date.now() > entry.expiresAt) {
        codes.delete(email);
        return res.status(400).json({ valido: false, error: 'Código expirado' });
      }
      if (entry.code !== codigo) {
        return res.status(400).json({ valido: false, error: 'Código incorrecto' });
      }
      codes.delete(email);
      return res.json({ valido: true });
    } catch (err) {
      console.error('Error verificarCodigoVerificacion:', err);
      return res.status(500).json({ valido: false, error: 'Error interno' });
    }
  },
  /* GET /api/usuarios/roles - Listar todos los roles */
  getRoles: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM roles ORDER BY nombre');
      res.json(rows);
    } catch (err) {
      console.error('Error GET /roles:', err);
      res.status(500).json({ message: 'Error listando roles' });
    }
  },

  /* GET /api/usuarios - Listar todos los usuarios */
  getUsuarios: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          u.id_usuario,
          u.email,
          u.rol_id,
          u.estado,
          u.created_at,
          r.nombre as rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id_rol
        ORDER BY u.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Error GET /usuarios:', err);
      res.status(500).json({ message: 'Error listando usuarios' });
    }
  },

  /* POST /api/usuarios/crear - Crear nuevo usuario */
  crearUsuario: async (req, res) => {
    const { email, contrasena, rol_id } = req.body || {};

    // Validaciones
    if (!email || !contrasena || !rol_id) {
      return res.status(400).json({
        message: 'Email, contraseña y rol son requeridos'
      });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email no válido' });
    }

    try {
      // Verificar si el email ya existe
      const [existing] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          message: 'El email ya está registrado'
        });
      }

      // Verificar que el rol existe
      const [roleCheck] = await pool.query(
        'SELECT id_rol FROM roles WHERE id_rol = ?',
        [rol_id]
      );

      if (!roleCheck.length) {
        return res.status(400).json({ message: 'Rol no válido' });
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(contrasena, SALT_ROUNDS);

      // Insertar usuario
      const [result] = await pool.query(
        'INSERT INTO usuarios (email, contrasena, rol_id, estado) VALUES (?, ?, ?, ?)',
        [email.toLowerCase().trim(), hashedPassword, rol_id, 'ACTIVO']
      );

      res.status(201).json({
        message: 'Usuario creado correctamente',
        id_usuario: result.insertId,
        email: email.toLowerCase().trim(),
        rol_id
      });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'El email ya está registrado' });
      }
      console.error('Error POST /crear:', err);
      res.status(500).json({ message: 'Error creando usuario' });
    }
  },

  /* PATCH /api/usuarios/estado/:id - Cambiar estado (ACTIVO/INACTIVO) */
  cambiarEstado: async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado || !['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({
        message: 'Estado debe ser "ACTIVO" o "INACTIVO"'
      });
    }

    try {
      const [userCheck] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      await pool.query(
        'UPDATE usuarios SET estado = ? WHERE id_usuario = ?',
        [estado, id]
      );

      res.json({
        message: `Usuario ${estado === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente`
      });
    } catch (err) {
      console.error('Error PATCH /estado/:id:', err);
      res.status(500).json({ message: 'Error cambiando estado' });
    }
  },

  /* DELETE /api/usuarios/eliminar/:id - Eliminar usuario */
  eliminarUsuario: async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        'DELETE FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
      console.error('Error DELETE /eliminar/:id:', err);

      // Manejar error de foreign key constraint
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          message: 'No se puede eliminar: el usuario tiene registros asociados'
        });
      }

      res.status(500).json({ message: 'Error eliminando usuario' });
    }
  },

  /* PATCH /api/usuarios/rol/:id - Cambiar rol de usuario */
  cambiarRol: async (req, res) => {
    const { id } = req.params;
    const { rol_id } = req.body || {};

    // VERIFICACIÓN POR ROL - Solo Superadmin puede cambiar roles
    if (req.user.rol !== 'Superadmin') {
      return res.status(403).json({
        message: 'No tienes permisos para cambiar roles. Solo el Superadmin puede realizar esta acción.'
      });
    }

    // Validaciones
    if (!rol_id) {
      return res.status(400).json({
        message: 'El rol_id es requerido'
      });
    }

    try {
      // Verificar que el usuario existe
      const [userCheck] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Verificar que el rol existe
      const [roleCheck] = await pool.query(
        'SELECT id_rol FROM roles WHERE id_rol = ?',
        [rol_id]
      );

      if (!roleCheck.length) {
        return res.status(400).json({ message: 'Rol no válido' });
      }

      // Actualizar el rol del usuario
      await pool.query(
        'UPDATE usuarios SET rol_id = ? WHERE id_usuario = ?',
        [rol_id, id]
      );

      res.json({
        message: 'Rol actualizado correctamente',
        id_usuario: parseInt(id),
        nuevo_rol_id: parseInt(rol_id)
      });
    } catch (err) {
      console.error('Error PATCH /rol/:id:', err);
      res.status(500).json({ message: 'Error cambiando rol' });
    }
  },
};

module.exports = usuariosController;
