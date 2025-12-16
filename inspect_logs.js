const pool = require('./src/config/db');

async function inspectLogs() {
    try {
        console.log('Inspecting logs_acciones table...');
        
        // Check table structure (columns and types)
        const [columns] = await pool.query(`SHOW COLUMNS FROM logs_acciones`);
        console.log('Columns:', columns.map(c => `${c.Field} (${c.Type})`).join(', '));

        // Check recent logs
        const [rows] = await pool.query(`SELECT * FROM logs_acciones ORDER BY id_log_accion DESC LIMIT 5`);
        console.log('Recent 5 logs:');
        rows.forEach(r => {
            console.log(`ID: ${r.id_log_accion}, Modulo: "${r.modulo}", Accion: "${r.accion}", Fecha: ${r.fecha}, UsuarioID: ${r.usuario_id}`);
        });

        // Check specifically for MAT_VOLUMETRICOS
        const [volumetricos] = await pool.query(`SELECT * FROM logs_acciones WHERE modulo = 'MAT_VOLUMETRICOS' ORDER BY id_log_accion DESC LIMIT 5`);
        console.log('Recent MAT_VOLUMETRICOS logs:');
        if (volumetricos.length === 0) {
            console.log('No logs found for modulo "MAT_VOLUMETRICOS"');
        } else {
            volumetricos.forEach(r => {
                console.log(`ID: ${r.id_log_accion}, Modulo: "${r.modulo}", Accion: "${r.accion}", Fecha: ${r.fecha}, UsuarioID: ${r.usuario_id}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

inspectLogs();
