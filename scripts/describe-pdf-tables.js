const pool = require('../src/config/db');

async function describeTable(tableName) {
  const [rows] = await pool.query(`DESCRIBE ${tableName}`);
  console.log(`--- ${tableName} ---`);
  console.table(
    rows.map((r) => ({
      Field: r.Field,
      Type: r.Type,
      Null: r.Null,
      Key: r.Key,
      Default: r.Default,
      Extra: r.Extra,
    }))
  );
}

(async () => {
  try {
    await describeTable('hoja_seguridad');
  } catch (e) {
    console.error('DESCRIBE failed for hoja_seguridad:', e.code || e.message);
  }

  try {
    await describeTable('cert_analisis');
  } catch (e) {
    console.error('DESCRIBE failed for cert_analisis:', e.code || e.message);
  }

  process.exit(0);
})();
