const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');
const bcrypt = require('bcrypt');
const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.authUserInformation = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { user_name, user_password } = req.body[0];
        console.log(lic_code)
        // ตรวจสอบพารามิเตอร์ที่จำเป็น
        const missing = [];
        if (lic_code === undefined) missing.push('lic_code');
        if (user_name === undefined) missing.push('user_name');
        if (user_password === undefined) missing.push('user_password');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถเข้าสู่ระบบได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        let script = ``;
        if (user_name != '' && user_password != '') {
            script = `SELECT 
                    u.user_password, 
                    u.user_code, 
                    u.user_name, 
                    u.name, 
                    u.mobile, 
                    u.email, 
                    u.user_group_code, 
                    g.group_name, 
                    u.gender, 
                    u.authority_code, 
                    authority.authority_name, 
                    u.photo
                    FROM tbl_users u
                    LEFT JOIN tbl_group g ON u.user_group_code = g.group_code
                    LEFT JOIN tbl_authority authority ON u.authority_code = authority.authority_code
                    WHERE u.user_flag = '1' AND u.rm_dt IS NULL AND u.user_name = '${user_name}'`;

            script += ` order by u.name asc;`
        }
        else {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                let userRecord = tbl_temporary.data[0];

                // 2. ใช้ bcrypt.compare เพื่อตรวจสอบรหัสผ่าน
                let isPasswordMatch = await bcrypt.compare(user_password, userRecord.user_password);

                if (isPasswordMatch) {
                    // รหัสผ่านถูกต้อง
                    delete userRecord.user_password; // ลบรหัสผ่านออกจาก object ก่อนส่งกลับเพื่อความปลอดภัย

                    tbl_temporary.data = JSON.parse(JSON.stringify([userRecord]).replace(/\:null/gi, "\:\"\""));

                    xglobal.sendResponse(res, 'success', '0', '', tbl_temporary.data);
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].user_code, 'เข้าสู่ระบบ', JSON.stringify({ user_name: user_name }), 'success', tbl_temporary.data[0].off_code);
                    return;
                } else {
                    // รหัสผ่านไม่ถูกต้อง (จำลองเสมือนหาข้อมูลไม่เจอ เพื่อป้องกันการเดา User)
                    xglobal.sendResponse(res, 'success', '0', 'success', "รหัสผ่านไม่ถูกต้อง");
                    return;
                }
            } else {
                xglobal.sendResponse(res, 'success', '0', 'success', "ไม่พบผู้ใช้งาน");
                return;
            }
        } else {

            xglobal.sendResponse(res, 'error', '-3', 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ', xresult);
            await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify({ user_name: user_name }), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
            return;
        }
    })().catch(async (err) => {
        console.error('authUserInformation Error:', err);
        if (!res.headersSent) {
            xglobal.sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', xresult);
        }
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify({ user_name: req.body[0]?.user_name }), 'เกิดข้อผิดพลาดภายในระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.resetEmployeeInformation = async (req, res, next) => {

    return (async () => {

        debugger
        let lic_code = req.header('lic_code');
        let { emp_username, emp_email, emp_userpassword } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        let missing = [];
        if (emp_username == undefined) missing.push('emp_username');
        if (emp_email == undefined) missing.push('emp_email');
        if (emp_userpassword == undefined) missing.push('emp_userpassword');

        if (missing.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ไม่สามารถคืนค่ารหัสผ่านได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (emp_username != '' && emp_email != '' && emp_userpassword != '') {
                script = `SELECT 
                    u.user_code as emp_code, 
                    u.user_name as emp_username, 
                    u.user_password as emp_userpassword, 
                    e.emp_ref_code, 
                    u.name as emp_name, 
                    e.emp_surname, 
                    u.mobile as emp_mobile_number,
                    u.email as emp_email, 
                    e.emp_div_code, 
                    div_desc as emp_div_desc, 
                    e.emp_dep_code, 
                    dep_desc as emp_dep_desc, 
                    e.emp_pos_code, 
                    pos_desc as emp_pos_desc, 
                    u.user_group_code as emp_group_code, 
                    g.group_name as emp_group_desc, 
                    u.gender as emp_gender, 
                    u.authority_code as emp_role_code, 
                    authority.authority_name as emp_role_desc, 
                    u.photo as emp_image_profile, 
                    e.off_code, 
                    tbl_office.off_desc
    
                FROM tbl_users u
                LEFT JOIN tbl_employee e ON u.emp_code = e.emp_code
                LEFT JOIN tbl_division on e.emp_div_code = tbl_division.div_code
                LEFT JOIN tbl_department on e.emp_div_code = tbl_department.div_code
                and e.emp_dep_code = tbl_department.dep_code
                LEFT JOIN tbl_position on e.emp_div_code = tbl_position.div_code
                and e.emp_dep_code = tbl_position.dep_code
                and e.emp_pos_code = tbl_position.pos_code
                LEFT JOIN tbl_group g on u.user_group_code = g.group_code
                LEFT JOIN tbl_authority authority on u.authority_code = authority.authority_code
                LEFT JOIN tbl_office on e.off_code = tbl_office.off_code 
                WHERE u.user_flag = '1' and u.rm_dt is null and u.user_name = '${emp_username}' and u.email = '${emp_email}'`;

                script += ` order by u.name asc;`

                let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                if (!tbl_temporary.code) {
                    //debugger
                    if (tbl_temporary.data.length > 0) {
                        tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                        const new_password_encode = bcrypt.hashSync(emp_userpassword, 10);
                        script = `update tbl_users set 
                        user_password = '${new_password_encode}',
                        mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                        where user_code = '${tbl_temporary.data[0].emp_code}';`

                        let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary0.code) {
                            //debugger
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
                            return;
                        } else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-3',
                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]
                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                            return;
                        }

                    } else {
                        let response = [{
                            status: 'error',
                            invalid_code: '-3',
                            message: `ไม่สามารถเข้าสู่ระบบ, ข้อมูลไม่ถูกต้อง`,
                            data: xresult,
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, '', 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, ข้อมูลไม่ถูกต้อง', '');
                        return;
                    }
                } else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, '', 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
                    return;
                }
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    });

}
