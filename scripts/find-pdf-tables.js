const pool = require('../src/config/db');

(async () => {
  try {
    const [tables] = await pool.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND (
           TABLE_NAME LIKE '%hoja%'
           OR TABLE_NAME LIKE '%seguridad%'
           OR TABLE_NAME LIKE '%cert%'
           OR TABLE_NAME LIKE '%analisis%'
           OR TABLE_NAME LIKE '%coa%'
           OR TABLE_NAME LIKE '%sds%'
         )
       ORDER BY TABLE_NAME`
    );

    console.log('Candidate tables:');
    console.table(tables);

    for (const t of tables.map((x) => x.TABLE_NAME)) {
      try {
        const [cols] = await pool.query(`DESCRIBE ${t}`);
        console.log(`\n--- ${t} ---`);
        console.table(
          cols.map((c) => ({
            Field: c.Field,
            Type: c.Type,
            Null: c.Null,
            Key: c.Key,
            Default: c.Default,
            Extra: c.Extra,
          }))
        );
      } catch (e) {
        console.error('DESCRIBE failed for', t, e.code || e.message);
      }
    }
  } catch (e) {
    console.error('Error querying information_schema:', e.code || e.message);
    process.exit(1);
  }

  process.exit(0);
})();
