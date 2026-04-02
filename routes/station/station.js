const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลรายการสถานที่ (Get Station Information)
// =========================================================================
exports.getStationInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { station_code, station_type, province, search = '', page_index = 1, page_limit = 10, action } = req.body[0] || {};

        // กำหนดค่าเริ่มต้น
        station_code = !station_code || String(station_code).trim() === '' ? 'ALL' : station_code;
        station_type = !station_type || String(station_type).trim() === '' ? 'ALL' : station_type;
        province = !province || String(province).trim() === '' ? 'ALL' : province;

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = ["tbl_station.rm_dt IS NULL"];
        if (String(station_code).toUpperCase() !== 'ALL') conditions.push(`tbl_station.station_code = '${station_code}'`);
        if (String(station_type).toUpperCase() !== 'ALL') conditions.push(`tbl_station.station_type_code = '${station_type}'`);
        if (String(province).toUpperCase() !== 'ALL') conditions.push(`tbl_station.province = '${province}'`);

        if (search !== '') {
            conditions.push(`(
                tbl_station.station_name LIKE '%${search}%' 
                OR tbl_station.station_code LIKE '%${search}%' 
                OR tbl_station.contact_fullname LIKE '%${search}%' 
                OR tbl_station.contact_phone LIKE '%${search}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        // Query สำหรับดึงข้อมูล Station
        const dataScript = `
            SELECT 
                tbl_station.station_id, tbl_station.station_code, tbl_station.station_name,
                tbl_station_type.name as station_type_name, tbl_station.station_address, 
                tbl_station.station_area, tbl_station.province, tbl_station.district, 
                tbl_station.sub_district, tbl_station.lat, tbl_station.lon, 
                tbl_station.day_of_delivery, tbl_station.start_time, tbl_station.end_time, 
                tbl_station.postcode, tbl_station.contact_fullname, tbl_station.contact_email, 
                tbl_station.contact_phone, tbl_station.remark, tbl_station.ist_dt, 
                tbl_station.mdf_dt, tbl_station.station_flag as flag
            FROM tbl_station
            LEFT JOIN tbl_station_type ON tbl_station.station_type_code = tbl_station_type.station_type_code
            ${whereClause}
            ORDER BY tbl_station.station_code ASC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรายการสถานที่', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        // แปลงค่า null ให้เป็น string ว่าง
        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        // นับจำนวนแถวทั้งหมด
        const countScript = `
            SELECT 
                CEIL(COUNT(station_id)::float / ${page_limit}) as page_total, 
                COUNT(station_id) as rows_total  
            FROM tbl_station ${whereClause};
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
        const lic_code = req.header('lic_code');
        const action = req.body?.[0]?.action;
        if (lic_code && action) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรายการสถานที่', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลสถานที่/จุดรับส่ง (Add Station Information)
// =========================================================================
exports.addStationInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            station_code, station_name, station_type, station_address, station_area,
            province, district, sub_district, postcode, lat, lon,
            day_of_delivery, start_time, end_time, contact_fullname,
            contact_email, contact_phone, remark, action
        } = req.body[0] || {};

        const missing = [];
        if (!station_code) missing.push('station_code');
        if (!station_name) missing.push('station_name');
        if (!action) missing.push('action');
        if (!lic_code) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // ตรวจสอบรหัสสถานที่ซ้ำ
        const checkDupScript = `SELECT 1 FROM tbl_station WHERE station_code = '${station_code}' AND rm_dt IS NULL LIMIT 1`;
        const checkDupResult = await pgConn.get(dbPrefix + lic_code, checkDupScript, config.connectionString());

        if (!checkDupResult.code && checkDupResult.data.length > 0) {
            return sendResponse(res, 'error', '-2', 'ไม่สามารถบันทึกข้อมูลได้ เนื่องจากรหัสสถานที่นี้มีอยู่ในระบบแล้ว');
        }

        const station_id = 'STN-' + moment().format('x') + Math.floor(Math.random() * 1000);

        const script = `
            INSERT INTO tbl_station (
                station_id, station_code, station_name, station_type_code, 
                station_address, station_area, province, district, sub_district,
                lat, lon, day_of_delivery, start_time, end_time, postcode,
                contact_fullname, contact_email, contact_phone, remark,
                ist_dt, station_flag, trash
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 1, false
            ) RETURNING station_id;
        `;

        const params = [
            station_id, station_code, station_name, station_type || null,
            station_address || null, station_area || null, province || null, district || null, sub_district || null,
            lat || null, lon || null, day_of_delivery || null, start_time || null, end_time || null, postcode || null,
            contact_fullname || null, contact_email || null, contact_phone || null, remark || null,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล: ${result.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', [{ station_id }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลสถานที่/จุดรับส่ง (Update Station Information)
// =========================================================================
exports.setStationInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { station_id } = req.query || {};
        const {
            station_code, station_name, station_type, station_address, station_area,
            province, district, sub_district, postcode, lat, lon,
            day_of_delivery, start_time, end_time, contact_fullname,
            contact_email, contact_phone, remark, action
        } = req.body[0] || {};

        const missing = [];
        if (!station_id) missing.push('station_id');
        if (!action) missing.push('action');
        if (!lic_code) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `
            UPDATE tbl_station SET
                station_code = $1, station_name = $2, station_type_code = $3, station_address = $4,
                station_area = $5, province = $6, district = $7, sub_district = $8, postcode = $9,
                lat = $10, lon = $11, day_of_delivery = $12, start_time = $13, end_time = $14,
                contact_fullname = $15, contact_email = $16, contact_phone = $17, remark = $18,
                mdf_dt = $19::timestamp
            WHERE station_id = $20 AND rm_dt IS NULL;
        `;
        const params = [
            station_code || null, station_name || null, station_type || null, station_address || null,
            station_area || null, province || null, district || null, sub_district || null, postcode || null,
            lat || null, lon || null, day_of_delivery || null, start_time || null, end_time || null,
            contact_fullname || null, contact_email || null, contact_phone || null, remark || null,
            moment().format('YYYY-MM-DD HH:mm:ss'), station_id
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล: ${result.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลสถานที่เรียบร้อยแล้ว', [{ station_id }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลสถานที่ (Remove/Soft Delete Station)
// =========================================================================
exports.removeStationInformationById = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { station_id, action } = req.body[0] || {};

        const missing = [];
        if (station_id === undefined) missing.push('station_id');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const station_idArr = Array.isArray(station_id) ? station_id : [station_id];
        const placeholders = station_idArr.map((_, i) => `$${i + 2}`).join(', ');

        const script = `UPDATE tbl_station SET station_flag = 0, rm_dt = $1::timestamp WHERE station_id IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...station_idArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสถานที่', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลสถานที่สำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
    }
};
