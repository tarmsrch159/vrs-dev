const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const bcrypt = require('bcrypt');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลผู้ใช้งานระบบ (Get User Information)
// =========================================================================
exports.getUserInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            user_code = 'ALL', user_name = 'ALL', name = 'ALL', email = 'ALL',
            mobile = 'ALL', id_card = 'ALL', action, page_index = 1, page_limit = 10
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
        const conditions = ["u.rm_dt IS NULL"];

        if (String(user_code).toUpperCase() !== 'ALL') conditions.push(`user_code = '${user_code}'`);
        if (String(user_name).toUpperCase() !== 'ALL') conditions.push(`user_name LIKE '%${user_name}%'`);
        if (String(name).toUpperCase() !== 'ALL') conditions.push(`name LIKE '%${name}%'`);
        if (String(email).toUpperCase() !== 'ALL') conditions.push(`email LIKE '%${email}%'`);
        if (String(mobile).toUpperCase() !== 'ALL') conditions.push(`mobile LIKE '%${mobile}%'`);
        if (String(id_card).toUpperCase() !== 'ALL') conditions.push(`id_card LIKE '%${id_card}%'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                u.user_code, u.user_name, u.emp_code, u.name, u.photo, u.email, u.mobile, u.gender,
                g.group_name, u.default_lang, u.ist_dt, u.customer_id, u.id_card, u.authority_code, authority.authority_name,
                ua.users_approver
            FROM tbl_users u
            LEFT JOIN tbl_group g ON u.user_group_code = g.group_code
            LEFT JOIN (
                SELECT 
                    tbl_user_approver.user_code, 
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'code', tbl_user_approver.user_approver_code,
                            'name', users.name
                        )
                    ) as users_approver
                FROM tbl_user_approver
                LEFT JOIN tbl_users users ON tbl_user_approver.user_approver_code = users.user_code
                WHERE tbl_user_approver.rm_dt IS NULL
                GROUP BY tbl_user_approver.user_code
            ) ua ON u.user_code = ua.user_code
            LEFT JOIN tbl_authority authority ON u.authority_code = authority.authority_code
            ${whereClause}
            ORDER BY u.ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (tbl_temporary.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        if (tbl_temporary.data.length === 0) {
            return sendResponse(res, 'success', '0', 'ไม่พบข้อมูล', [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        const countScript = `
            SELECT 
                COUNT(user_code) as rows_total,
                CEIL(COUNT(user_code)::float / ${page_limit}) as page_total
            FROM tbl_users u
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'เกิดข้อผิดพลาดภายในระบบ', action[0].value);
        }
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API ลบข้อมูลผู้ใช้งานระบบ (Remove User)
// =========================================================================
exports.removeUser = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code, action } = req.body[0] || {};

        const missing = [];
        if (user_code === undefined) missing.push('user_code');
        if (lic_code === undefined) missing.push('lic_code');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const user_codeArr = Array.isArray(user_code) ? user_code : [user_code];
        const placeholders = user_codeArr.map((_, i) => `$${i + 2}`).join(', ');
        const script = `UPDATE tbl_users SET user_flag = 0, rm_dt = $1::timestamp WHERE user_code IN (${placeholders});`;
        const params = [moment().format('YYYY-MM-DD HH:mm:ss'), ...user_codeArr];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลผู้ใช้งานระบบสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขข้อมูลผู้ใช้งานระบบ (Update User Information)
