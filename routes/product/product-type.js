const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const crypto = require("crypto");
const xglobal = require("../../middleware/global");
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลประเภทสินค้า (Get Product Type Information)
// =========================================================================
exports.getProductTypeInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    let { product_type_id = "ALL", product_type_code = "ALL", product_type_name = "ALL", action, page_index = 1, page_limit = 10 } = req.body[0] || {};

    // ตรวจสอบพารามิเตอร์ที่จำเป็น
    const missing = [];
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const offset = page_index > 0 ? page_index - 1 : 0;

    // สร้างเงื่อนไข WHERE
    const conditions = ["rm_dt IS NULL", "product_type_flag = 1"];

    if (String(product_type_id).toUpperCase() !== "ALL") conditions.push(`product_type_id = '${product_type_id}'`);
    if (String(product_type_code).toUpperCase() !== "ALL") conditions.push(`product_type_code = '${product_type_code}'`);
    if (String(product_type_name).toUpperCase() !== "ALL") conditions.push(`product_type_name = '${product_type_name}'`);

    const whereClause = "WHERE " + conditions.join(" AND ");

    const dataScript = `
            SELECT
                product_type_id, product_type_code, product_type_name, product_type_flag, ist_dt, mdf_dt
            FROM tbl_product_type
            ${whereClause}
            ORDER BY product_type_code ASC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

    const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

    if (tbl_temporary.code) {
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    if (tbl_temporary.data.length === 0) {
      return sendResponse(res, "success", "0", "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
    }

    const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'));

    const countScript = `
            SELECT
                COUNT(product_type_id) as rows_total,
                CEIL(COUNT(product_type_id)::float / ${page_limit}) as page_total
            FROM tbl_product_type
            ${whereClause};
        `;
    const tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

    let page_total = 1, rows_total = 0;
    if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
      rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
      page_total = parseInt(tbl_temporary_count.data[0].page_total);
    }

    return sendResponse(res, "success", "0", "", data, { page_total: page_total <= 0 ? 1 : page_total, rows_total });

  } catch (err) {
    console.error(err);
    const lic_code = req.header("lic_code");
    const action = req.body?.[0]?.action;
    if (lic_code && action) {
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "เกิดข้อผิดพลาดภายในระบบ", action[0].value);
    }
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API เพิ่มข้อมูลประเภทสินค้า (Add Product Type Information)
// =========================================================================
exports.addProductTypeInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { product_type_code, product_type_name, action } = req.body[0] || {};

    const missing = [];
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    // เช็คข้อมูลซ้ำ
    const scriptCheck = `SELECT product_type_name, product_type_code FROM tbl_product_type WHERE product_type_name = '${product_type_name}' OR product_type_code = '${product_type_code}' AND rm_dt IS NULL LIMIT 1;`;
    const tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());
    if (!tbl_check.code && tbl_check.data.length > 0) {
      return sendResponse(res, "error", "-2", `ไม่สามารถบันทึกข้อมูลได้, เนื่องจากชื่อประเภทสินค้า "${product_type_name}" หรือรหัสประเภทสินค้า "${product_type_code}" มีอยู่ในระบบแล้ว`);
    }

    const product_type_id = `PRODT-` + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 10000);

    const script = `
                INSERT INTO tbl_product_type
                (product_type_id, product_type_code, product_type_name, ist_dt, product_type_flag)
                VALUES ($1, $2, $3, $4, 1);
            `;
    const params = [product_type_id, product_type_code || "", product_type_name || "", moment().format("YYYY-MM-DD HH:mm:ss")];
    const result = await pgConn.execute2params(script, params, config.connectionString());
    console.log(result)

    if (result.code) {
      return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล: ${result.message}`);
    }

    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
    return sendResponse(res, 'success', '0', 'บันทึกข้อมูลประเภทสินค้าเรียบร้อยแล้ว', [{ product_type_id }]);


  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API แก้ไขข้อมูลประเภทสินค้า (Update Product Type Information)
// =========================================================================
exports.setProductTypeInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { product_type_id } = req.query || {};
    const { product_type_code, product_type_name, action } = req.body[0] || {};

    const missing = [];
    if (product_type_id === undefined) missing.push("product_type_id");
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถแก้ไขข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const script = `
            UPDATE tbl_product_type SET
                product_type_code = $1, product_type_name = $2, mdf_dt = $3
            WHERE product_type_id = $4;
        `;
    const params = [product_type_code || "", product_type_name || "", moment().format("YYYY-MM-DD HH:mm:ss"), product_type_id];

    const result = await pgConn.execute2params(script, params);

    if (result.code) {
      await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "ไม่สามารถแก้ไขข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถแก้ไขข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "success", action[0].value);
    return sendResponse(res, "success", "0", "แก้ไขข้อมูลสำเร็จ");

  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API ลบข้อมูลประเภทสินค้า (Remove Product Type)
// =========================================================================
exports.removeProductType = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { product_type_id, action } = req.body[0] || {};

    const missing = [];
    if (product_type_id === undefined) missing.push("product_type_id");
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const product_type_idArr = Array.isArray(product_type_id) ? product_type_id : [product_type_id];
    const placeholders = product_type_idArr.map((_, i) => `$${i + 2}`).join(", ");
    const script = `UPDATE tbl_product_type SET product_type_flag = 0, rm_dt = $1::timestamp WHERE product_type_id IN (${placeholders});`;
    const params = [moment().format("YYYY-MM-DD HH:mm:ss"), ...product_type_idArr];

    const result = await pgConn.execute2params(script, params);

    if (result.code) {
      await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลประเภทสินค้า", JSON.stringify(req.body[0]), "success", action[0].value);
    return sendResponse(res, "success", "0", "ลบข้อมูลสำเร็จ");

  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

