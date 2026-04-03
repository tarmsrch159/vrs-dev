const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const crypto = require('crypto');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลสินค้า (Get Product Information)
// =========================================================================
exports.getProductInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            product_code = 'ALL', product_name = 'ALL', product_type_id = 'ALL',
            action, page_index = 1, page_limit = 10
        } = req.body[0] || {};

        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const offset = page_index > 0 ? page_index - 1 : 0;

        // สร้างเงื่อนไข WHERE
        const conditions = ["p.rm_dt IS NULL", "p.product_flag = 1"];

        if (String(product_code).toUpperCase() !== 'ALL') conditions.push(`p.product_code = '${product_code}'`);
        if (String(product_name).toUpperCase() !== 'ALL') conditions.push(`p.product_name LIKE '%${product_name}%'`);
        if (String(product_type_id).toUpperCase() !== 'ALL') conditions.push(`p.product_type_id = '${product_type_id}'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                p.product_id, p.product_code, p.product_name, p.product_price, p.product_pic, 
                p.product_type_id, pt.product_type_name,
                p.product_weight, p.product_width, p.product_length, p.product_height, p.product_volume,
                p.ist_dt, p.product_flag
            FROM tbl_products p
            LEFT JOIN tbl_product_type pt ON p.product_type_id = pt.product_type_id
            ${whereClause}
            ORDER BY p.ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        const countScript = `
            SELECT 
                COUNT(product_id) as rows_total,
                CEIL(COUNT(product_id)::float / ${page_limit}) as page_total
            FROM tbl_products p
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้า', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลสินค้า (Remove Product)
// =========================================================================
exports.removeProduct = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { product_id, action } = req.body[0] || {};

        const missing = [];
        if (product_id === undefined) missing.push('product_id');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const product_idArr = Array.isArray(product_id) ? product_id : [product_id];
        const placeholders = product_idArr.map((_, i) => `$${i + 2}`).join(', ');
        const script = `UPDATE tbl_products SET product_flag = 0, rm_dt = $1::timestamp WHERE product_id IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...product_idArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลสินค้าสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลสินค้า (Update Product Information)
// =========================================================================
exports.setProductInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { product_id } = req.query || {};
        const {
            product_code, product_name, product_price = 0, product_pic = '',
            product_type_id = null, product_weight = 0, product_width = 0,
            product_length = 0, product_height = 0, product_volume = 0, action
        } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (product_id === undefined) missing.push('product_id');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `
            UPDATE tbl_products SET
                product_code = $1, product_name = $2, product_price = $3, product_pic = $4,
                product_type_id = $5, product_weight = $6, product_width = $7,
                product_length = $8, product_height = $9, product_volume = $10,
                mdf_dt = $11::timestamp
            WHERE product_id = $12;
        `;
        const params = [
            product_code, product_name, product_price, product_pic,
            product_type_id, product_weight, product_width,
            product_length, product_height, product_volume,
            moment().format('YYYY-MM-DD HH:mm:ss'), product_id
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลสินค้า (Add Product Information)
// =========================================================================
exports.addProductInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            product_code, product_name, product_price = 0, product_pic = '',
            product_type_id = null, product_weight = 0, product_width = 0,
            product_length = 0, product_height = 0, product_volume = 0, action
        } = req.body[0] || {};

        const missing = [];
        if (product_code === undefined) missing.push('product_code');
        if (product_name === undefined) missing.push('product_name');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // เช็คข้อมูลซ้ำ
        const scriptCheck = `SELECT product_name, product_code FROM tbl_products WHERE product_name = '${product_name}' OR product_code = '${product_code}' AND rm_dt IS NULL LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            return sendResponse(res, "error", "-2", `ไม่สามารถบันทึกข้อมูลได้, เนื่องจากชื่อสินค้า "${product_name}" หรือรหัสสินค้า "${product_code}" มีอยู่ในระบบแล้ว`);
        }

        let transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {
            const product_id = `PROD-` + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 10000);

            const script = `
                INSERT INTO tbl_products 
                (
                    product_id, product_code, product_name, product_price, product_pic, 
                    product_type_id, product_weight, product_width, product_length, 
                    product_height, product_volume,ist_dt, product_flag
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamp, 1);
            `;
            const params = [
                product_id, product_code, product_name, product_price, product_pic,
                product_type_id, product_weight, product_width, product_length,
                product_height, product_volume, moment().format('YYYY-MM-DD HH:mm:ss')
            ];

            const result = await pgConn.executeWithClient(client, script, params);
            return { product_id };
        }, config.connectionString());

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [transactionResult.data]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};