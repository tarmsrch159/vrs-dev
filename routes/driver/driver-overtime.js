const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลการทำงานล่วงเวลาของพนักงานขับรถ (Get Driver Overtime Information)
// =========================================================================
exports.getDriverOvertimeInformation = async (req, res, next) => {
    try {
        // ======== รับค่า Request Parameters และกำหนดค่าเริ่มต้น ========
        const lic_code = req.header('lic_code');
        let { drv_overtime_code, driver_code, overtime_type, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        drv_overtime_code = !drv_overtime_code || String(drv_overtime_code).trim() === '' ? 'ALL' : drv_overtime_code;
        driver_code = !driver_code || String(driver_code).trim() === '' ? 'ALL' : driver_code;
        overtime_type = !overtime_type || String(overtime_type).trim() === '' ? 'ALL' : overtime_type;

        // ======== ตรวจสอบความครบถ้วนของพารามิเตอร์ที่จำเป็น ========
        const missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== จัดการค่า Offset สำหรับทำ Pagination ========
        const offset = page_index > 0 ? page_index - 1 : 0;

        // ======== สร้างเงื่อนไข WHERE สำหรับกรองข้อมูล (Dynamic Conditions) ========
        const conditions = ["ot.rm_dt IS NULL", "ot.drv_ot_flag = 1"];

        if (String(drv_overtime_code).toUpperCase() !== 'ALL') conditions.push(`ot.drv_overtime_code = '${drv_overtime_code}'`);
        if (String(driver_code).toUpperCase() !== 'ALL') conditions.push(`ot.driver_code = '${driver_code}'`);
        if (String(overtime_type).toUpperCase() !== 'ALL') conditions.push(`ot.overtime_type = '${overtime_type}'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        // ======== Query หลักสำหรับดึงข้อมูล (พร้อม JOIN ตารางพนักงานขับรถ) ========
        const dataScript = `
            SELECT 
                ot.drv_overtime_code, ot.driver_code, d.driver_fname, d.driver_lname,
                ot.overtime_desc, ot.overtime_type, ot.start_overtime, ot.end_overtime,
                 ot.ist_dt, ot.drv_ot_flag
            FROM tbl_driver_overtime ot
            LEFT JOIN tbl_driver d ON d.driver_code = ot.driver_code
            ${whereClause}
            ORDER BY ot.start_overtime DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        // ======== ประมวลผลและเช็คผลลัพธ์การ Query ========
        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        // ======== แปลงค่า Null ให้เป็น String ว่าง เพื่อป้องกัน Error ที่ฝั่ง Frontend ========
        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // ======== Query สำหรับนับจำนวนแถวทั้งหมด (เพื่อใช้ทำ Pagination Total Pages) ========
        const countScript = `
            SELECT 
                COUNT(drv_overtime_code) as rows_total, 
                CEIL(COUNT(drv_overtime_code)::float / ${page_limit}) as page_total
            FROM tbl_driver_overtime ot ${whereClause};
        `;
        const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

        let page_total = 1, rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            page_total = Math.max(1, parseInt(tbl_temporary_count.data[0].page_total));
        }

        // ======== ส่งข้อมูลกลับไปยัง Client ========
        return sendResponse(res, 'success', '0', '', data, { page_total, rows_total });

    } catch (err) {
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลการทำงานล่วงเวลา (Remove/Soft Delete Driver Overtime)
// =========================================================================
exports.removeDriverOvertime = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { drv_overtime_code, action } = req.body[0] || {};

        const missing = [];
        if (drv_overtime_code === undefined) missing.push('drv_overtime_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const drv_overtime_codeArr = Array.isArray(drv_overtime_code) ? drv_overtime_code : [drv_overtime_code];
        const placeholders = drv_overtime_codeArr.map((_, i) => `$${i + 2}`).join(', ');

        const script = `UPDATE tbl_driver_overtime SET drv_ot_flag = 0, rm_dt = $1::timestamp WHERE drv_overtime_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...drv_overtime_codeArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลการทำงานล่วงเวลา (Update Driver Overtime Information)
// =========================================================================
exports.setDriverOvertimeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { drv_overtime_code } = req.query || {};
        const { overtime_desc, overtime_type, start_overtime, end_overtime, modified_by, action } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (drv_overtime_code === undefined) missing.push('drv_overtime_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `
            UPDATE tbl_driver_overtime SET
                overtime_desc = $1, overtime_type = $2, 
                start_overtime = $3::timestamp, end_overtime = $4::timestamp, 
                modified_by = $5, mdf_dt = $6::timestamp
            WHERE drv_overtime_code = $7;
        `;
        const params = [
            overtime_desc || '', overtime_type || '',
            start_overtime || null, end_overtime || null,
            modified_by || null, moment().format('YYYY-MM-DD HH:mm:ss'),
            drv_overtime_code
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลการทำงานล่วงเวลา (Add Driver Overtime Information)
// =========================================================================
exports.addDriverOvertimeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { driver_code, overtime_desc, overtime_type, start_overtime, end_overtime, action } = req.body[0] || {};

        const missing = [];
        if (driver_code === undefined) missing.push('driver_code');
        if (start_overtime === undefined) missing.push('start_overtime');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const drv_overtime_code = 'OT-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        const script = `
            INSERT INTO tbl_driver_overtime 
            (drv_overtime_code, driver_code, overtime_desc, overtime_type, start_overtime, end_overtime, ist_dt, drv_ot_flag) 
            VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, 1);
        `;
        const params = [
            drv_overtime_code, driver_code, overtime_desc || '',
            overtime_type || '', start_overtime, end_overtime || null,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลทำงานล่วงเวลาพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [{ drv_overtime_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};