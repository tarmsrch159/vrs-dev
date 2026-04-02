const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลประเภทสถานที่ (Get Station Type Information)
// =========================================================================
exports.getStationTypeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { station_type_code, station_type_name, search = '', page_index = 1, page_limit = 10, action } = req.body[0] || {};

        // กำหนดค่าเริ่มต้น
        station_type_code = !station_type_code || String(station_type_code).trim() === '' ? 'ALL' : station_type_code;
        station_type_name = !station_type_name || String(station_type_name).trim() === '' ? 'ALL' : station_type_name;

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = ["tbl_station_type.rm_dt IS NULL"];
        if (String(station_type_code).toUpperCase() !== 'ALL') conditions.push(`tbl_station_type.station_type_code = '${station_type_code}'`);
        if (String(station_type_name).toUpperCase() !== 'ALL') conditions.push(`tbl_station_type.name = '${station_type_name}'`);

        if (search && search !== '') {
            conditions.push(`(
                tbl_station_type.name LIKE '%${search}%' 
                OR tbl_station_type.name_sub LIKE '%${search}%'
                OR tbl_station_type.station_type_code LIKE '%${search}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        // SQL สำหรับดึงข้อมูล Station Type
        const dataScript = `
            SELECT 
                station_type_code, name, name_sub, create_by, modified_by, 
                ist_dt, mdf_dt, station_type_flag as flag
            FROM tbl_station_type
            ${whereClause}
            ORDER BY tbl_station_type.station_type_code ASC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            return sendResponse(res, 'error', '-3', `ไม่สามารถดึงข้อมูล, ${tbl_temporary.message}`);
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 1, rows_total: 0 });
        }

        // แปลงค่า null ให้เป็น string ว่าง
        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                CEIL(COUNT(station_type_code)::float / ${page_limit}) as page_total, 
                COUNT(station_type_code) as rows_total  
            FROM tbl_station_type ${whereClause};
        `;
        const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

        let page_total = 1, rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            page_total = Math.max(1, parseInt(tbl_temporary_count.data[0].page_total));
        }

        return sendResponse(res, 'success', '0', '', data, { page_total, rows_total });

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', `เกิดข้อผิดพลาดภายในระบบ: ${err.message}`);
    }
};

// =========================================================================
// API เพิ่มข้อมูลประเภทสถานที่ (Add Station Type Information)
// =========================================================================
exports.addStationTypeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { station_type_name, action } = req.body[0] || {};

        const missing = [];
        if (!station_type_name) missing.push('station_type_name');
        if (!action) missing.push('action');
        if (!lic_code) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบชื่อประเภทสถานทีซ้ำ
        const checkDupScript = `SELECT 1 FROM tbl_station_type WHERE name = '${station_type_name}' AND rm_dt IS NULL LIMIT 1`;
        const checkDupResult = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());

        if (!checkDupResult.code && checkDupResult.data.length > 0) {
            return sendResponse(res, 'error', '-2', 'ไม่สามารถบันทึกข้อมูลได้ เนื่องจากชื่อประเภทสถานทีนี้มีอยู่ในระบบแล้ว');
        }

        const station_type_code = 'STT-' + moment().format('x') + Math.floor(Math.random() * 1000);

        const script = `
            INSERT INTO tbl_station_type (station_type_code, name, ist_dt, station_type_flag) 
            VALUES ($1, $2, $3, 1) RETURNING station_type_code;
        `;
        const params = [station_type_code, station_type_name, moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล: ${result.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', [{ station_type_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลประเภทสถานที่ (Update Station Type Information)
// =========================================================================
exports.setStationTypeInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { station_type_code } = req.query || {};
        const { station_type_name, action } = req.body[0] || {};

        const missing = [];
        if (!station_type_code) missing.push('station_type_code');
        if (!station_type_name) missing.push('station_type_name');
        if (!action) missing.push('action');
        if (!lic_code) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `
            UPDATE tbl_station_type SET 
                name = $1, modified_by = $2, mdf_dt = $3::timestamp
            WHERE station_type_code = $4 AND station_type_flag = 1;
        `;
        const params = [station_type_name, action[0].id, moment().format('YYYY-MM-DD HH:mm:ss'), station_type_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล: ${result.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลประเภทสถานที่เรียบร้อยแล้ว', [{ station_type_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', `ไม่สามารถบันทึกข้อมูล, เนื่องจากเกิดข้อผิดพลาดภายในระบบ`);
    }
};

// =========================================================================
// API ลบข้อมูลประเภทสถานที่ (Remove/Soft Delete Station Type)
// =========================================================================
exports.removeStationTypeInformationById = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { station_type_code, action } = req.body[0] || {};

        const missing = [];
        if (station_type_code === undefined) missing.push('station_type_code');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const station_type_codeArr = Array.isArray(station_type_code) ? station_type_code : [station_type_code];
        const placeholders = station_type_codeArr.map((_, i) => `$${i + 2}`).join(', ');

        const script = `UPDATE tbl_station_type SET station_type_flag = 0, rm_dt = $1::timestamp WHERE station_type_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...station_type_codeArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลประเภทสถานที่เรียบร้อยแล้ว');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
