const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลกลุ่มพนักงาน (Get Employee Group Information)
// =========================================================================
exports.getEmployeeGroupInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { emp_group_code, off_code, page_index = 1, page_limit = 10, action } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (emp_group_code === undefined) missing.push('emp_group_code');
        if (off_code === undefined) missing.push('off_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = ["emp_group_flag = '1'"];

        if (String(emp_group_code).toUpperCase() !== 'ALL') {
            conditions.push(`emp_group_code = '${emp_group_code}'`);
        }
        if (String(off_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_employee_group.off_code = '${off_code}'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT emp_group_code, emp_group_desc, emp_group_flag, ist_dt, mdf_dt, rm_dt 
            FROM tbl_employee_group 
            ${whereClause}
            ORDER BY tbl_employee_group.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', '', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                CEIL(COUNT(emp_group_code)::float / ${page_limit}) as page_total, 
                COUNT(emp_group_code) as rows_total 
            FROM tbl_employee_group 
            ${whereClause};
        `;
        const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

        let page_total = 1, rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
            page_total = parseInt(tbl_temporary_count.data[0].page_total);
            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
        }

        return sendResponse(res, 'success', '0', '', data, { page_total, rows_total });

    } catch (err) {
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลกลุ่มพนักงาน (Remove/Soft Delete Employee Group)
// =========================================================================
exports.removeEmployeeGroup = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_group_code, action } = req.body[0] || {};

        const missing = [];
        if (emp_group_code === undefined) missing.push('emp_group_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_employee_group SET emp_group_flag = '0', rm_dt = $1::timestamp WHERE emp_group_code = $2;`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), emp_group_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลกลุ่มพนักงานสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลกลุ่มพนักงาน (Update Employee Group Information)
// =========================================================================
exports.setEmployeeGroupInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_group_code } = req.query || {};
        const { emp_group_desc, off_code, action } = req.body[0] || {};

        const missing = [];
        if (emp_group_code === undefined) missing.push('emp_group_code');
        if (off_code === undefined) missing.push('off_code');
        if (emp_group_desc === undefined) missing.push('emp_group_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        if (String(off_code).toUpperCase() === 'ALL') {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            return sendResponse(res, 'error', '-1', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL');
        }

        const script = `UPDATE tbl_employee_group SET emp_group_desc = $1, off_code = $2, mdf_dt = $3::timestamp WHERE emp_group_code = $4;`;
        const params = [emp_group_desc, off_code, moment().format('YYYY-MM-DD HH:mm:ss'), emp_group_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลกลุ่มพนักงานเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลกลุ่มพนักงาน (Add Employee Group Information)
// =========================================================================
exports.addEmployeeGroupInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_group_desc, off_code, action } = req.body[0] || {};

        const missing = [];
        if (emp_group_desc === undefined) missing.push('emp_group_desc');
        if (off_code === undefined) missing.push('off_code');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        if (String(off_code).toUpperCase() === 'ALL') {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            return sendResponse(res, 'error', '-1', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL');
        }

        // ตรวจสอบข้อมูลซ้ำ
        const checkDupScript = `SELECT emp_group_code FROM tbl_employee_group WHERE emp_group_desc = '${emp_group_desc}' AND off_code = '${off_code}' AND emp_group_flag = '1' LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
            return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ');
        }

        const emp_group_code = 'emgp-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
        const script = `INSERT INTO tbl_employee_group (emp_group_code, emp_group_desc, emp_group_flag, ist_dt, off_code) VALUES ($1, $2, '1', $3, $4);`;
        const params = [emp_group_code, emp_group_desc, moment().format('YYYY-MM-DD HH:mm:ss'), off_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'เพิ่มข้อมูลกลุ่มพนักงานเรียบร้อยแล้ว', [{ emp_group_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
