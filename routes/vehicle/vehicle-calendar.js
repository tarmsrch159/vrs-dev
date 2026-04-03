const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูลปฏิทินสถานะรถ ===========
exports.getVehicleCalendarInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { veh_cal_code, vehicle_code, unavail_date,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        veh_cal_code = veh_cal_code === undefined ? 'ALL' : veh_cal_code;
        vehicle_code = vehicle_code === undefined ? 'ALL' : vehicle_code;
        unavail_date = unavail_date === undefined ? 'ALL' : unavail_date;

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
            "tbl_vehicle_calendar.rm_dt IS NULL",
            "tbl_vehicle_calendar.veh_cal_flag = 1"
        ];

        if (veh_cal_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_calendar.veh_cal_code = '${veh_cal_code}'`);
        }

        if (vehicle_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_calendar.vehicle_code = '${vehicle_code}'`);
        }

        if (unavail_date.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_calendar.unavail_date = '${unavail_date}'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Calendar ========
        let dataScript = `
            SELECT 
                tbl_vehicle_calendar.veh_cal_code,
                tbl_vehicle_calendar.vehicle_code,
                tbl_vehicle.vehicle_name,
                tbl_vehicle.vehicle_license,
                tbl_vehicle_type.veh_type_name,
                tbl_vehicle_brand.brand_name,
                tbl_vehicle_model.model_name,
                tbl_vehicle_submodel.submodel_name,
                tbl_vehicle_calendar.unavail_remark,
                tbl_vehicle_calendar.unavail_type,
                tbl_vehicle_calendar.unavail_period,
                tbl_vehicle.seat_capacity,
                tbl_vehicle_calendar.unavail_date,
                tbl_vehicle_calendar.ist_dt
            FROM tbl_vehicle_calendar
            LEFT JOIN tbl_vehicle ON tbl_vehicle_calendar.vehicle_code = tbl_vehicle.vehicle_code
            LEFT JOIN tbl_vehicle_submodel ON tbl_vehicle.submodel_code = tbl_vehicle_submodel.submodel_code
            LEFT JOIN tbl_vehicle_model ON tbl_vehicle_submodel.model_code = tbl_vehicle_model.model_code
            LEFT JOIN tbl_vehicle_brand ON tbl_vehicle_model.brand_code = tbl_vehicle_brand.brand_code
            LEFT JOIN tbl_vehicle_type ON tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
            ${whereClause}
            ORDER BY tbl_vehicle_calendar.unavail_date DESC 
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
                        COUNT(tbl_vehicle_calendar.veh_cal_code) as rows_total,
                        CEIL(COUNT(tbl_vehicle_calendar.veh_cal_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle_calendar
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== ลบข้อมูลปฏิทินสถานะรถ (รองรับ array) ===========
exports.removeVehicleCalendar = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_cal_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_cal_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let veh_cal_codeArr = Array.isArray(veh_cal_code) ? veh_cal_code : [veh_cal_code];
            let veh_cal_codeIn = veh_cal_codeArr.map(c => `'${c}'`).join(', ');

            let script = `UPDATE tbl_vehicle_calendar SET veh_cal_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE veh_cal_code IN (${veh_cal_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลสำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

// =========== แก้ไขข้อมูลปฏิทินสถานะรถ ===========
exports.setVehicleCalendarInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_cal_code } = req.query;

        let {
            unavail_remark,
            unavail_type,
            unavail_period,
            action
        } = req.body[0] || {};

        // เช็คพารามิเตอร์ที่จำเป็น 
        if (action === undefined || lic_code === undefined || veh_cal_code === undefined) {

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
            UPDATE tbl_vehicle_calendar SET
            unavail_remark = '${unavail_remark}',
            unavail_type = '${unavail_type}',
            unavail_period = '${unavail_period}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE veh_cal_code = '${veh_cal_code}';
        `;

        script = script.replace(/'NULL'/gi, "NULL").replace(/'undefined'/gi, "NULL");

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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'แก้ไขข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== เพิ่มข้อมูลปฏิทินสถานะรถ ===========
exports.addVehicleCalendarInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');

        let {
            vehicle_code,
            unavail_date,
            unavail_remark,
            unavail_type,
            unavail_period,
            action
        } = req.body[0] || {};

        // เช็คเฉพาะส่วนที่สำคัญ
        if (vehicle_code == undefined || unavail_date == undefined || action == undefined || lic_code == undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            return res.status(200).send(response);
        }

        // เช็คข้อมูลซ้ำจาก vehicle_code และ unavail_date
        let scriptCheck = `SELECT veh_cal_code FROM tbl_vehicle_calendar WHERE vehicle_code = '${vehicle_code}' AND unavail_date = '${unavail_date}' AND veh_cal_flag = 1 AND rm_dt IS NULL;`;
        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ข้อมูลปฏิทินสำหรับรถคันนี้และวันที่นี้มีอยู่ในระบบแล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), `ข้อมูลปฏิทินซ้ำ (${vehicle_code} / ${unavail_date})`, action[0].value);
            return;
        }

        // สร้างรหัสปฏิทินใหม่
        let veh_cal_code = 'VCL-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        // คำสั่ง INSERT
        let script = `INSERT INTO tbl_vehicle_calendar 
            (veh_cal_code, vehicle_code, unavail_date, unavail_remark, unavail_type, unavail_period, ist_dt, veh_cal_flag) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;

        let params = [
            veh_cal_code,
            vehicle_code,
            unavail_date,
            unavail_remark,
            unavail_type,
            unavail_period,
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
                    veh_cal_code: veh_cal_code
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินสถานะรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return;
    });
}
