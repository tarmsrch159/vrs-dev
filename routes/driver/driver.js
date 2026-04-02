const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const bcrypt = require('bcrypt');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลพนักงานขับรถ (Get Driver Information)
// =========================================================================
exports.getDriverInformation = async (req, res, next) => {
    try {

        // ======== รับค่า Request Parameters และกำหนดค่าเริ่มต้น ========
        const lic_code = req.header('lic_code');
        let { driver_code, driver_fname, driver_lname, emp_code, driver_idcard, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        driver_code = !driver_code || String(driver_code).trim() === '' ? 'ALL' : driver_code;
        driver_fname = !driver_fname || String(driver_fname).trim() === '' ? 'ALL' : driver_fname;
        driver_lname = !driver_lname || String(driver_lname).trim() === '' ? 'ALL' : driver_lname;
        emp_code = !emp_code || String(emp_code).trim() === '' ? 'ALL' : emp_code;
        driver_idcard = !driver_idcard || String(driver_idcard).trim() === '' ? 'ALL' : driver_idcard;

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
        const conditions = ["d.rm_dt IS NULL", "d.driver_flag = 1"];

        if (String(driver_code).toUpperCase() !== 'ALL') conditions.push(`d.driver_code = '${driver_code}'`);
        if (String(driver_fname).toUpperCase() !== 'ALL') conditions.push(`d.driver_fname LIKE '%${driver_fname}%'`);
        if (String(driver_lname).toUpperCase() !== 'ALL') conditions.push(`d.driver_lname LIKE '%${driver_lname}%'`);
        if (String(emp_code).toUpperCase() !== 'ALL') conditions.push(`d.emp_code = '${emp_code}'`);
        if (String(driver_idcard).toUpperCase() !== 'ALL') conditions.push(`d.driver_idcard = '${driver_idcard}'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        // ======== Query หลักสำหรับดึงข้อมูลพนักงานขับรถ (พร้อม JOIN ตารางฝ่าย/แผนก/ตำแหน่ง) ========
        const dataScript = `
            SELECT 
                d.driver_code, d.emp_code, d.driver_fname, d.driver_lname, d.driver_idcard,
                d.driver_sex, d.driver_hour_work, d.driver_pic_avartar, d.driver_position,
                d.driver_license, d.serial, d.driver_user, d.driver_user_flag,
                d.status_login, d.contact, d.prework_group_code, d.ist_dt,
                d.div_code, d.dep_code, d.pos_code, dv.div_desc, dp.dep_desc, ps.pos_desc
            FROM tbl_driver d
            LEFT JOIN tbl_department dp ON dp.dep_code = d.dep_code
            LEFT JOIN tbl_division dv ON dv.div_code = d.div_code
            LEFT JOIN tbl_position ps ON ps.pos_code = d.pos_code
            ${whereClause}
            ORDER BY d.ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        // ======== ประมวลผลและเช็คผลลัพธ์การ Query ========
        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                COUNT(driver_code) as rows_total,
                CEIL(COUNT(driver_code)::float / ${page_limit}) as page_total
            FROM tbl_driver d ${whereClause};
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลพนักงานขับรถ (Remove/Soft Delete Driver)
// =========================================================================
exports.removeDriver = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { driver_code, action } = req.body[0] || {};

        const missing = [];
        if (driver_code === undefined) missing.push('driver_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== เตรียมข้อมูลสำหรับ Parameterized Query (รองรับการลบหลายรายการพร้อมกัน) ========
        const driver_codeArr = Array.isArray(driver_code) ? driver_code : [driver_code];
        const placeholders = driver_codeArr.map((_, i) => `$${i + 2}`).join(', ');

        // ======== คำสั่ง SQL สำหรับ Soft Delete (ปรับสถานะ flag เป็น 0) ========
        const script = `UPDATE tbl_driver SET driver_flag = 0, rm_dt = $1::timestamp WHERE driver_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...driver_codeArr];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลพนักงานขับรถสำเร็จ');

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0] || {}), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลพนักงานขับรถ (Update Driver Information)
// =========================================================================
exports.setDriverInformation = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { driver_code } = req.query || {};
        const { emp_code, driver_fname, driver_lname, driver_sex, driver_pic_avartar, serial, contact, prework_group_code, pos_code, action } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (driver_code === undefined) missing.push('driver_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== เตรียมคำสั่ง SQL และ Parameters สำหรับการอัปเดตข้อมูล ========
        const script = `
            UPDATE tbl_driver SET
                emp_code = $1, driver_fname = $2, driver_lname = $3, driver_sex = $4,
                driver_pic_avartar = $5, serial = $6, contact = $7, prework_group_code = $8,
                pos_code = $9, mdf_dt = $10::timestamp
            WHERE driver_code = $11;
        `;
        const params = [
            emp_code || null, driver_fname || null, driver_lname || null, driver_sex || null,
            driver_pic_avartar || null, serial || null, contact || null, prework_group_code || null,
            pos_code || null, moment().format('YYYY-MM-DD HH:mm:ss'), driver_code
        ];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขรหัสผ่านพนักงานขับรถ (Change Driver Password)
// =========================================================================
exports.setDriverPasswordInformation = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const { driver_code } = req.query || {};
        const { old_password, new_password, action } = req.body[0] || {};

        const missing = [];
        if (driver_code === undefined) missing.push('driver_code');
        if (old_password === undefined) missing.push('old_password');
        if (new_password === undefined) missing.push('new_password');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== Query เพื่อดึงรหัสผ่านเดิมจากฐานข้อมูลมาเปรียบเทียบ ========
        const checkScript = `SELECT driver_pass FROM tbl_driver WHERE driver_code = '${driver_code}';`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkScript, config.connectionString());

        if (!tbl_check || !tbl_check.data || tbl_check.data.length === 0) {
            return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลพนักงานขับรถในระบบ');
        }

        // ======== ตรวจสอบความถูกต้องของรหัสผ่านเดิมด้วย bcrypt ========
        const isMatch = bcrypt.compareSync(old_password, tbl_check.data[0].driver_pass);
        if (!isMatch) {
            return sendResponse(res, 'error', '-3', 'รหัสผ่านเดิมไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        }

        // ======== เข้ารหัส (Hash) รหัสผ่านใหม่ และเตรียมคำสั่งอัปเดต ========
        const hashedPass = bcrypt.hashSync(new_password, 10);
        const script = `UPDATE tbl_driver SET driver_pass = $1, mdf_dt = $2::timestamp WHERE driver_code = $3;`;
        const params = [hashedPass, moment().format('YYYY-MM-DD HH:mm:ss'), driver_code];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขรหัสผ่านสำเร็จ');

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงานขับรถ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลพนักงานขับรถ (Add New Driver)
// =========================================================================
exports.addDriverInformation = async (req, res, next) => {
    try {

        // ======== รับค่าและตรวจสอบพารามิเตอร์ที่จำเป็น ========
        const lic_code = req.header('lic_code');
        const {
            emp_code, driver_fname, driver_lname, driver_idcard, driver_sex, driver_hour_work,
            driver_pic_avartar, driver_license, serial, driver_user, driver_pass,
            driver_user_flag, contact, prework_group_code, div_code, dep_code, pos_code, action
        } = req.body[0] || {};

        const missing = [];
        if (driver_fname === undefined) missing.push('driver_fname');
        if (driver_lname === undefined) missing.push('driver_lname');
        if (driver_idcard === undefined) missing.push('driver_idcard');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ======== ตรวจสอบข้อมูลซ้ำซ้อนในระบบ (เช็คจากเลขบัตรประชาชน) ========
        const checkScript = `SELECT driver_code FROM tbl_driver WHERE driver_idcard = '${driver_idcard}' AND driver_flag = 1 AND rm_dt IS NULL;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkScript, config.connectionString());

        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), `ข้อมูลพนักงานขับรถซ้ำ (${driver_idcard})`, action[0].value);
            return sendResponse(res, 'error', '-1', `ข้อมูลบัตรประชาชน '${driver_idcard}' มีอยู่ในระบบแล้ว`);
        }

        // ======== สร้างรหัสพนักงานใหม่ (PK) และเข้ารหัสผ่าน (ถ้ามี) ========
        const driver_code = 'DRV-' + moment().format('x');
        const hashedPass = driver_pass ? bcrypt.hashSync(driver_pass, 10) : null;

        // ======== เตรียมคำสั่ง SQL สำหรับเพิ่มข้อมูลใหม่ ========
        const script = `
            INSERT INTO tbl_driver 
            (driver_code, emp_code, driver_fname, driver_lname, driver_idcard, driver_sex, driver_hour_work, 
            driver_pic_avartar, driver_license, serial, driver_user, driver_pass, driver_user_flag, 
            contact, prework_group_code, div_code, dep_code, pos_code, ist_dt, driver_flag) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 1);
        `;
        const params = [
            driver_code, emp_code || null, driver_fname, driver_lname, driver_idcard, driver_sex || null,
            driver_hour_work || null, driver_pic_avartar || null, driver_license || null, serial || null,
            driver_user || null, hashedPass, driver_user_flag || null, contact || null, prework_group_code || null,
            div_code || null, dep_code || null, pos_code || null, moment().format('YYYY-MM-DD HH:mm:ss')
        ];

        // ======== Execute Query และจัดการผลลัพธ์ ========
        const tbl_temporary = await pgConn.execute2params(script, params);

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [{ driver_code }]);

    } catch (err) {

        // ======== จัดการ Error และบันทึก Log ========
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};