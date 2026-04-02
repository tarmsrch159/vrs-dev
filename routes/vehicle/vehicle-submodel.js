const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูลรุ่นย่อยรถ ===========
exports.getVehicleSubmodelInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { submodel_code, model_code, brand_code, submodel_name,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        submodel_code = submodel_code === undefined ? 'ALL' : submodel_code;
        model_code = model_code === undefined ? 'ALL' : model_code;
        brand_code = brand_code === undefined ? 'ALL' : brand_code;
        submodel_name = submodel_name === undefined ? 'ALL' : submodel_name;

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
            "tbl_vehicle_submodel.rm_dt IS NULL",
            "tbl_vehicle_submodel.trash = false",
            "tbl_vehicle_submodel.submodel_flag = 1"
        ];

        if (submodel_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_submodel.submodel_code = '${submodel_code}'`);
        }

        if (model_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_submodel.model_code = '${model_code}'`);
        }

        if (brand_code.toString().toUpperCase() !== 'ALL') {
            // ค้นหาผ่าน model -> brand
            conditions.push(`tbl_vehicle_model.brand_code = '${brand_code}'`);
        }

        if (submodel_name.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle_submodel.submodel_name LIKE '%${submodel_name}%'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Submodel ========
        let dataScript = `
            SELECT 
                tbl_vehicle_model.brand_code,
                tbl_vehicle_submodel.model_code,
                tbl_vehicle_submodel.submodel_code,
                tbl_vehicle_brand.brand_name,
                tbl_vehicle_model.model_name,
                tbl_vehicle_submodel.submodel_name,
                tbl_vehicle_submodel.vehicle_year,
                tbl_vehicle_submodel.ist_dt
            FROM tbl_vehicle_submodel
            LEFT JOIN tbl_vehicle_model ON tbl_vehicle_submodel.model_code = tbl_vehicle_model.model_code
            LEFT JOIN tbl_vehicle_brand ON tbl_vehicle_model.brand_code = tbl_vehicle_brand.brand_code
            ${whereClause}
            ORDER BY tbl_vehicle_submodel.ist_dt DESC 
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
                        COUNT(tbl_vehicle_submodel.submodel_code) as rows_total,
                        CEIL(COUNT(tbl_vehicle_submodel.submodel_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle_submodel
                    LEFT JOIN tbl_vehicle_model ON tbl_vehicle_submodel.model_code = tbl_vehicle_model.model_code
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== ลบข้อมูลรุ่นย่อยรถ (รองรับ array) ===========
exports.removeVehicleSubmodel = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { submodel_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (submodel_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let submodel_codeArr = Array.isArray(submodel_code) ? submodel_code : [submodel_code];
            let submodel_codeIn = submodel_codeArr.map(c => `'${c}'`).join(', ');

            let script = `UPDATE tbl_vehicle_submodel SET submodel_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE submodel_code IN (${submodel_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลรุ่นย่อยรถสำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

// =========== แก้ไขข้อมูลรุ่นย่อยรถ ===========
exports.setVehicleSubmodelInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { submodel_code } = req.query;

        let {
            model_code,
            submodel_name,
            vehicle_year,
            action
        } = req.body[0] || {};

        // เช็คพารามิเตอร์ที่จำเป็น 
        if (action === undefined || lic_code === undefined || submodel_code === undefined) {

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
            UPDATE tbl_vehicle_submodel SET
            model_code = '${model_code}',
            submodel_name = '${submodel_name}',
            vehicle_year = '${vehicle_year}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE submodel_code = '${submodel_code}';
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'แก้ไขข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

// =========== เพิ่มข้อมูลรุ่นย่อยรถ ===========
exports.addVehicleSubmodelInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');

        let {
            model_code,
            submodel_name,
            vehicle_year,
            action
        } = req.body[0] || {};

        // เช็คเฉพาะส่วนที่สำคัญ
        if (model_code == undefined || submodel_name == undefined || action == undefined || lic_code == undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            return res.status(200).send(response);
        }

        // เช็คข้อมูลซ้ำจาก submodel_name ภายใต้ model_code เดียวกัน
        let scriptCheck = `SELECT submodel_code FROM tbl_vehicle_submodel WHERE submodel_name = '${submodel_name}' AND model_code = '${model_code}' AND submodel_flag = 1 AND trash = false AND rm_dt IS NULL;`;
        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ข้อมูลรุ่นย่อยรถ '${submodel_name}' ภายใต้วิ่งรุ่นนี้มีอยู่ในระบบแล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), `ข้อมูลรุ่นย่อยรถซ้ำ (${submodel_name})`, action[0].value);
            return;
        }

        // สร้างรหัสรุ่นย่อยรถใหม่
        let submodel_code = 'SUB-' + moment().format('x');

        // คำสั่ง INSERT
        let script = `INSERT INTO tbl_vehicle_submodel 
            (submodel_code, model_code, submodel_name, vehicle_year, ist_dt, submodel_flag) 
            VALUES ($1, $2, $3, $4, $5, $6);`;

        let params = [
            submodel_code,
            model_code,
            submodel_name,
            vehicle_year,
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
                    submodel_code: submodel_code
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรุ่นย่อยรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return;
    });
}
