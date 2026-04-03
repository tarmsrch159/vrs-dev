const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูลประเภทรถ ===========
exports.getVehicleTypeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { veh_type_code, veh_type_name,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        veh_type_code = veh_type_code === undefined ? 'ALL' : veh_type_code;
        veh_type_name = veh_type_name === undefined ? 'ALL' : veh_type_name;

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
            "tbl_vehicle_type.rm_dt IS NULL",
            "tbl_vehicle_type.veh_type_flag = 1"
        ];

        if (veh_type_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_type.veh_type_code = '${veh_type_code}'`);
        }

        if (veh_type_name.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_type.veh_type_name LIKE '%${veh_type_name}%'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Vehicle Type ========
        let dataScript = `
            SELECT 
                tbl_vehicle_type.veh_type_code, 
                tbl_vehicle_type.veh_type_name,
                tbl_vehicle_type.width,
                tbl_vehicle_type.height,
                tbl_vehicle_type.length,
                tbl_vehicle_type.min_dimention,
                tbl_vehicle_type.max_dimention,
                tbl_vehicle_type.min_percent_dimention,
                tbl_vehicle_type.min_weight,
                tbl_vehicle_type.max_weight,
                tbl_vehicle_type.over_weight,
                tbl_vehicle_type.speed_limit,
                tbl_vehicle_type.box_limit,
                tbl_vehicle_type.passenger_limit,
                tbl_vehicle_type.veh_type_flag, 
                tbl_vehicle_type.ist_dt, 
                tbl_vehicle_type.mdf_dt, 
                tbl_vehicle_type.rm_dt
            FROM tbl_vehicle_type
            ${whereClause}
            ORDER BY tbl_vehicle_type.ist_dt DESC 
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
                        COUNT(veh_type_code) as rows_total,
                        CEIL(COUNT(veh_type_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle_type
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}


//Success
exports.addVehicleTypeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');

        let {
            veh_type_name,
            width,
            height,
            length,
            min_dimention,
            max_dimention,
            min_percent_dimention,
            min_weight,
            max_weight,
            over_weight,
            speed_limit,
            box_limit,
            passenger_limit,
            action
        } = req.body[0];

        // 2. ดัก undefined สำหรับ action ป้องกันการอ่าน index [0] ที่ไม่มีอยู่จริง
        let act_id = action?.[0]?.id;
        let act_val = action?.[0]?.value || '';

        // เช็คพารามิเตอร์ที่จำเป็น
        if (veh_type_name === undefined || action === undefined || lic_code === undefined) {
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

        let isError = false;

        // ==========================================
        // Helper ดัก undefined, null, และค่าว่าง('') สำหรับเซฟลงฐานข้อมูล
        // ==========================================
        const safeStr = (val) => (val === undefined || val === null) ? '' : val;

        // ==========================================
        // เช็คว่า veh_type_name มีอยู่ใน tbl_vehicle_type หรือยัง
        // ==========================================
        let scriptCheck = `SELECT veh_type_code FROM tbl_vehicle_type 
            WHERE veh_type_name = '${safeStr(veh_type_name)}';`;

        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ข้อมูลประเภทรถ '${veh_type_name}' มีอยู่ในระบบแล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, act_id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), `ข้อมูลประเภทรถซ้ำ (${veh_type_name})`, act_val);
            return;
        }

        // ==========================================
        // ไม่ซ้ำ -> Insert ใหม่
        // ==========================================
        let veh_type_code = 'VEHT-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        let script = `
            INSERT INTO tbl_vehicle_type (
                veh_type_code, veh_type_name, width, height, length, 
                min_dimention, max_dimention, min_percent_dimention, 
                min_weight, max_weight, over_weight, speed_limit, 
                box_limit, passenger_limit, veh_type_flag, ist_dt
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, 
                $9, $10, $11, $12, 
                $13, $14, $15, $16
            );
        `;

        let params = [
            veh_type_code,
            veh_type_name,
            width,
            height,
            length,
            min_dimention,
            max_dimention,
            min_percent_dimention,
            min_weight,
            max_weight,
            over_weight,
            speed_limit,
            box_limit,
            passenger_limit,
            1,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ]

        let tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            isError = true;
        }

        if (isError) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้', action[0].value);
            return;
        }

        let response = [{
            status: 'success',
            invalid_code: '0',
            message: `บันทึกข้อมูลสำเร็จ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];

        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return;

    })().catch(async (err) => {
        console.error(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `เกิดข้อผิดพลาดภายในระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).send(response);

        // ดัก undefined ใน Catch block เผื่อพังตั้งแต่การรับค่าบรรทัดแรกๆ
        const _lic = req.header('lic_code');

        if (_lic && act_id) {
            await xglobal.action_logs(_lic, act_id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', act_val);
        }
        return;
    });

}

exports.setVehicleTypeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_type_code } = req.query;

        let {
            veh_type_name,
            width,
            height,
            length,
            min_dimention,
            max_dimention,
            min_percent_dimention,
            min_weight,
            max_weight,
            over_weight,
            speed_limit,
            box_limit,
            passenger_limit,
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
            UPDATE tbl_vehicle_type SET
            veh_type_name = '${veh_type_name}',
            width = '${width}',
            height = '${height}',
            length = '${length}',
            min_dimention = '${min_dimention}',
            max_dimention = '${max_dimention}',
            min_percent_dimention = '${min_percent_dimention}',
            min_weight = '${min_weight}',
            max_weight = '${max_weight}',
            over_weight = '${over_weight}',
            speed_limit = '${speed_limit}',
            box_limit = '${box_limit}',
            passenger_limit = '${passenger_limit}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE veh_type_code = '${veh_type_code}';
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

exports.removeVehicleType = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_type_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_type_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let veh_type_codeArr = Array.isArray(veh_type_code) ? veh_type_code : [veh_type_code];
            let veh_type_codeIn = veh_type_codeArr.map(c => `'${c}'`).join(', ');

            let script = `UPDATE tbl_vehicle_type SET veh_type_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE veh_type_code IN (${veh_type_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลประเภทรถสำเร็จ',
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}
