const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
// const moment = require('moment/tm3.1-typings/moment');
const moment = require('moment');

const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.getMasterTimeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { time_code, time_value, page_index, page_limit, action } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 0 : page_index;
        if (page_index < 0) {
            page_index = 0;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (time_code == undefined || time_value == undefined
            || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

            if (time_value != undefined && time_value.toString().toUpperCase() != 'ALL' && !timeFormatRegex.test(time_value.toString())) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'กรุณาใส่รูปแบบเวลาให้ถูกต้อง',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);

            }

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }


            if (time_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_master_time.id,
                tbl_master_time.time_code,
                tbl_master_time.time_value,
                tbl_master_time.ist_dt
                from tbl_master_time 
                where tbl_master_time.rm_dt IS NULL and tbl_master_time.time_code = '${time_code}' and tbl_master_time.master_time_flag = '1' `;
            }
            else {
                script = `select 
                tbl_master_time.id,
                tbl_master_time.time_code,
                tbl_master_time.time_value,
                tbl_master_time.ist_dt
                from tbl_master_time 
                where tbl_master_time.rm_dt IS NULL and tbl_master_time.master_time_flag = '1' `;
            }

            if (time_value != undefined && time_value.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_master_time.time_value = '${time_value}' `
            }

            script += ` order by tbl_master_time.ist_dt desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (time_code.toString().toUpperCase() != 'ALL') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_master_time 
                        where tbl_master_time.rm_dt IS NULL and tbl_master_time.time_code = '${time_code}'`;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_master_time 
                        where tbl_master_time.rm_dt IS NULL `;
                    }

                    if (time_value != undefined && time_value.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_master_time.time_value = '${time_value}' `
                    }

                    script += `) xtbl_master `


                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }


                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
                    }]

                    res.status(200).send(response);
                    return;
                } else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    return;
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    });
}


exports.addMasterTimeInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { time_data, action } = req.body[0];
        console.log('time_data', time_data);
        console.log('action', action);
        // เช็คเฉพาะส่วนที่สำคัญ
        if (time_data == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let script = ``;
        let invalid_time_data = []; // ตัวแปรสำหรับเก็บรายการที่ Format ผิด
        let success_count = 0;
        // Step 1: Insert tbl_master_time
        if (time_data && Array.isArray(time_data) && time_data.length > 0) {
            for (var i = 0; i <= time_data.length - 1; i++) {
                var time_code = time_data[i].time_code;
                var time_value = time_data[i].time_value;

                const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

                if (time_value && !timeFormatRegex.test(time_value)) {
                    invalid_time_data.push(time_data[i]);
                    continue;
                }

                script = `INSERT INTO public.tbl_master_time 
                (time_code, time_value, ist_dt, master_time_flag) 
                VALUES 
                ('${time_code}', '${time_value}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1')`;

                script = script.replace(/'NULL'/gi, "NULL");
                let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (tbl_temporary.code) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล Order, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }];
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล Order', action[0].value);
                    return;
                }
                success_count++;
            } // ปิด for loop

            let responseMessage = '';

            if (invalid_time_data.length > 0) {
                if (success_count === 0) {
                    // กรณีผิดหมดเลย ไม่มีอันไหนถูก Insert ได้เลย

                    responseMessage = 'ไม่สามารถบันทึกได้ รูปแบบเวลาไม่ถูกต้องทั้งหมด';
                } else {
                    // กรณีมีทั้งตัวที่ Insert ผ่าน และตัวที่ Format ผิด
                    responseMessage = `บันทึกข้อมูลสำเร็จ ${success_count} รายการ, รูปแบบเวลาไม่ถูกต้อง ${invalid_time_data.length} รายการ`;
                }
            } else {
                // กรณีผ่านหมดทุกตัว
                responseMessage = 'บันทึกข้อมูลสำเร็จทั้งหมด';
            }

            // Success response (ต้องอยู่นอก for loop เพื่อให้ loop ทำงานเสร็จก่อนค่อยส่ง response)
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: responseMessage,
                invalid_time_data: invalid_time_data,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
            return;

        } else {
            // กรณีไม่มี time_data ส่งมา
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'ไม่มีข้อมูลเวลาสำหรับบันทึก',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });
};

exports.setMasterTimeInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { id } = req.query;
        let { time_code, time_value, action } = req.body[0];
        // เช็คเฉพาะส่วนที่สำคัญ
        if (id == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let script = `UPDATE public.tbl_master_time 
        SET 
        time_code = '${time_code}',
        time_value = '${time_value}',
        mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
        WHERE id = ${id}`;

        let temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล Master Time ได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล Master Time', action[0].value);
            return;
        }


        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
        return;


    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });
}



//Success
exports.removeMasterTimeInformationById = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { master_time_id, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (master_time_id == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {
            let script = ``;
            // ดัก petrol_merge_job_id เป็น array
            let master_time_idArr = Array.isArray(master_time_id) ? master_time_id : [master_time_id];
            let master_time_idIn = master_time_idArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_master_time set master_time_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where id in (${master_time_idIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูล Master Time ได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
