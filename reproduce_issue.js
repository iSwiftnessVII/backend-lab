const pool = require('./src/config/db');

async function test() {
  try {
    const fecha = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());
    
    console.log('Fecha generada:', fecha);

    // Test log insert with dummy user if possible, or just print query
    // We don't have a valid user ID easily without querying, let's pick one
    const [users] = await pool.query('SELECT id FROM usuarios LIMIT 1');
    if (!users.length) {
        console.log('No users found to test log');
        return;
    }
    const userId = users[0].id;
    console.log('Testing with userId:', userId);

    // Try inserting into logs_acciones
    console.log('Inserting into logs_acciones...');
    await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
        [userId, 'TEST_CREAR', 'TEST_PAPELERIA', fecha]
    );
    console.log('Log inserted successfully');

    // Try inserting into movimientos_inventario
    // We need a dummy product reference
    console.log('Inserting into movimientos_inventario...');
    await pool.query(
        'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento, fecha) VALUES (?, ?, ?, ?, ?)',
        ['PAPELERIA', '99999', userId, 'ENTRADA', fecha]
    );
    console.log('Movimiento inserted successfully');

  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    process.exit();
  }
}

test();
