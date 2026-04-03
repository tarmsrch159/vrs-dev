const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลพนักงาน (Get Employee Information)
// =========================================================================
exports.getEmployeeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { emp_code, off_code, ptrl_code = 'ALL', page_index = 1, page_limit = 10, action } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (off_code === undefined) missing.push('off_code');
        if (emp_code === undefined) missing.push('emp_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = ["emp_flag = '1'"];

        if (String(emp_code).toUpperCase() !== 'ALL') {
            conditions.push(`emp_code = '${emp_code}'`);
        }
        if (String(off_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_employee.off_code = '${off_code}'`);
        }
        if (String(ptrl_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_employee.ptrl_code = '${ptrl_code}'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT  
                emp_code, emp_username, emp_userpassword, emp_ref_code, emp_name, emp_surname, emp_mobile_number, emp_email, 
                emp_div_code, div_desc as emp_div_desc, 
                emp_dep_code, dep_desc as emp_dep_desc, 
                emp_pos_code, pos_desc as emp_pos_desc, 
                tbl_employee.emp_group_code, emp_group_desc as emp_group_desc, 
                emp_gender, 
                tbl_employee.emp_role_code, emp_role_desc,
                emp_flag, emp_image_profile, 
                tbl_employee.ist_dt, tbl_employee.mdf_dt, tbl_employee.rm_dt, 
                tbl_employee.off_code, tbl_office.off_desc, 
                tbl_employee.ptrl_code, tbl_petrol.ptrl_desc
            FROM tbl_employee 
            LEFT JOIN tbl_division ON tbl_employee.emp_div_code = tbl_division.div_code
            LEFT JOIN tbl_department ON tbl_employee.emp_div_code = tbl_department.div_code AND tbl_employee.emp_dep_code = tbl_department.dep_code
            LEFT JOIN tbl_position ON tbl_employee.emp_div_code = tbl_position.div_code AND tbl_employee.emp_dep_code = tbl_position.dep_code AND tbl_employee.emp_pos_code = tbl_position.pos_code
            LEFT JOIN tbl_employee_group ON tbl_employee.emp_group_code = tbl_employee_group.emp_group_code
            LEFT JOIN tbl_employee_role ON tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
            LEFT JOIN tbl_office ON tbl_employee.off_code = tbl_office.off_code
            LEFT JOIN tbl_petrol ON tbl_employee.ptrl_code = tbl_petrol.ptrl_code 
            ${whereClause}
            ORDER BY tbl_employee.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', '', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        const countScript = `
            SELECT 
                CEIL(COUNT(emp_code)::float / ${page_limit}) as page_total, 
                COUNT(emp_code) as rows_total 
            FROM tbl_employee 
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลพนักงาน (Remove/Soft Delete Employee)
// =========================================================================
exports.removeEmployee = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_code, action } = req.body[0] || {};

        const missing = [];
        if (emp_code === undefined) missing.push('emp_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_employee SET emp_flag = '0', rm_dt = $1::timestamp WHERE emp_code = $2;`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), emp_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลพนักงานสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลพนักงาน (Update Employee Information)
// =========================================================================
exports.setEmployeeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_code } = req.query || {};
        const {
            emp_ref_code, emp_name, emp_surname, emp_mobile_number, emp_email,
            emp_div_code = '', emp_dep_code = '', emp_pos_code = '', emp_group_code = '',
            emp_gender, emp_role_code, emp_image_profile, off_code, ptrl_code, action
        } = req.body[0] || {};

        const missing = [];
        if (emp_code === undefined) missing.push('emp_code');
        if (off_code === undefined) missing.push('off_code');
        if (emp_ref_code === undefined) missing.push('emp_ref_code');
        if (emp_name === undefined) missing.push('emp_name');
        if (emp_surname === undefined) missing.push('emp_surname');
        if (emp_mobile_number === undefined) missing.push('emp_mobile_number');
        if (emp_email === undefined) missing.push('emp_email');
        if (emp_gender === undefined) missing.push('emp_gender');
        if (emp_role_code === undefined) missing.push('emp_role_code');
        if (emp_image_profile === undefined) missing.push('emp_image_profile');
        if (action === undefined) missing.push('action');
        if (ptrl_code === undefined) missing.push('ptrl_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        if (String(off_code).toUpperCase() === 'ALL') {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            return sendResponse(res, 'error', '-1', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL');
        }

        const script = `
            UPDATE tbl_employee SET 
                emp_ref_code = $1, emp_name = $2, emp_surname = $3, emp_mobile_number = $4, emp_email = $5,
                emp_div_code = $6, emp_dep_code = $7, emp_pos_code = $8, emp_group_code = $9,
                emp_gender = $10, emp_role_code = $11, emp_image_profile = $12, off_code = $13, ptrl_code = $14,
                mdf_dt = $15::timestamp 
            WHERE emp_code = $16;
        `;
        const params = [
            emp_ref_code, emp_name, emp_surname, emp_mobile_number, emp_email,
            emp_div_code, emp_dep_code, emp_pos_code, emp_group_code,
            emp_gender, emp_role_code, emp_image_profile, off_code, ptrl_code,
            moment().format('YYYY-MM-DD HH:mm:ss'), emp_code
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขรหัสผ่านพนักงาน (Update Employee Password)
// =========================================================================
exports.setEmployeePasswordInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { emp_code } = req.query || {};
        const { emp_userpassword, action } = req.body[0] || {};

        const missing = [];
        if (emp_code === undefined) missing.push('emp_code');
        if (emp_userpassword === undefined) missing.push('emp_userpassword');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const emp_encode = xglobal.Base64.encode(emp_userpassword);
        const script = `UPDATE tbl_employee SET emp_userpassword = $1, mdf_dt = $2::timestamp WHERE emp_code = $3;`;
        const params = [emp_encode, moment().format('YYYY-MM-DD HH:mm:ss'), emp_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขรหัสผ่านพนักงานเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลพนักงาน (Add Employee Information)
// =========================================================================
exports.addEmployeeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            emp_username, emp_userpassword, emp_ref_code, emp_name, emp_surname, emp_mobile_number, emp_email,
            emp_div_code = '', emp_dep_code = '', emp_pos_code = '', emp_group_code = '',
            emp_gender, emp_role_code, emp_image_profile, off_code, ptrl_code, action
        } = req.body[0] || {};

        const missing = [];
        if (emp_username === undefined) missing.push('emp_username');
        if (off_code === undefined) missing.push('off_code');
        if (emp_userpassword === undefined) missing.push('emp_userpassword');
        if (emp_ref_code === undefined) missing.push('emp_ref_code');
        if (emp_name === undefined) missing.push('emp_name');
        if (emp_surname === undefined) missing.push('emp_surname');
        if (emp_mobile_number === undefined) missing.push('emp_mobile_number');
        if (emp_email === undefined) missing.push('emp_email');
        if (emp_gender === undefined) missing.push('emp_gender');
        if (emp_role_code === undefined) missing.push('emp_role_code');
        if (emp_image_profile === undefined) missing.push('emp_image_profile');
        if (action === undefined) missing.push('action');
        if (ptrl_code === undefined) missing.push('ptrl_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบ ptrl_code
        const query_ptrl = `SELECT ptrl_code FROM tbl_petrol WHERE ptrl_code = '${ptrl_code}' LIMIT 1;`;
        const tbl_ptrl = await pgConn.get(dbPrefix + lic_code, query_ptrl, config.connectionString());
        if (!tbl_ptrl.code && tbl_ptrl.data.length === 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ptrl_code ไม่ถูกต้อง', action[0].value);
            return sendResponse(res, 'error', '-1', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ptrl_code ไม่ถูกต้อง');
        }

        if (String(off_code).toUpperCase() === 'ALL') {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            return sendResponse(res, 'error', '-1', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL');
        }

        // ตรวจสอบข้อมูลซ้ำ
        const checkDupScript = `SELECT emp_code FROM tbl_employee WHERE emp_username = '${emp_username}' AND off_code = '${off_code}' AND emp_flag = '1' LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลผู้ใช้งานซ้ำ', action[0].value);
            return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลผู้ใช้งานซ้ำ');
        }

        const emp_code = 'empl-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
        const emp_encode = xglobal.Base64.encode(emp_userpassword);
        const script = `
            INSERT INTO tbl_employee 
            (emp_code, emp_username, emp_userpassword, emp_ref_code, emp_name, emp_surname, emp_mobile_number,
            emp_email, emp_div_code, emp_dep_code, emp_pos_code, emp_group_code, emp_gender, emp_role_code, 
            emp_image_profile, emp_flag, ist_dt, off_code, ptrl_code) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '1', $16, $17, $18);
        `;
        const params = [
            emp_code, emp_username, emp_encode, emp_ref_code, emp_name, emp_surname, emp_mobile_number,
            emp_email, emp_div_code, emp_dep_code, emp_pos_code, emp_group_code, emp_gender, emp_role_code,
            emp_image_profile, moment().format('YYYY-MM-DD HH:mm:ss'), off_code, ptrl_code
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'เพิ่มข้อมูลพนักงานเรียบร้อยแล้ว', [{ emp_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
