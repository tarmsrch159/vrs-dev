const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูลโหมดรถ ===========
exports.getVehicleModeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { mode_code, mode_desc,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        mode_code = mode_code === undefined ? 'ALL' : mode_code;
        mode_desc = mode_desc === undefined ? 'ALL' : mode_desc;

        // ======== ตรวจสอบพารามิเตอร์ที่จำเป็น ========
        if (lic_code === undefined || action === undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            return;
        }

        if (page_index > 0) {
            page_index -= 1;
        }

        // ======== สร้างเงื่อนไข WHERE (Dynamic Conditions) ========
        let conditions = [
            "tbl_vehicle_mode.rm_dt IS NULL",
            "tbl_vehicle_mode.mode_flag = 1"
        ];

        if (mode_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_mode.mode_code = '${mode_code}'`);
        }

        if (mode_desc.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_mode.mode_desc LIKE '%${mode_desc}%'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Vehicle Mode ========
        let dataScript = `
            SELECT 
                tbl_vehicle_mode.mode_code, 
                tbl_vehicle_mode.mode_desc,
                tbl_vehicle_mode.create_by,
                tbl_vehicle_mode.modified_by,
                tbl_vehicle_mode.mode_flag, 
                tbl_vehicle_mode.ist_dt, 
                tbl_vehicle_mode.mdf_dt, 
                tbl_vehicle_mode.rm_dt
            FROM tbl_vehicle_mode
            ${whereClause}
            ORDER BY tbl_vehicle_mode.ist_dt DESC 
            OFFSET (${page_index} * ${page_limit}) LIMIT ${page_limit};
        `;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                // แปลง null เป็น ""
                tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                // ======== นับจำนวนแถวทั้งหมด ========
                let countScript = `
                    SELECT 
                        COUNT(mode_code) as rows_total,
                        CEIL(COUNT(mode_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle_mode
                    ${whereClause};
                `;

                let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

                let page_total = 0;
                let rows_total = 0;

                if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
                    rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
                    page_total = parseInt(tbl_temporary_count.data[0].page_total);
                }

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    page_total: (page_total <= 0 ? 1 : page_total),
                    rows_total: rows_total,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                return;

            } else {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ไม่พบข้อมูล',
                    data: xresult,
                    page_total: 0,
                    rows_total: 0,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                return;
            }
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `เกิดข้อผิดพลาดภายในระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);

        if (req.body[0] && req.body[0].action) {
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== ลบข้อมูลโหมดรถ (รองรับ array) ===========
exports.removeVehicleMode = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { mode_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (mode_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let mode_codeArr = Array.isArray(mode_code) ? mode_code : [mode_code];
            let mode_codeIn = mode_codeArr.map(c => `'${c}'`).join(', ');

            let script = `UPDATE tbl_vehicle_mode SET mode_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE mode_code IN (${mode_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลโหมดรถสำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลโหมดรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

// =========== แก้ไขข้อมูลโหมดรถ ===========
exports.setVehicleModeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { mode_code } = req.query;

        let {
            mode_desc,
            modified_by,
            action
        } = req.body[0] || {};

        // เช็คพารามิเตอร์ที่จำเป็น 
        if (action === undefined || lic_code === undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            return;
        }

        let script = `
            UPDATE tbl_vehicle_mode SET
            mode_desc = '${mode_desc}',
            modified_by = '${modified_by}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE mode_code = '${mode_code}';
        `;

        script = script.replace(/'NULL'/gi, "NULL");

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'บันทึกข้อมูลสำเร็จ',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
            return;
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.error(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `เกิดข้อผิดพลาดภายในระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);

        if (req.body[0] && req.body[0].action) {
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'แก้ไขข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== เพิ่มข้อมูลโหมดรถ ===========
exports.addVehicleModeInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');

        let {
            mode_desc,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (mode_desc == undefined || action == undefined || lic_code == undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            return res.status(200).send(response);
        }

        // เช็คข้อมูลซ้ำจาก mode_desc
        let scriptCheck = `SELECT mode_code FROM tbl_vehicle_mode WHERE mode_desc = '${mode_desc}' AND mode_flag = 1 AND rm_dt IS NULL;`;
        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ข้อมูลโหมดรถ '${mode_desc}' มีอยู่ในระบบแล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลโหมดรถ', JSON.stringify(req.body[0]), `ข้อมูลโหมดรถซ้ำ (${mode_desc})`, action[0].value);
            return;
        }

        // สร้างรหัสโหมดรถใหม่
        let mode_code = 'MODE-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        // คำสั่ง INSERT
        let script = `INSERT INTO tbl_vehicle_mode 
            (mode_code, mode_desc, ist_dt, mode_flag) 
            VALUES ($1, $2, $3, $4);`;

        let params = [
            mode_code,
            mode_desc,
            moment().format('YYYY-MM-DD HH:mm:ss'),
            1
        ];

        let tbl_temporary = await pgConn.execute2params(script, params);

        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'บันทึกข้อมูลสำเร็จ',
                data: [{
                    mode_code: mode_code
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
            return;
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
        }

    })().catch(async (err) => {
        let lic_code = req.header('lic_code');
        let action = req.body[0]?.action;
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `เกิดข้อผิดพลาดภายในระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
        if (action) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลโหมดรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return;
    });
}
