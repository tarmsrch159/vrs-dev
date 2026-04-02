const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลแผนก (Get Department Information)
// =========================================================================
exports.getDepartmentInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { div_code = 'ALL', dep_code, page_index = 1, page_limit = 10, action } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (div_code === undefined) missing.push('div_code');
        if (dep_code === undefined) missing.push('dep_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // if (String(div_code).toUpperCase() === 'ALL') {
        //     await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง div_code ไม่รองรับ ALL', action[0].value);
        //     return sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง div_code ไม่รองรับ ALL');
        // }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = [
            "tbl_department.dep_flag = '1'",
            "tbl_division.div_flag = '1'"
        ];

        if (String(dep_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_department.dep_code = '${dep_code}'`);
        }

        if (String(div_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_division.div_code = '${div_code}'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                tbl_department.div_code, tbl_division.div_desc, dep_code, dep_desc, dep_flag,
                tbl_department.ist_dt, tbl_department.mdf_dt, tbl_department.rm_dt 
            FROM tbl_department
            LEFT JOIN tbl_division ON tbl_department.div_code = tbl_division.div_code
            ${whereClause}
            ORDER BY tbl_department.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        console.log(dataScript)

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', '', [], { page_total: 0, rows_total: 0 });
        }

        // แปลงค่า null ให้เป็น string ว่าง
        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                CEIL(COUNT(dep_code)::float / ${page_limit}) as page_total, 
                COUNT(dep_code) as rows_total 
            FROM tbl_department 
            LEFT JOIN tbl_division ON tbl_department.div_code = tbl_division.div_code 
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแผนก', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลแผนก (Remove/Soft Delete Department)
// =========================================================================
exports.removeDepartment = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { dep_code, action } = req.body[0] || {};

        const missing = [];
        if (dep_code === undefined) missing.push('dep_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_department SET dep_flag = '0', rm_dt = $1::timestamp WHERE dep_code = $2;`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), dep_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแผนก', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลแผนกสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลแผนก (Update Department Information)
// =========================================================================
exports.setDepartmentInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { dep_code } = req.query || {};
        const { dep_desc, action } = req.body[0] || {};

        const missing = [];
        if (dep_code === undefined) missing.push('dep_code');
        if (dep_desc === undefined) missing.push('dep_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_department SET dep_desc = $1, mdf_dt = $2::timestamp WHERE dep_code = $3;`;
        const params = [dep_desc, moment().format('YYYY-MM-DD HH:mm:ss'), dep_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแผนก', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลแผนกเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลแผนก (Add Department Information)
// =========================================================================
exports.addDepartmentInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { div_code, dep_desc, action } = req.body[0] || {};

        const missing = [];
        if (dep_desc === undefined) missing.push('dep_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบข้อมูลซ้ำ
        const checkDupScript = `SELECT dep_code FROM tbl_department WHERE dep_desc = '${dep_desc}' AND dep_flag = '1' LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());

        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
            return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ');
        }

        const dep_code = 'dep-' + moment().format('x');
        const script = `INSERT INTO tbl_department (div_code, dep_code, dep_desc, dep_flag, ist_dt) VALUES ($1, $2, $3, '1', $4);`;
        const params = [div_code, dep_code, dep_desc, moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแผนก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแผนก', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'เพิ่มข้อมูลแผนกเรียบร้อยแล้ว', [{ dep_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