// =========================================================================
exports.setUserInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code } = req.query || {};
        const {
            user_name, emp_code = '', name = '', photo = '', email = '', mobile = '',
            gender = '', team_id = null, default_lang = 'th', customer_id = null,
            id_card = '', authority_code = '', action
        } = req.body[0] || {};

        const missing = [];
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');
        if (user_code === undefined) missing.push('user_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // เช็คข้อมูลซ้ำจาก user_name
        const scriptCheck = `SELECT user_name FROM tbl_users WHERE user_name = '${user_name}' AND user_code != '${user_code}' AND rm_dt IS NULL LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), `ชื่อผู้ใช้งานซ้ำ (${user_name})`, action[0].value);
            return sendResponse(res, 'error', '-1', `ชื่อผู้ใช้งาน '${user_name}' มีอยู่ในระบบแล้ว`);
        }

        // เช็คข้อมูลซ้ำจาก id_card
        if (id_card) {
            const scriptCheckIdCard = `SELECT id_card FROM tbl_users WHERE id_card = '${id_card}' AND user_code != '${user_code}' AND rm_dt IS NULL LIMIT 1;`;
            const tbl_checkIdCard = await pgConn.get(dbPrefix + lic_code, scriptCheckIdCard, config.connectionString());
            if (!tbl_checkIdCard.code && tbl_checkIdCard.data.length > 0) {
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), `เลขบัตรประชาชนซ้ำ (${id_card})`, action[0].value);
                return sendResponse(res, 'error', '-1', `เลขบัตรประชาชน '${id_card}' มีอยู่ในระบบแล้ว`);
            }
        }

        const script = `
            UPDATE tbl_users SET
                user_name = $1, emp_code = $2, name = $3, photo = $4, email = $5, mobile = $6,
                gender = $7, user_group_code = $8, default_lang = $9, customer_id = $10,
                id_card = $11, authority_code = $12, mdf_dt = $13::timestamp
            WHERE user_code = $14;
        `;
        const params = [
            user_name, emp_code, name, photo, email, mobile,
            gender, team_id, default_lang, customer_id,
            id_card, authority_code, moment().format('YYYY-MM-DD HH:mm:ss'), user_code
        ];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API แก้ไขรหัสผ่านผู้ใช้งานระบบ (Update User Password)
// =========================================================================
exports.setUserPasswordInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code } = req.query || {};
        const { old_password, new_password, action } = req.body[0] || {};

        const missing = [];
        if (user_code === undefined) missing.push('user_code');
        if (old_password === undefined) missing.push('old_password');
        if (new_password === undefined) missing.push('new_password');
        if (action === undefined) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const user_old_password = `SELECT user_password FROM tbl_users WHERE user_code = '${user_code}';`;
        const tbl_check_old_password = await pgConn.get(dbPrefix + lic_code, user_old_password, config.connectionString());

        if (!tbl_check_old_password || !tbl_check_old_password.data || tbl_check_old_password.data.length === 0) {
            return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลผู้ใช้งานในระบบ');
        }

        const current_hash = tbl_check_old_password.data[0].user_password;
        const is_password_match = bcrypt.compareSync(old_password, current_hash);

        if (!is_password_match) {
            return sendResponse(res, 'error', '-3', 'รหัสผ่านเดิมไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        }

        const new_password_encode = bcrypt.hashSync(new_password, 10);
        const script = `UPDATE tbl_users SET user_password = $1, mdf_dt = $2::timestamp WHERE user_code = $3;`;
        const params = [new_password_encode, moment().format('YYYY-MM-DD HH:mm:ss'), user_code];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านผู้ใช้งานระบบ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขรหัสผ่านสำเร็จ');

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API เพิ่มข้อมูลผู้ใช้งานระบบ (Add User Information)
// =========================================================================
exports.addUserInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            user_name, user_password, emp_code = '', name = '', photo = '', email = '', mobile = '',
            gender = '', team_id = null, default_lang = 'th', customer_id = null,
            id_card = '', authority_code = '', users_approver = [], action
        } = req.body[0] || {};

        const missing = [];
        if (user_name === undefined) missing.push('user_name');
        if (user_password === undefined) missing.push('user_password');
        if (action === undefined) missing.push('action');
        if (lic_code === undefined) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        // เช็คข้อมูลซ้ำจาก user_name
        const scriptCheck = `SELECT user_name FROM tbl_users WHERE user_name = '${user_name}' AND rm_dt IS NULL LIMIT 1;`;
        const tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), `ชื่อผู้ใช้งานซ้ำ (${user_name})`, action[0].value);
            return sendResponse(res, 'error', '-1', `ชื่อผู้ใช้งาน '${user_name}' มีอยู่ในระบบแล้ว`);
        }

        // เช็คข้อมูลซ้ำจาก id_card
        if (id_card) {
            const scriptCheckIdCard = `SELECT id_card FROM tbl_users WHERE id_card = '${id_card}' AND rm_dt IS NULL LIMIT 1;`;
            const tbl_checkIdCard = await pgConn.get(dbPrefix + lic_code, scriptCheckIdCard, config.connectionString());
            if (!tbl_checkIdCard.code && tbl_checkIdCard.data.length > 0) {
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), `เลขบัตรประชาชนซ้ำ (${id_card})`, action[0].value);
                return sendResponse(res, 'error', '-1', `เลขบัตรประชาชน '${id_card}' มีอยู่ในระบบแล้ว`);
            }
        }

        let transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {
            const user_code = 'USER-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
            const user_encode = bcrypt.hashSync(user_password, 10);

            const script = `
            INSERT INTO tbl_users 
            (
                user_code, user_name, user_password, user_authority, emp_code, name, photo, email, mobile, gender, 
                user_group_code, default_lang, ist_dt, customer_id, id_card, authority_code, user_flag
            ) 
            VALUES ($1, $2, $3, null, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamp, $13, $14, $15, 1);
        `;
            const params = [
                user_code, user_name, user_encode, emp_code, name, photo, email, mobile, gender,
                team_id, default_lang, moment().format('YYYY-MM-DD HH:mm:ss'), customer_id, id_card, authority_code
            ];

            const result = await pgConn.executeWithClient(client, script, params);
            if (result.code) throw new Error("ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้");

            if (Array.isArray(users_approver) && users_approver.length > 0) {
                for (const approver_code of users_approver) {
                    let usr_apr_code = 'USERAPR-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
                    const scriptDriver = `INSERT INTO tbl_user_approver (usr_apr_code, user_code, user_approver_code, ist_dt, approve_flag) VALUES ($1, $2, $3, $4, $5);`;
                    const paramsDriver = [usr_apr_code, user_code, approver_code, moment().format('YYYY-MM-DD HH:mm:ss'), 1];
                    const resDriver = await pgConn.executeWithClient(client, scriptDriver, paramsDriver);
                    if (resDriver.code) throw new Error("ไม่สามารถบันทึกข้อมูลพนักงานขับรถประจำได้");
                }
            }

        }, config.connectionString());

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลผู้ใช้งานระบบ', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [transactionResult.data]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};