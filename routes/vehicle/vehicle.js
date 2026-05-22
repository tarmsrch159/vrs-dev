const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
// =========== ดึงข้อมูลรายการรถและหางลาก ===========
exports.getVehicleInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        // ======== รับพารามิเตอร์ ========
        let { vehicle_code, vehicle_name, veh_type_code, veh_group_code, seat_capacity, blackbox_id,
            action, page_index, page_limit } = req.body[0] || {};

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;
        vehicle_code = vehicle_code === undefined ? 'ALL' : vehicle_code;
        vehicle_name = vehicle_name === undefined ? 'ALL' : vehicle_name;
        veh_type_code = veh_type_code === undefined ? 'ALL' : veh_type_code;
        veh_group_code = veh_group_code === undefined ? 'ALL' : veh_group_code;
        seat_capacity = seat_capacity === undefined ? 'ALL' : seat_capacity;
        blackbox_id = blackbox_id === undefined ? 'ALL' : blackbox_id;

        // ======== ตรวจสอบพารามิเตอร์ที่จำเป็น ========
        let missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
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
            "tbl_vehicle.rm_dt IS NULL",
            "tbl_vehicle.vehicle_flag = 1"
        ];

        if (vehicle_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle.vehicle_code = '${vehicle_code}'`);
        }

        if (vehicle_name.toString().toUpperCase() !== 'ALL') {
            // ใช้ LIKE สำหรับการค้นหาจากชื่อรถ
            conditions.push(`tbl_vehicle.vehicle_name LIKE '%${vehicle_name}%'`);
        }

        if (veh_type_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle.veh_type_code = '${veh_type_code}'`);
        }

        if (veh_group_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle.veh_group_code = '${veh_group_code}'`);
        }

        if (seat_capacity.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle.seat_capacity = ${seat_capacity}`); // int4
        }

        if (blackbox_id.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_vehicle.blackbox_id = '${blackbox_id}'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล Vehicle (อิงตาม DDL ล่าสุด) ========
        let baseSelectQuery = `
            SELECT 
                tbl_vehicle.vehicle_code,
                tbl_vehicle.veh_type_code,
                tbl_vehicle.veh_group_code,
                tbl_vehicle.vehicle_name,
                tbl_vehicle_type.veh_type_name,
                tbl_vehicle_group.veh_group_name,
                tbl_vehicle.blackbox_id,
                tbl_vehicle_group.veh_group_color_rgb,
                tbl_vehicle.ist_dt,
                tbl_vehicle.vehicle_flag,
                tbl_vehicle.pic_front,
                tbl_vehicle.pic_back,
                tbl_vehicle.pic_left,
                tbl_vehicle.pic_right,
                tbl_vehicle.pic_interior,
                tbl_vehicle.vehicle_color,
                tbl_vehicle_brand.brand_name,
                tbl_vehicle_model.model_name,
                tbl_vehicle.submodel_code,  
                tbl_vehicle_submodel.submodel_name,
                tbl_vehicle_submodel.vehicle_year as submodel_year,
                tbl_vehicle_mode.mode_name,
                tbl_vehicle.seat_capacity,
                tbl_vehicle.vehicle_license,
                COALESCE(u.vehicle_users, '[]'::json) as vehicle_users,
                COALESCE(d.vehicle_drivers, '[]'::json) as vehicle_drivers
            FROM tbl_vehicle
            LEFT JOIN tbl_vehicle_type ON tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
            LEFT JOIN tbl_vehicle_submodel ON tbl_vehicle.submodel_code = tbl_vehicle_submodel.submodel_code
            LEFT JOIN tbl_vehicle_model ON tbl_vehicle_submodel.model_code = tbl_vehicle_model.model_code
            LEFT JOIN tbl_vehicle_brand ON tbl_vehicle_model.brand_code = tbl_vehicle_brand.brand_code
            LEFT JOIN tbl_vehicle_mode ON tbl_vehicle.mode_code = tbl_vehicle_mode.mode_code
            LEFT JOIN tbl_vehicle_group ON tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code
            
            LEFT JOIN (
                SELECT 
                    tbl_vehicle_users.vehicle_code,
                    json_agg(json_build_object(
                        'user_code', tbl_vehicle_users.user_code,
                        'name_lastname', tbl_users.name
                    )) as vehicle_users
                FROM tbl_vehicle_users
                LEFT JOIN tbl_users ON tbl_vehicle_users.user_code = tbl_users.user_code
                GROUP BY tbl_vehicle_users.vehicle_code
            ) u ON tbl_vehicle.vehicle_code = u.vehicle_code

            LEFT JOIN (
                SELECT
                    tbl_vehicle_driver.vehicle_code,
                    json_agg(json_build_object(
                        'driver_code', tbl_vehicle_driver.driver_code,
                        'name_lastname', tbl_driver.driver_fname || ' ' || tbl_driver.driver_lname
                    )) as vehicle_drivers
                FROM tbl_vehicle_driver
                LEFT JOIN tbl_driver ON tbl_vehicle_driver.driver_code = tbl_driver.driver_code
                GROUP BY tbl_vehicle_driver.vehicle_code
            ) d ON tbl_vehicle.vehicle_code = d.vehicle_code
        `;

        let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_vehicle.ist_dt DESC 
           
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
                        COUNT(vehicle_code) as rows_total,
                        CEIL(COUNT(vehicle_code)::float / ${page_limit}) as page_total
                    FROM tbl_vehicle
                    ${whereClause};
                `;

                console.log(countScript);
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
            if (action && action[0]) {
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            }
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

        // เช็คเผื่อ action เป็น undefined จะได้ไม่พังตอน catch error 
        if (req.body[0] && req.body[0].action) {
            await xglobal.action_logs(lic_code, req.body[0].action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', req.body[0].action[0].value);
        }
        return;
    });

}

exports.removeVehicle = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { vehicle_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        let missing = [];
        if (vehicle_code == undefined) missing.push('vehicle_code');
        if (lic_code == undefined) missing.push('lic_code');
        if (action == undefined) missing.push('action');

        if (missing.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let vehicle_codeArr = Array.isArray(vehicle_code) ? vehicle_code : [vehicle_code];
            let vehicle_codeIn = vehicle_codeArr.map(c => `'${c}'`).join(', ');


            let script = `UPDATE tbl_vehicle SET vehicle_flag = 0, rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE vehicle_code IN (${vehicle_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลรถสำเร็จ',
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        }
        return;
    });

}
// =========================================================================
// API แก้ไขข้อมูลรถและหางลาก (Set Vehicle Information)
// =========================================================================
exports.setVehicleInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { vehicle_code } = req.query;
        const {
            vehicle_name, veh_type_code, pic_front, pic_back, pic_left, blackbox_id,
            pic_right, pic_interior, vehicle_color, submodel_code, mode_code,
            seat_capacity, vehicle_license, vehicle_drivers, vehicle_users, action
        } = req.body[0] || {};

        // 1. ตรวจสอบพารามิเตอร์ที่จำเป็น 
        const missing = [];
        if (!vehicle_code) missing.push('vehicle_code');
        if (!vehicle_name) missing.push('vehicle_name');
        if (!veh_type_code) missing.push('veh_type_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถแก้ไขข้อมูลได้ (ขาดพารามิเตอร์: ${missing.join(', ')})`);
        }

        // 2. ดำเนินการแก้ไขผ่าน Transaction
        const transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {

            // 2.1 อัปเดตข้อมูลรถหลัก
            const scriptVehicle = `
                UPDATE tbl_vehicle SET 
                    vehicle_name = $1, veh_type_code = $2, pic_front = $3, pic_back = $4,
                    pic_left = $5, pic_right = $6, pic_interior = $7, vehicle_color = $8,
                    submodel_code = $9, mode_code = $10, seat_capacity = $11, 
                    vehicle_license = $12, mdf_dt = $13, blackbox_id = $14
                WHERE vehicle_code = $15;
            `;
            const paramsVehicle = [
                vehicle_name, veh_type_code, pic_front || null, pic_back || null,
                pic_left || null, pic_right || null, pic_interior || null, vehicle_color,
                submodel_code || null, mode_code || null, seat_capacity || 0,
                vehicle_license, moment().format('YYYY-MM-DD HH:mm:ss'), blackbox_id, vehicle_code
            ];

            const resVehicle = await pgConn.executeWithClient(client, scriptVehicle, paramsVehicle);
            if (resVehicle.rowCount === 0) throw new Error("ไม่สามารถแก้ไขข้อมูลรถได้ (ไม่พบรหัสรถ)");

            // 2.2 จัดการพนักงานขับรถประจำ (ลบเดิม-เพิ่มใหม่)
            await pgConn.executeWithClient(client, `DELETE FROM tbl_vehicle_driver WHERE vehicle_code = $1;`, [vehicle_code]);
            if (Array.isArray(vehicle_drivers) && vehicle_drivers.length > 0) {
                for (const driver_code of vehicle_drivers) {
                    const scriptInsertDriver = `INSERT INTO tbl_vehicle_driver (vehicle_code, driver_code, ist_dt, veh_drv_flag) VALUES ($1, $2, $3, 1);`;
                    await pgConn.executeWithClient(client, scriptInsertDriver, [vehicle_code, driver_code, moment().format('YYYY-MM-DD HH:mm:ss')]);
                }
            }

            // 2.3 จัดการผู้ใช้รถประจำ (ลบเดิม-เพิ่มใหม่)
            await pgConn.executeWithClient(client, `DELETE FROM tbl_vehicle_users WHERE vehicle_code = $1;`, [vehicle_code]);
            if (Array.isArray(vehicle_users) && vehicle_users.length > 0) {
                for (const user_code of vehicle_users) {
                    const scriptInsertUser = `INSERT INTO tbl_vehicle_users (vehicle_code, user_code, ist_dt, veh_user_flag) VALUES ($1, $2, $3, 1);`;
                    await pgConn.executeWithClient(client, scriptInsertUser, [vehicle_code, user_code, moment().format('YYYY-MM-DD HH:mm:ss')]);
                }
            }

            return true;
        }, config.connectionString());

        // 3. จัดการผลลัพธ์
        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถ', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `แก้ไขข้อมูลไม่สำเร็จ: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลรถสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
}
// =========================================================================
// API เพิ่มข้อมูลรถและหางลาก (Add Vehicle Information)
// =========================================================================
exports.addVehicleInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            vehicle_name, veh_type_code, veh_group_code, pic_front, pic_back, pic_left, blackbox_id,
            pic_right, pic_interior, vehicle_color, submodel_code, mode_code,
            seat_capacity, vehicle_license, vehicle_drivers, vehicle_users, action
        } = req.body[0] || {};

        // 1. ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (vehicle_name === undefined) missing.push('vehicle_name');
        if (veh_type_code === undefined) missing.push('veh_type_code');
        if (veh_group_code === undefined) missing.push('veh_group_code');
        if (vehicle_license === undefined) missing.push('vehicle_license');
        if (vehicle_drivers === undefined) missing.push('vehicle_drivers');
        if (vehicle_users === undefined) missing.push('vehicle_users');
        if (action === undefined) missing.push('action');
        if (blackbox_id === undefined) missing.push('blackbox_id');
        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const vehicle_code = 'VEH-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        // 2. ดำเนินการผ่าน Transaction
        const transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {

            // 2.1 เช็คข้อมูลทะเบียนซ้ำภายใน Transaction
            const checkDupScript = `SELECT vehicle_code FROM tbl_vehicle WHERE vehicle_license = $1 AND vehicle_flag = 1 AND trash = false LIMIT 1;`;
            const checkDupParams = [vehicle_license];
            const tbl_check = await pgConn.executeWithClient(client, checkDupScript, checkDupParams);

            if (!tbl_check.code && tbl_check.data.length > 0) {
                throw new Error(`ทะเบียนรถ '${vehicle_license}' นี้มีอยู่ในระบบแล้ว`);
            }

            // 2.2 บันทึกข้อมูลรถ (Main Record)
            const scriptVehicle = `
                INSERT INTO tbl_vehicle (
                    vehicle_code, vehicle_name, veh_type_code, veh_group_code, pic_front, pic_back,
                    pic_left, pic_right, pic_interior, vehicle_color, submodel_code, mode_code,
                    seat_capacity, vehicle_license, ist_dt, vehicle_flag, blackbox_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16);
            `;
            const paramsVehicle = [
                vehicle_code, vehicle_name, veh_type_code, veh_group_code, pic_front, pic_back,
                pic_left, pic_right, pic_interior, vehicle_color, submodel_code, mode_code,
                seat_capacity, vehicle_license, moment().format('YYYY-MM-DD HH:mm:ss'), blackbox_id
            ];

            const resVehicle = await pgConn.executeWithClient(client, scriptVehicle, paramsVehicle);
            if (resVehicle.code) throw new Error("ไม่สามารถบันทึกข้อมูลรถได้");

            // 2.3 บันทึกรายชื่อพนักงานขับรถประจำ (Sub Records)
            if (Array.isArray(vehicle_drivers) && vehicle_drivers.length > 0) {
                for (const driver_code of vehicle_drivers) {
                    const scriptDriver = `INSERT INTO tbl_vehicle_driver (vehicle_code, driver_code, ist_dt, veh_drv_flag) VALUES ($1, $2, $3, $4);`;
                    const paramsDriver = [vehicle_code, driver_code, moment().format('YYYY-MM-DD HH:mm:ss'), 1];
                    const resDriver = await pgConn.executeWithClient(client, scriptDriver, paramsDriver);
                    if (resDriver.code) throw new Error("ไม่สามารถบันทึกข้อมูลพนักงานขับรถประจำได้");
                }
            }

            // 2.4 บันทึกรายชื่อผู้ใช้รถประจำ (Sub Records)
            if (Array.isArray(vehicle_users) && vehicle_users.length > 0) {
                for (const user_code of vehicle_users) {
                    const scriptUser = `INSERT INTO tbl_vehicle_users (vehicle_code, user_code, ist_dt, veh_user_flag) VALUES ($1, $2, $3, 1);`;
                    const paramsUser = [vehicle_code, user_code, moment().format('YYYY-MM-DD HH:mm:ss')];
                    const resUser = await pgConn.executeWithClient(client, scriptUser, paramsUser);
                    if (resUser.code) throw new Error("ไม่สามารถบันทึกข้อมูลผู้ใช้รถประจำได้");
                }
            }

            return { vehicle_code };

        }, config.connectionString());

        // 3. จัดการผลลัพธ์จาก Transaction
        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถ', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [transactionResult.data]);

    } catch (err) {
        console.error('System Error:', err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};
