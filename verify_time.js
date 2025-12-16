require('dotenv').config();
const pool = require('./src/config/db');

async function verifyTime() {
    try {
        console.log('Testing DB time configuration...');
        
        // 1. Check NOW() vs DATE_SUB(...)
        const [rows] = await pool.query(`
            SELECT 
                NOW() as server_now, 
                DATE_SUB(NOW(), INTERVAL 5 HOUR) as minus_5,
                DATE_SUB(NOW(), INTERVAL 10 HOUR) as minus_10
        `);
        
        console.log('DB Time Check:');
        console.log('Server NOW():', rows[0].server_now);
        console.log('Minus 5:', rows[0].minus_5);
        console.log('Minus 10:', rows[0].minus_10);
        
        // 2. Insert a test log with the fix
        console.log('\nTarget Time (Colombia): ~14:xx');
        console.log('Which one matches?');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

verifyTime();
