const db = require("../lib/db-conn.js");
const fs = require("fs");

//Input: Databases to compare
const dbNames = ["wms", "wms_13_01_2023_1851"];

const compareRows = async () => {
  let conn;

  try {
    let tableNames = [];
    let tableMeta = [];
    let tableMetaDup = [];
    let tableMetaFinal = [];

    conn = await db.pool.getConnection();

    const response = await conn.query(`
        select table_name
        from information_schema.tables
        where table_type = 'BASE TABLE'
        and table_schema = '${dbNames[0]}'
        and table_schema not in ('information_schema','mysql',
                                 'performance_schema','sys')
        order by table_name`);

    for (const key of Object.keys(response)) {
      let table = response[key];
      tableNames.push(table.table_name);
    }

    tableNames.pop();

    for (const index of dbNames.keys()) {
      for (const tableName of tableNames) {
        const results = await conn.query(
          `select count(1) as rowCount from ${dbNames[index]}.${tableName}`
        );

        for (const key of Object.keys(results)) {
          let count = results[key];
          if (count.rowCount != null) {
            if (index == 0) {
              tableMeta.push({
                tableName: tableName,
                [dbNames[index]]: count.rowCount,
              });
            } else {
              tableMetaDup.push({
                tableName: tableName,
                [dbNames[index]]: count.rowCount,
              });
            }
          }
        }
      }
    }

    tableMeta.map((meta) => {
      const filteredMetaDup = tableMetaDup.find(
        (x) => x.tableName == meta.tableName
      );

      meta = {
        tableName: meta.tableName,
        [dbNames[0]]: Number(meta[dbNames[0]]),
        [dbNames[1]]: Number(filteredMetaDup[dbNames[1]]),
        diff: Number(meta[dbNames[0]] - filteredMetaDup[dbNames[1]]),
      };

      if (meta.diff != 0) {
        tableMetaFinal.push(meta);
      }
    });

    let jsonContent = JSON.stringify(tableMetaFinal);

    fs.writeFile(
      `exports/compare-rows/export_${Date.now()}.json`,
      jsonContent,
      "utf8",
      function (err) {
        if (err) {
          return console.log(err);
        }
        console.log("Data exported to JSON.");
      }
    );
  } catch (err) {
    console.log(err);
  } finally {
    if (conn) return conn.end();
  }
};

compareRows();
