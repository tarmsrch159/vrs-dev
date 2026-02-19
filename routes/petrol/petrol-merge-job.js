const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolMergeJobInformation = async (req, res, next) => {

    var xresult = [{
        ptrl_merge_job_code: "",
        ptrl_code: "",
        ptrl_number: "",
        ptrl_desc: "",
        ptrl_short_desc: "",
        ptrl_group_code: "",
        ptrl_group_desc: "",
        ptrl_merge_code: "",
        ptrl_merge_number: "",
        ptrl_merge_desc: "",
        ptrl_merge_short_desc: "",
        off_code: "",
        off_desc: "",
        ist_dt: "",
        mdf_dt: "",
        rm_dt: ""
    }];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_code, ptrl_merge_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || ptrl_merge_code == undefined || lic_code == undefined || action == undefined) {
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

            let script = ``;
            if (ptrl_merge_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_petrol_merge_job.ptrl_merge_job_code,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_petrol.ptrl_number,
                tbl_petrol.ptrl_desc,
                tbl_petrol.ptrl_short_desc,
                tbl_petrol_group.ptrl_group_code,
                tbl_petrol_group.ptrl_group_desc,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_merge_petrol.ptrl_number as ptrl_merge_number,
                tbl_merge_petrol.ptrl_desc as ptrl_merge_desc,
                tbl_merge_petrol.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol.off_code,
                tbl_office.off_desc,
                tbl_petrol_merge_job.item_code,
                tbl_item.item_desc,
                tbl_item.item_short_desc,
                tbl_petrol_merge_job.ist_dt,
                tbl_petrol_merge_job.mdf_dt,
                tbl_petrol_merge_job.rm_dt 

                from tbl_petrol_merge_job
                left join tbl_petrol on tbl_petrol_merge_job.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                left join tbl_petrol tbl_merge_petrol on tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_petrol.ptrl_code
                left join tbl_item on tbl_petrol_merge_job.item_code = tbl_item.item_code
                where tbl_petrol_merge_job.petrol_merge_job_flag = '1' and ptrl_merge_code is not null 
                and tbl_petrol_merge_job.ptrl_code = '${ptrl_code}' 
                and tbl_petrol_merge_job.ptrl_merge_code = '${ptrl_merge_code}' `;
            }
            else {
                script = `select tbl_petrol_merge_job.ptrl_merge_job_code,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_petrol.ptrl_number,
                tbl_petrol.ptrl_desc,
                tbl_petrol.ptrl_short_desc,
                tbl_petrol_group.ptrl_group_code,
                tbl_petrol_group.ptrl_group_desc,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_merge_petrol.ptrl_number as ptrl_merge_number,
                tbl_merge_petrol.ptrl_desc as ptrl_merge_desc,
                tbl_merge_petrol.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol.off_code,
                tbl_office.off_desc,
                tbl_petrol_merge_job.itm_code,
                tbl_item.itm_desc,
                tbl_item.itm_short_desc,
                tbl_petrol_merge_job.ist_dt,
                tbl_petrol_merge_job.mdf_dt,
                tbl_petrol_merge_job.rm_dt 

                from tbl_petrol_merge_job
                left join tbl_petrol on tbl_petrol_merge_job.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_item on tbl_petrol_merge_job.itm_code = tbl_item.itm_code
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                left join tbl_petrol tbl_merge_petrol on tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_petrol.ptrl_code
                where tbl_petrol_merge_job.petrol_merge_job_flag = '1' and ptrl_merge_code is not null 
                and tbl_petrol_merge_job.ptrl_code = '${ptrl_code}' `;
            }

            script += ` order by tbl_merge_petrol.ptrl_desc asc;`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolMergeJob = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || lic_code == undefined || action == undefined) {
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
            // ดัก ptrl_merge_job_code เป็น array
            let ptrl_merge_job_codeArr = Array.isArray(ptrl_merge_job_code) ? ptrl_merge_job_code : [ptrl_merge_job_code];
            let ptrl_merge_job_codeIn = ptrl_merge_job_codeArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_petrol_merge_job set petrol_merge_job_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_merge_job_code in (${ptrl_merge_job_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolMergeJobInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code } = req.query;
        let {
            ptrl_code,
            ptrl_merge_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || ptrl_code == undefined || ptrl_merge_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `update tbl_petrol_merge_job set
            ptrl_code = '${ptrl_code}', 
            ptrl_merge_code = '${ptrl_merge_code}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_merge_job_code = '${ptrl_merge_job_code}';`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolMergeJobInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ptrl_code,
            ptrl_merge_code,
            itm_code,
            dpo_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || ptrl_merge_code == undefined || itm_code == undefined || dpo_code == undefined || action == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let insertedData = [];
            let isError = false;
            let duplicateCount = 0;

            if (ptrl_merge_code.length > 0 && itm_code.length > 0) {
                //ดัก ptrl_merge_code Array 

                for (let i = 0; i < ptrl_merge_code.length; i++) {
                    let current_merge_code = ptrl_merge_code[i];
                    let current_itm_code = (Array.isArray(itm_code) && itm_code[i]) ? itm_code[i] : '';

                    // 1. เช็คข้อมูลซ้ำทีละรายการ
                    let script = `select 
                    ptrl_merge_job_code 
                    from tbl_petrol_merge_job 
                    where petrol_merge_job_flag = '1' 
                    and ptrl_code = '${ptrl_code}' 
                    and ptrl_merge_code = '${current_merge_code}' 
                    and itm_code = '${current_itm_code}';`
                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (tbl_temporary0.data.length > 0) {

                        duplicateCount++;
                        continue;

                    }

                    // 2. Insert ข้อมูล พร้อม itm_code
                    let ptrl_merge_job_code = 'pmgr-' + moment().format('x');

                    script = `insert into tbl_petrol_merge_job 
            (ptrl_merge_job_code, ptrl_code, ptrl_merge_code, itm_code, petrol_merge_job_flag, ist_dt, dpo_code) values 
            ('${ptrl_merge_job_code}', '${ptrl_code}', '${current_merge_code}', '${current_itm_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${dpo_code}');`

                    let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary.code) {
                        insertedData.push({ ptrl_merge_job_code: ptrl_merge_job_code, ptrl_merge_code: current_merge_code, itm_code: current_itm_code });
                    } else {
                        isError = true;
                        break;
                    }
                }
            }


            // จัดการ Response เมื่อลูปทำงานเสร็จ
            if (isError) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }

            // เช็คว่าถ้าไม่มีการ Insert เลย และมีค่าซ้ำทั้งหมด
            if (insertedData.length === 0 && duplicateCount > 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-4',
                    message: `ไม่สามารถบันทึกข้อมูลได้ เนื่องจากข้อมูลที่ส่งมามีอยู่ในระบบแล้วทั้งหมด`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ข้อมูลซ้ำทั้งหมด', action[0].value);
                return;
            }

            let successMessage = duplicateCount > 0
                ? `บันทึกสำเร็จ (ข้ามรายการที่มีอยู่แล้ว ${duplicateCount} รายการ)`
                : `บันทึกสำเร็จ`;


            let response = [{
                status: 'success',
                invalid_code: '0',
                message: successMessage,
                data: insertedData,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
