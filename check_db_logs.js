const pool = require('./src/config/db');

async function checkLogs() {
    try {
        console.log('Checking logs for MAT_VOLUMETRICOS...');
        const [rows] = await pool.query(`
            SELECT id_log_accion, modulo, accion, fecha, descripcion 
            FROM logs_acciones 
            WHERE modulo = 'MAT_VOLUMETRICOS' 
            ORDER BY fecha DESC 
            LIMIT 10
        `);
        console.log('Found logs:', rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkLogs();
