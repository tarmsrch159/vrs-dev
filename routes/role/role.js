const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลสิทธิ์การใช้งาน (Get Authority Information)
// =========================================================================
exports.getAuthorityInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { authority_code = 'ALL', authority_name = 'ALL', action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = [
            "rm_dt IS NULL",
            "authority_flag = 1"
        ];

        if (String(authority_code).toUpperCase() !== 'ALL') {
            conditions.push(`authority_code = '${authority_code}'`);
        }

        if (String(authority_name).toUpperCase() !== 'ALL') {
            conditions.push(`authority_name LIKE '%${authority_name}%'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT authority_code, authority_name, ist_dt
            FROM tbl_authority
            ${whereClause}
            ORDER BY ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        const countScript = `
            SELECT 
                COUNT(authority_code) as rows_total,
                CEIL(COUNT(authority_code)::float / ${page_limit}) as page_total
            FROM tbl_authority
            ${whereClause};
        `;

        const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

        let page_total = 1, rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            page_total = parseInt(tbl_temporary_count.data[0].page_total);
        }

        return sendResponse(res, 'success', '0', '', data, { page_total: (page_total <= 0 ? 1 : page_total), rows_total });

    } catch (err) {
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลสิทธิ์การใช้งาน (Remove Authority)
// =========================================================================
exports.removeAuthority = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { authority_code, action } = req.body[0] || {};

        const missing = [];
        if (authority_code === undefined) missing.push('authority_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const authority_codeArr = Array.isArray(authority_code) ? authority_code : [authority_code];
        const placeholders = authority_codeArr.map((_, i) => `$${i + 2}`).join(', ');
        const script = `UPDATE tbl_authority SET authority_flag = 0, rm_dt = $1::timestamp WHERE authority_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...authority_codeArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลสิทธิ์การใช้งานสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลสิทธิ์การใช้งาน (Update Authority Information)
// =========================================================================
exports.setAuthorityInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { authority_code } = req.query || {};
        const { authority_name, action } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (authority_code === undefined) missing.push('authority_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_authority SET authority_name = $1, mdf_dt = $2::timestamp WHERE authority_code = $3;`;
        const params = [authority_name, moment().format('YYYY-MM-DD HH:mm:ss'), authority_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลสิทธิ์การใช้งาน (Add Authority Information)
// =========================================================================
exports.addAuthorityInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { authority_name, action } = req.body[0] || {};

        const missing = [];
        if (authority_name === undefined) missing.push('authority_name');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const authority_code = 'AUT-' + moment().format('x');
        const script = `INSERT INTO tbl_authority (authority_code, authority_name, ist_dt, authority_flag) VALUES ($1, $2, $3, $4);`;
        const params = [authority_code, authority_name, moment().format('YYYY-MM-DD HH:mm:ss'), 1];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสิทธิ์การใช้งาน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [{ authority_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};
