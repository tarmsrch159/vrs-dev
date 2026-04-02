const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {
    let script = `CREATE TABLE IF NOT EXISTS public.tbl_driver_overtime (
        drv_overtime_code varchar(255) NOT NULL,
        driver_code varchar(255) NULL,
        overtime_desc varchar(255) NULL,
        overtime_type varchar(20) NULL,
        start_overtime timestamp NULL,
        end_overtime timestamp NULL,
        create_by int4 NULL,
        modified_by int4 NULL,
        ist_dt timestamp NOT NULL,
        mdf_dt timestamp NULL,
        rm_dt timestamp NULL,
        trash bool DEFAULT false NULL,
        drv_ot_flag int4 DEFAULT 1 NULL,
        CONSTRAINT tbl_driver_overtime_pkey PRIMARY KEY (drv_overtime_code)
    );`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}
