const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลปฏิทินพนักงานขับรถ (Get Driver Calendar Information)
// =========================================================================
exports.getDriverCalendarInformation = async (req, res, next) => {
    try {

        // ======== รับค่า Request Parameters และกำหนดค่าเริ่มต้น ========
        const lic_code = req.header('lic_code');
        let { drv_leave_code, driver_code, leave_type, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        drv_leave_code = !drv_leave_code || String(drv_leave_code).trim() === '' ? 'ALL' : drv_leave_code;
        driver_code = !driver_code || String(driver_code).trim() === '' ? 'ALL' : driver_code;
        leave_type = !leave_type || String(leave_type).trim() === '' ? 'ALL' : leave_type;

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
        const conditions = ["c.rm_dt IS NULL", "c.drv_leave_flag = 1"];

        if (String(drv_leave_code).toUpperCase() !== 'ALL') conditions.push(`c.drv_leave_code = '${drv_leave_code}'`);
        if (String(driver_code).toUpperCase() !== 'ALL') conditions.push(`c.driver_code = '${driver_code}'`);
        if (String(leave_type).toUpperCase() !== 'ALL') conditions.push(`c.leave_type = '${leave_type}'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        // ======== Query หลักสำหรับดึงข้อมูลปฏิทิน (พร้อม JOIN ตารางพนักงานขับรถ) ========
        const dataScript = `
            SELECT 
                c.drv_leave_code, c.driver_code, d.driver_fname, d.driver_lname,
                c.leave_work_date, c.leave_work_desc, c.leave_type,
                c.leave_work_flag, c.create_by, c.modified_by, c.ist_dt, c.mdf_dt
            FROM tbl_driver_calendar c
            LEFT JOIN tbl_driver d ON d.driver_code = c.driver_code
            ${whereClause}
            ORDER BY c.leave_work_date DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        // ======== ประมวลผลและเช็คผลลัพธ์การ Query ========
        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                COUNT(drv_leave_code) as rows_total, 
                CEIL(COUNT(drv_leave_code)::float / ${page_limit}) as page_total
            FROM tbl_driver_calendar c ${whereClause};
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

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลปฏิทินพนักงานขับรถ (Remove/Soft Delete Driver Calendar)
// =========================================================================
exports.removeDriverCalendar = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { drv_leave_code, action } = req.body[0] || {};

        const missing = [];
        if (drv_leave_code === undefined) missing.push('drv_leave_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== เตรียมข้อมูลสำหรับ Parameterized Query (รองรับการลบหลายรายการพร้อมกัน) ========
        const drv_leave_codeArr = Array.isArray(drv_leave_code) ? drv_leave_code : [drv_leave_code];
        const placeholders = drv_leave_codeArr.map((_, i) => `$${i + 2}`).join(', ');

        // ======== คำสั่ง SQL สำหรับ Soft Delete (ปรับสถานะ flag เป็น 0) ========
        const script = `UPDATE tbl_driver_calendar SET drv_leave_flag = 0, rm_dt = $1::timestamp WHERE drv_leave_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...drv_leave_codeArr];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลปฏิทินพนักงานขับรถสำเร็จ');

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0] || {}), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลปฏิทินพนักงานขับรถ (Update Driver Calendar Information)
// =========================================================================
exports.setDriverCalendarInformation = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { drv_leave_code } = req.query || {};
        const { leave_work_date, leave_work_desc, leave_type, leave_work_flag, action } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (drv_leave_code === undefined) missing.push('drv_leave_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== เตรียมคำสั่ง SQL และ Parameters สำหรับการอัปเดตข้อมูล ========
        const script = `
            UPDATE tbl_driver_calendar SET
                leave_work_date = $1, leave_work_desc = $2, 
                leave_type = $3, leave_work_flag = $4, mdf_dt = $5::timestamp
            WHERE drv_leave_code = $6;
        `;
        const params = [
            leave_work_date || null, leave_work_desc || '',
            leave_type || '', leave_work_flag || null,
            moment().format('YYYY-MM-DD HH:mm:ss'), drv_leave_code
        ];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลปฏิทินพนักงานขับรถ (Add Driver Calendar Information)
// =========================================================================
exports.addDriverCalendarInformation = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { driver_code, leave_work_date, leave_work_desc, leave_type, leave_work_flag, action } = req.body[0] || {};

        const missing = [];
        if (driver_code === undefined) missing.push('driver_code');
        if (leave_work_date === undefined) missing.push('leave_work_date');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== สร้างรหัสปฏิทินใหม่ (PK) ========
        const drv_leave_code = 'CAL-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

        // ======== เตรียมคำสั่ง SQL สำหรับเพิ่มข้อมูลใหม่ ========
        const script = `
            INSERT INTO tbl_driver_calendar 
            (drv_leave_code, driver_code, leave_work_date, leave_work_desc, leave_type, leave_work_flag,  ist_dt, drv_leave_flag) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1);
        `;
        const params = [
            drv_leave_code, driver_code, leave_work_date, leave_work_desc || '',
            leave_type || '', leave_work_flag || null,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [{ drv_leave_code }]);

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปฏิทินพนักงานขับรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};