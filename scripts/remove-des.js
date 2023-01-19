const db = require("../lib/db-conn.js");
const fs = require("fs");

//Input
const schedules = ["1017397", "1024796", "1024795"];
const plantCode = "H01";
const updatedUser = "dev_nish";

const removeDES = async () => {
  let conn_main;

  try {
    let mpoNumbers = [];
    let spoNumbers = [];
    let dockets = [];
    let taskHeaders = [];

    conn_main = await db.pool.getConnection();
    conn_pps = await db.pool_pps.getConnection();

    for (let schedule of schedules) {
      const response = await conn_main.query(`
        select distinct po_number as po
        from oms.oms_mo_details
        where schedule = '${schedule}' 
            and plant_code = '${plantCode}'`);

      mpoNumbers.push(response[0].po);
    }

    for (let mpoNumber of mpoNumbers) {
      const response = await conn_pps.query(`
          select po_number as po
          from pps.mp_sub_order
          where master_po_number = '${mpoNumber}'
              and plant_code = '${plantCode}'
              and is_active = true`);

      spoNumbers.push(response[0].po);
    }

    for (let spoNumber of spoNumbers) {
      const response = await conn_pps.query(`
        select docket_number, jm_docket_id
        from pps.jm_dockets jd
        where sub_po = '${spoNumber}'
            and plant_code = '${plantCode}'`);

      delete response.meta;

      //Pushes to same array
      dockets.push(...response);
    }

    let logger = fs.createWriteStream(
      `exports/remove-des/rdes_queries_${Date.now()}.sql`,
      {
        flags: "a",
      }
    );

    //Adds a new line
    let writeQuery = (line) => logger.write(`${line}\n`);

    await Promise.all(
      dockets.map(async (x) => {
        const response = await conn_main.query(`
        select task_header_id
        from tms.task_jobs tj
        where job_number = '${x.docket_number}'
          and plant_code = '${plantCode}'
          and task_job_reference = '${x.jm_docket_id}'
          and task_status not in ('OPEN','COMPLETED') 
          `);

        if (response[0] != null) {
          writeQuery(
            `update tms.task_jobs set task_status = 'COMPLETED', updated_user = '${updatedUser}', updated_at = NOW() where job_number = ${x.docket_number} and plant_code = '${plantCode}';`
          );
          writeQuery(
            `update tms.task_jobs set task_status = 'COMPLETED', task_progress = 'COMPLETED' updated_user = '${updatedUser}', updated_at = NOW() where job_number = ${x.docket_number} and plant_code = '${plantCode}';`
          );
          taskHeaders.push(1);
        }
      })
    );

    logger.end();

    if (taskHeaders.length == 0) {
      console.log(
        "Note: All docket related jobs are either open or completed."
      );
    } else {
      console.log("Note: Docket related queries have been exported.");
    }
  } catch (error) {
    console.log(error);
  } finally {
    if (conn_main) {
      conn_main.end();
    }

    if (conn_pps) {
      conn_pps.end();
    }

    return;
  }
};

removeDES();
