const PORTS = [4000, 42420, 42421];
const PATH = '/api/logs/acciones';

async function testPort(port) {
    const API_URL = `http://localhost:${port}${PATH}`;
    console.log(`\n=== PROBANDO PUERTO ${port} ===`);
    
    try {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: 120001, rol: 'Administrador' }, 
            'secreto-temporal-desarrollo',
            { expiresIn: '1h' }
        );

        console.log(`Intentando conectar a ${API_URL}...`);
        const res = await fetch(`${API_URL}?modulo=MAT_VOLUMETRICOS`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log('✅ ÉXITO!');
            console.log('Total logs:', data.pagination?.total);
            console.log('Logs en respuesta:', data.data?.length);
            if (data.data?.length > 0) {
                console.log('Primer log:', data.data[0]);
            } else {
                console.log('⚠️ No hay logs para este filtro.');
            }
        } else {
            console.error('❌ Error HTTP:', await res.text());
        }
    } catch (e) {
        console.error(`❌ Falló conexión al puerto ${port}:`, e.message);
    }
}

async function runTests() {
    for (const port of PORTS) {
        await testPort(port);
    }
}

runTests();
