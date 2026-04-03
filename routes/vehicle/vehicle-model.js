const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูลรุ่นรถ ===========
exports.getVehicleModelInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { model_code, brand_code, model_name,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        model_code = model_code === undefined ? 'ALL' : model_code;
        brand_code = brand_code === undefined ? 'ALL' : brand_code;
        model_name = model_name === undefined ? 'ALL' : model_name;

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
            "tbl_vehicle_model.rm_dt IS NULL",
            "tbl_vehicle_model.trash = false",
            "tbl_vehicle_model.model_flag = 1"
        ];

        if (model_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_model.model_code = '${model_code}'`);
        }

        if (brand_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_model.brand_code = '${brand_code}'`);
        }

        if (model_name.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_model.model_name LIKE '%${model_name}%'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Model ========
        let dataScript = `
            SELECT 
                tbl_vehicle_model.brand_code,
                tbl_vehicle_model.model_code,
                tbl_vehicle_brand.brand_name,
                tbl_vehicle_model.model_name,
                tbl_vehicle_model.create_by,
                tbl_vehicle_model.modified_by,
                tbl_vehicle_model.ist_dt,
                tbl_vehicle_model.mdf_dt,
                tbl_vehicle_model.model_flag
            FROM tbl_vehicle_model
            LEFT JOIN tbl_vehicle_brand ON tbl_vehicle_model.brand_code = tbl_vehicle_brand.brand_code
            ${whereClause}
            ORDER BY tbl_vehicle_model.ist_dt DESC 
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
                        COUNT(tbl_vehicle_model.model_code) as rows_total,
                        CEIL(COUNT(tbl_vehicle_model.model_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle_model
                    LEFT JOIN tbl_vehicle_brand ON tbl_vehicle_model.brand_code = tbl_vehicle_brand.brand_code
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== ลบข้อมูลรุ่นรถ (รองรับ array) ===========
exports.removeVehicleModel = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { model_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (model_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let model_codeArr = Array.isArray(model_code) ? model_code : [model_code];
            let model_codeIn = model_codeArr.map(c => `'${c}'`).join(', ');

            let script = `UPDATE tbl_vehicle_model SET model_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE model_code IN (${model_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลรุ่นรถสำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลรุ่นรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

// =========== แก้ไขข้อมูลรุ่นรถ ===========
exports.setVehicleModelInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { model_code } = req.query;

        let {
            brand_code,
            model_name,
            action
        } = req.body[0] || {};

        // เช็คพารามิเตอร์ที่จำเป็น 
        if (action === undefined || lic_code === undefined || model_code === undefined) {

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
            UPDATE tbl_vehicle_model SET
            brand_code = '${brand_code}',
            model_name = '${model_name}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE model_code = '${model_code}';
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'แก้ไขข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== เพิ่มข้อมูลรุ่นรถ ===========
exports.addVehicleModelInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');

        let {
            brand_code,
            model_name,
            action
        } = req.body[0] || {};

        // เช็คเฉพาะส่วนที่สำคัญ
        if (brand_code == undefined || model_name == undefined || action == undefined || lic_code == undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            return res.status(200).send(response);
        }

        // เช็คข้อมูลซ้ำจาก model_name ภายใน brand_code เดียวกัน
        let scriptCheck = `SELECT model_code FROM tbl_vehicle_model WHERE model_name = '${model_name}' AND brand_code = '${brand_code}' AND model_flag = 1 AND trash = false AND rm_dt IS NULL;`;
        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ข้อมูลรุ่นรถ '${model_name}' ภายใต้ยี่ห้อนี้มีอยู่ในระบบแล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), `ข้อมูลรุ่นรถซ้ำ (${model_name})`, action[0].value);
            return;
        }

        // สร้างรหัสรุ่นรถใหม่
        let model_code = 'MODEL-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        // คำสั่ง INSERT
        let script = `INSERT INTO tbl_vehicle_model 
            (model_code, brand_code, model_name, ist_dt, model_flag) 
            VALUES ($1, $2, $3, $4, $5);`;

        let params = [
            model_code,
            brand_code,
            model_name,
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
                    model_code: model_code
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return;
    });
}
