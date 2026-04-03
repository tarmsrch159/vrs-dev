const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;
const crypto = require('crypto');
const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูล Blackbox (Get Blackbox Information)
// =========================================================================
exports.getBlackboxInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { blackbox_code, action, page_index = 1, page_limit = 10 } = req.body[0] || {};

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
            "tbl_blackbox.blackbox_flag = 1",
            "tbl_blackbox.rm_dt IS NULL"
        ];

        if (blackbox_code && String(blackbox_code).toUpperCase() !== 'ALL') {
            conditions.push(`tbl_blackbox.blackbox_code = '${blackbox_code}'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                blackbox_code, remark, blackbox_flag, ist_dt, mdf_dt, rm_dt
            FROM tbl_blackbox
            ${whereClause}
            ORDER BY ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Blackbox', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                COUNT(*) as rows_total,
                CEIL(COUNT(*)::float / ${page_limit}) as page_total
            FROM tbl_blackbox
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Blackbox', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูล Blackbox (Remove/Soft Delete Blackbox)
// =========================================================================
exports.removeBlackbox = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { blackbox_code, action } = req.body[0] || {};

        const missing = [];
        if (blackbox_code === undefined) missing.push('blackbox_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const blackbox_codeArr = Array.isArray(blackbox_code) ? blackbox_code : [blackbox_code];
        const blackbox_codeIn = blackbox_codeArr.map(c => `'${c}'`).join(', ');

        const script = `UPDATE tbl_blackbox SET blackbox_flag = 0, rm_dt = $1::timestamp WHERE blackbox_code IN (${blackbox_codeIn});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Blackbox', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Blackbox', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูล Blackbox สำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูล Blackbox (Update Blackbox Information)
// =========================================================================
exports.setBlackboxInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { blackbox_code } = req.query || {};
        const { remark, action } = req.body[0] || {};

        const missing = [];
        if (blackbox_code === undefined) missing.push('blackbox_code');
        if (remark === undefined) missing.push('remark');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `UPDATE tbl_blackbox SET remark = $1, mdf_dt = $2::timestamp WHERE blackbox_code = $3;`;
        const params = [remark, moment().format('YYYY-MM-DD HH:mm:ss'), blackbox_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Blackbox', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Blackbox', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูล Blackbox เรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูล Blackbox (Add Blackbox Information)
// =========================================================================
exports.addBlackboxInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { remark, action } = req.body[0] || {};

        const missing = [];
        if (remark === undefined) missing.push('remark');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        let transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {
            const blackbox_code = crypto.randomBytes(25).toString('hex');

            const script = `INSERT INTO tbl_blackbox (blackbox_code, remark, blackbox_flag, ist_dt) VALUES ($1, $2, 1, $3);`;
            const params = [blackbox_code, remark, moment().format('YYYY-MM-DD HH:mm:ss')];

            const result = await pgConn.executeWithClient(client, script, params);

            if (result.code) {
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Blackbox', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
            }

            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Blackbox', JSON.stringify(req.body[0]), 'success', action[0].value);
            return sendResponse(res, 'success', '0', 'เพิ่มข้อมูล Blackbox เรียบร้อยแล้ว', [{ blackbox_code: blackbox_code }]);
        }, config.connectionString());


        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลการจอง', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลการจอง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลการจองสำเร็จ', [transactionResult.data]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

