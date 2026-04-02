const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลกอง/ฝ่าย (Get Division Information)
// =========================================================================
exports.getDivisionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { div_code, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (div_code === undefined) missing.push('div_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        let script = `SELECT div_code, div_desc, div_flag, ist_dt, mdf_dt, rm_dt FROM tbl_division WHERE div_flag = '1'`;
        let countScript = `SELECT ceil((ceil(count(div_code)) / ${page_limit})) as page_total, (count(div_code)) as rows_total FROM tbl_division WHERE div_flag = '1'`;

        if (String(div_code).toUpperCase() !== 'ALL') {
            script += ` AND div_code = '${div_code}'`;
            countScript += ` AND div_code = '${div_code}'`;
        }

        script += ` ORDER BY ist_dt DESC LIMIT ${page_limit} OFFSET ${offset * page_limit}`;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', '', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลกอง/ฝ่าย (Remove/Soft Delete Division)
// =========================================================================
exports.removeDivision = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { div_code, action } = req.body[0] || {};

        const missing = [];
        if (div_code === undefined) missing.push('div_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_division SET div_flag = '0', rm_dt = $1::timestamp WHERE div_code = $2;`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), div_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลกอง/ฝ่ายสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลกอง/ฝ่าย (Update Division Information)
// =========================================================================
exports.setDivisionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { div_code } = req.query || {};
        const { div_desc, action } = req.body[0] || {};

        const missing = [];
        if (div_code === undefined) missing.push('div_code');
        if (div_desc === undefined) missing.push('div_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_division SET div_desc = $1, mdf_dt = $2::timestamp WHERE div_code = $3;`;
        const params = [div_desc, moment().format('YYYY-MM-DD HH:mm:ss'), div_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลกอง/ฝ่ายเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลกอง/ฝ่าย (Add Division Information)
// =========================================================================
exports.addDivisionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { div_desc, action } = req.body[0] || {};

        const missing = [];
        if (div_desc === undefined) missing.push('div_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบข้อมูลซ้ำ
        const checkDupScript = `SELECT div_code FROM tbl_division WHERE div_desc = '${div_desc}' AND div_flag = '1' LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());

        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
            return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ');
        }

        const div_code = 'div-' + moment().format('x');
        const script = `INSERT INTO tbl_division (div_code, div_desc, div_flag, ist_dt) VALUES ($1, $2, '1', $3);`;
        const params = [div_code, div_desc, moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกอง/ฝ่าย', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'เพิ่มข้อมูลกอง/ฝ่ายเรียบร้อยแล้ว', [{ div_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
