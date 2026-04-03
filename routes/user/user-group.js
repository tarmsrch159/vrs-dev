const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลกลุ่มผู้ใช้งาน (Get User Group Information)
// =========================================================================
exports.getGroupInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    let { group_code = "ALL", group_name = "ALL", action, page_index = 1, page_limit = 10 } = req.body[0] || {};

    // ตรวจสอบพารามิเตอร์ที่จำเป็น
    const missing = [];
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const offset = page_index > 0 ? page_index - 1 : 0;

    // สร้างเงื่อนไข WHERE
    const conditions = ["rm_dt IS NULL", "group_flag = 1"];

    if (String(group_code).toUpperCase() !== "ALL") conditions.push(`group_code = '${group_code}'`);
    if (String(group_name).toUpperCase() !== "ALL") conditions.push(`group_name LIKE '%${group_name}%'`);

    const whereClause = "WHERE " + conditions.join(" AND ");

    const dataScript = `
            SELECT
                group_code, group_name, mon, tue, wed, thu, fri, sat, sun,
                work_start_time, work_end_time, ist_dt
            FROM tbl_group
            ${whereClause}
            ORDER BY group_code ASC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

    const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

    if (tbl_temporary.code) {
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    if (tbl_temporary.data.length === 0) {
      return sendResponse(res, "success", "0", "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
    }

    const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'));

    const countScript = `
            SELECT
                COUNT(group_code) as rows_total,
                CEIL(COUNT(group_code)::float / ${page_limit}) as page_total
            FROM tbl_group
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
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "เกิดข้อผิดพลาดภายในระบบ", action[0].value);
    }
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API เพิ่มข้อมูลกลุ่มผู้ใช้งาน (Add User Group Information)
// =========================================================================
exports.addGroupInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const {
      group_name, mon = 1, tue = 1, wed = 1, thu = 1, fri = 1, sat = 0, sun = 0,
      work_start_time = null, work_end_time = null, action
    } = req.body[0] || {};

    const missing = [];
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    // เช็คข้อมูลซ้ำ
    const scriptCheck = `SELECT group_name FROM tbl_group WHERE group_name = '${group_name}' LIMIT 1;`;
    const tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());
    if (!tbl_check.code && tbl_check.data.length > 0) {
      return sendResponse(res, "error", "-2", `ไม่สามารถบันทึกข้อมูลได้, เนื่องจากชื่อกลุ่ม "${group_name}" มีอยู่ในระบบแล้ว`);
    }

    const groupCode = `GRP-` + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 1000);

    const script = `
            INSERT INTO tbl_group
            (
                group_code, group_name, mon, tue, wed, thu, fri, sat, sun,
                work_start_time, work_end_time, ist_dt, group_flag
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1);
        `;
    const params = [
      groupCode, group_name || "", mon, tue, wed, thu, fri, sat, sun,
      work_start_time, work_end_time, moment().format("YYYY-MM-DD HH:mm:ss")
    ];

    const result = await pgConn.execute2params(script, params);

    if (result.code) {
      await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "success", action[0].value);
    return sendResponse(res, "success", "0", "บันทึกข้อมูลสำเร็จ", [{ group_code: groupCode }]);

  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API แก้ไขข้อมูลกลุ่มผู้ใช้งาน (Update User Group Information)
// =========================================================================
exports.setGroupInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { group_code } = req.query || {};
    const {
      group_name, mon = 1, tue = 1, wed = 1, thu = 1, fri = 1, sat = 0, sun = 0,
      work_start_time = null, work_end_time = null, action
    } = req.body[0] || {};

    const missing = [];
    if (group_code === undefined) missing.push("group_code");
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถแก้ไขข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const script = `
            UPDATE tbl_group SET
                group_name = $1, mon = $2, tue = $3, wed = $4, thu = $5, fri = $6, sat = $7, sun = $8,
                work_start_time = $9, work_end_time = $10, mdf_dt = $11
            WHERE group_code = $12;
        `;
    const params = [
      group_name || "", mon, tue, wed, thu, fri, sat, sun,
      work_start_time, work_end_time, moment().format("YYYY-MM-DD HH:mm:ss"), group_code
    ];

    const result = await pgConn.execute2params(script, params);

    if (result.code) {
      await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "ไม่สามารถแก้ไขข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถแก้ไขข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "success", action[0].value);
    return sendResponse(res, "success", "0", "แก้ไขข้อมูลสำเร็จ");

  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};

// =========================================================================
// API ลบข้อมูลกลุ่มผู้ใช้งาน (Remove User Group)
// =========================================================================
exports.removeGroup = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { group_code, action } = req.body[0] || {};

    const missing = [];
    if (group_code === undefined) missing.push("group_code");
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(res, "error", "-1", `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`);
    }

    const group_codeArr = Array.isArray(group_code) ? group_code : [group_code];
    const placeholders = group_codeArr.map((_, i) => `$${i + 2}`).join(", ");
    const script = `UPDATE tbl_group SET group_flag = 0, rm_dt = $1::timestamp WHERE group_code IN (${placeholders});`;
    const params = [moment().format("YYYY-MM-DD HH:mm:ss"), ...group_codeArr];

    const result = await pgConn.execute2params(script, params);

    if (result.code) {
      await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ", action[0].value);
      return sendResponse(res, "error", "-3", "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ");
    }

    await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลกลุ่มผู้ใช้งาน", JSON.stringify(req.body[0]), "success", action[0].value);
    return sendResponse(res, "success", "0", "ลบข้อมูลกลุ่มผู้ใช้งานสำเร็จ");

  } catch (err) {
    console.error(err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};
