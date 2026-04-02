const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลตำแหน่ง (Get Position Information)
// =========================================================================
exports.getPositionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { dep_code, pos_code, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (dep_code === undefined) missing.push('dep_code');
        if (pos_code === undefined) missing.push('pos_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // if (String(dep_code).toUpperCase() === 'ALL') {
        //     await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง dep_code ไม่รองรับ ALL', action[0].value);
        //     return sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง dep_code ไม่รองรับ ALL');
        // }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = [
            "tbl_position.pos_flag = '1'",
            "tbl_department.dep_flag = '1'",
            "tbl_division.div_flag = '1'"
        ];

        if (String(pos_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_position.pos_code = '${pos_code}'`);
        }

        if (String(dep_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_department.dep_code = '${dep_code}'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                tbl_division.div_code, tbl_department.dep_code, tbl_position.pos_code, 
                tbl_division.div_desc, tbl_department.dep_desc, tbl_position.pos_desc, 
                tbl_position.pos_flag, 
                CASE WHEN tbl_position.pos_salary IS NULL THEN 0 ELSE tbl_position.pos_salary END AS pos_salary, 
                tbl_position.ist_dt, tbl_position.mdf_dt, tbl_position.rm_dt
            FROM tbl_position
            LEFT JOIN tbl_department ON tbl_position.dep_code = tbl_department.dep_code
            LEFT JOIN tbl_division ON tbl_department.div_code = tbl_division.div_code
            AND tbl_department.dep_flag = '1'
            AND tbl_division.div_flag = '1'
            ${whereClause}
            ORDER BY tbl_position.ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        console.log(dataScript)
        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', '', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                COUNT(*) as rows_total,
                CEIL(COUNT(*)::float / ${page_limit}) as page_total
            FROM tbl_position
            LEFT JOIN tbl_department ON tbl_position.dep_code = tbl_department.dep_code
            AND tbl_department.dep_flag = '1'
            LEFT JOIN tbl_division ON tbl_department.div_code = tbl_division.div_code
            AND tbl_division.div_flag = '1'
            ${whereClause};
        `;
        const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

        let page_total = 1, rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            page_total = parseInt(tbl_temporary_count.data[0].page_total);
        }

        return sendResponse(res, 'success', '0', '', data, { page_total, rows_total });

    } catch (err) {
        console.error(err);
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลตำแหน่ง (Remove/Soft Delete Position)
// =========================================================================
exports.removePosition = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { pos_code, action } = req.body[0] || {};

        const missing = [];
        if (pos_code === undefined) missing.push('pos_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_position SET pos_flag = '0', rm_dt = $1::timestamp WHERE pos_code = $2;`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), pos_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลตำแหน่งสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลตำแหน่ง (Update Position Information)
// =========================================================================
exports.setPositionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { pos_code } = req.query || {};
        const { pos_desc, pos_salary, action } = req.body[0] || {};

        const missing = [];
        if (pos_code === undefined) missing.push('pos_code');
        if (pos_desc === undefined) missing.push('pos_desc');
        if (pos_salary === undefined) missing.push('pos_salary');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_position SET pos_desc = $1, pos_salary = $2, mdf_dt = $3::timestamp WHERE pos_code = $4;`;
        const params = [pos_desc, pos_salary, moment().format('YYYY-MM-DD HH:mm:ss'), pos_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลตำแหน่งเรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลตำแหน่ง (Add Position Information)
// =========================================================================
exports.addPositionInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { dep_code, pos_desc, pos_salary, action } = req.body[0] || {};

        const missing = [];
        if (dep_code === undefined) missing.push('dep_code');
        if (pos_desc === undefined) missing.push('pos_desc');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบข้อมูลซ้ำ
        const checkDupScript = `SELECT pos_code FROM tbl_position WHERE pos_desc = '${pos_desc}' AND pos_flag = '1' LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
            return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ');
        }

        const pos_code = 'pos-' + moment().format('x');
        const script = `INSERT INTO tbl_position (dep_code, pos_code, pos_desc, pos_salary, pos_flag, ist_dt) VALUES ($1, $2, $3, $4, '1', $5);`;
        const params = [dep_code, pos_code, pos_desc, pos_salary, moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'เพิ่มข้อมูลตำแหน่งเรียบร้อยแล้ว', [{ pos_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
