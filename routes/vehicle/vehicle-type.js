const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleTypeInformation = async (req, res, next) => {

    var xresult = [{
        veh_type_code: "",
        veh_type_desc: "",
        veh_type_flag: "",
        unloading_minute: 0,
        loading_minute: 0,
        ist_dt: "",
        mdf_dt: "",
        rm_dt: ""
    }];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_type_code, action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_type_code == undefined || lic_code == undefined || action == undefined) {
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

            let script = `select 
                    v.veh_type_code, 
                    v.veh_type_desc, 
                    v.veh_type_flag, 
                    v.veh_qty,
                    v.veh_unavailable, 
                    v.max_merg,
                    (v.veh_qty - v.veh_unavailable) as veh_available,
                    v.capacity_total,
                    v.capacity_max,
                    v.capacity_min,
                    v.compartment_qty,
                    v.ist_dt, 
                    v.mdf_dt, 
                    v.rm_dt,
                    case when v.unloading_minute is null then 0 else v.unloading_minute end as unloading_minute,
                    case when v.loading_minute is null then 0 else v.loading_minute end as loading_minute,
                    c.id as compartment_id,
                    c.compartment_no,
                    c.compartment_total,
                    c.compartment_max,
                    c.compartment_min
                from tbl_vehicle_type v
                left join tbl_compartment_item c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                where v.veh_type_flag = '1'`;

            if (veh_type_code.toString().toUpperCase() != 'ALL') {
                script += ` and v.veh_type_code = '${veh_type_code}'`;
            }

            script += ` order by v.ist_dt desc, c.compartment_no asc`
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (veh_type_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        left join tbl_compartment_item c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                        where v.veh_type_flag = '1' and v.veh_type_code = '${veh_type_code}'`;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        left join tbl_compartment_item c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                        where v.veh_type_flag = '1'`;
                    }

                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        if (tbl_temporary_count.data.length > 0) {
                            tbl_temporary_count.data = JSON.parse(JSON.stringify(tbl_temporary_count.data).replace(/\:null/gi, "\:\"\""));
                            page_total = parseInt(tbl_temporary_count.data[0].page_total);
                            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
                        }
                    }
                    // จัดกลุ่มข้อมูล
                    let groupedData = Object.values(tbl_temporary.data.reduce((acc, curr) => {
                        let key = curr.veh_type_code;

                        // ถ้ายังไม่มีกลุ่มรถนี้ ให้สร้าง object หลักขึ้นมา
                        if (!acc[key]) {
                            acc[key] = {
                                veh_type_code: curr.veh_type_code,
                                veh_type_desc: curr.veh_type_desc,
                                veh_type_flag: curr.veh_type_flag,
                                veh_qty: curr.veh_qty,
                                max_merg: curr.max_merg,
                                veh_unavailable: curr.veh_unavailable,
                                veh_available: curr.veh_available,
                                capacity_total: curr.capacity_total,
                                capacity_max: curr.capacity_max,
                                capacity_min: curr.capacity_min,
                                compartment_qty: curr.compartment_qty,
                                unloading_minute: curr.unloading_minute,
                                loading_minute: curr.loading_minute,
                                ist_dt: curr.ist_dt,
                                mdf_dt: curr.mdf_dt,
                                rm_dt: curr.rm_dt,
                                compartment_list: [],
                            };
                        }

                        // ถ้ามีข้อมูลช่องรถ
                        if (curr.compartment_no !== "" && curr.compartment_no !== null) {
                            acc[key].compartment_list.push({
                                id: curr.compartment_id,
                                compartment_no: curr.compartment_no,
                                compartment_total: curr.compartment_total,
                                compartment_max: curr.compartment_max,
                                compartment_min: curr.compartment_min
                            });
                        }

                        return acc;
                    }, {}));

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: groupedData, // <--- เปลี่ยนให้ส่ง groupedData แทน tbl_temporary.data
                        page_total: page_total,
                        rows_total: rows_total,
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
                        page_total: 0,
                        rows_total: 0,
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

exports.getCompartmentItem = async (req, res, next) => {

    var xresult = [{
        compartment_no: "",
        compartment_total: 0,
        compartment_max: 0,
        compartment_min: 0,
        ist_dt: "",
        mdf_dt: "",
        rm_dt: ""
    }];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_type_code, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_type_code == undefined || lic_code == undefined || action == undefined) {
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

            let script = `select 
                    v.veh_type_code, 
                    v.veh_type_desc, 
                    v.veh_type_flag, 
                    v.veh_qty,
                    v.veh_unavailable, 
                    (v.veh_qty - v.veh_unavailable) as veh_available,
                    v.capacity_total,
                    v.capacity_max,
                    v.capacity_min,
                    v.compartment_qty,
                    v.ist_dt, 
                    v.mdf_dt, 
                    v.rm_dt,
                    case when v.unloading_minute is null then 0 else v.unloading_minute end as unloading_minute,
                    case when v.loading_minute is null then 0 else v.loading_minute end as loading_minute,
                    c.id as compartment_id,
                    c.compartment_no,
                    c.compartment_total,
                    c.compartment_max,
                    c.compartment_min
                from tbl_vehicle_type v
                left join tbl_compartment_item c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                where v.veh_type_flag = '1'`;

            if (veh_type_code.toString().toUpperCase() != 'ALL') {
                script += ` and v.veh_type_code = '${veh_type_code}'`;
            }

            script += ` order by v.ist_dt desc, c.compartment_no asc;`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    // จัดกลุ่มข้อมูล
                    let groupedData = Object.values(tbl_temporary.data.reduce((acc, curr) => {
                        let key = curr.veh_type_code;

                        // ถ้ายังไม่มีกลุ่มรถนี้ ให้สร้าง object หลักขึ้นมา
                        if (!acc[key]) {
                            acc[key] = {
                                veh_type_code: curr.veh_type_code,
                                veh_type_desc: curr.veh_type_desc,
                                veh_type_flag: curr.veh_type_flag,
                                veh_qty: curr.veh_qty,
                                veh_unavailable: curr.veh_unavailable,
                                veh_available: curr.veh_available,
                                capacity_total: curr.capacity_total,
                                capacity_max: curr.capacity_max,
                                capacity_min: curr.capacity_min,
                                compartment_qty: curr.compartment_qty,
                                unloading_minute: curr.unloading_minute,
                                loading_minute: curr.loading_minute,
                                ist_dt: curr.ist_dt,
                                mdf_dt: curr.mdf_dt,
                                rm_dt: curr.rm_dt,
                                compartment_list: [],
                            };
                        }

                        // ถ้ามีข้อมูลช่องรถ
                        if (curr.compartment_no !== "" && curr.compartment_no !== null) {
                            acc[key].compartment_list.push({
                                id: curr.compartment_id,
                                compartment_no: curr.compartment_no,
                                compartment_total: curr.compartment_total,
                                compartment_max: curr.compartment_max,
                                compartment_min: curr.compartment_min
                            });
                        }

                        return acc;
                    }, {}));

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: groupedData, // <--- เปลี่ยนให้ส่ง groupedData แทน tbl_temporary.data
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ดึงข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

//Success
exports.removeVehicleType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_type_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_type_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle_type set veh_type_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_type_code = '${veh_type_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

//Success
exports.setVehicleTypeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_type_code } = req.query;
        let {
            veh_type_desc,
            veh_qty,
            veh_unavailable,
            veh_type_flag,
            max_merg,
            capacity_total,
            capacity_max,
            capacity_min,
            compartment_qty,
            unloading_minute,
            loading_minute,
            compartment_item,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (!veh_type_code || !veh_type_desc || max_merg == undefined || capacity_total == undefined || capacity_max == undefined || capacity_min == undefined || compartment_qty == undefined || unloading_minute == undefined || loading_minute == undefined || compartment_item == undefined || !action || !lic_code) {
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

            let insertedCompartments = [];
            let isError = false;
            let vehTypeFlag = veh_type_flag == undefined ? '1' : String(veh_type_flag);
            let vehQty = veh_qty == undefined ? 1 : veh_qty;
            let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
            let maxMerge = max_merg == undefined ? 0 : max_merg;

            let script = `UPDATE tbl_vehicle_type SET
                veh_type_desc = '${veh_type_desc}',
                veh_qty = ${vehQty},
                veh_unavailable = ${vehUnavailable},
                veh_type_flag = '${vehTypeFlag}',
                max_merg = ${maxMerge},
                capacity_total = ${capacity_total == undefined ? 0 : capacity_total},
                capacity_max = ${capacity_max == undefined ? 0 : capacity_max},
                capacity_min = ${capacity_min == undefined ? 0 : capacity_min},
                compartment_qty = ${compartment_qty == undefined ? 0 : compartment_qty},
                unloading_minute = ${unloading_minute == undefined ? 0 : unloading_minute},
                loading_minute = ${loading_minute == undefined ? 0 : loading_minute},
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                WHERE veh_type_code = '${veh_type_code}';`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                // ลบ compartment_item เก่าทั้งหมดของ veh_type_code นี้ก่อน แล้วค่อยเพิ่มใหม่
                let deleteAllScript = `DELETE FROM tbl_compartment_item 
                    WHERE veh_type_code = '${veh_type_code}';`;
                await pgConn.execute(dbPrefix + lic_code, deleteAllScript, config.connectionString());

                // วนลูป compartment_item เพื่อ Insert เข้า tbl_compartment_item
                if (!isError && Array.isArray(compartment_item) && compartment_item.length > 0) {
                    for (let i = 0; i < compartment_item.length; i++) {
                        let item = compartment_item[i];
                        let current_compartment_no = item.compartment_no || '';
                        let current_compartment_total = item.compartment_total != undefined ? item.compartment_total : 0;
                        let current_compartment_max = item.compartment_max != undefined ? item.compartment_max : 0;
                        let current_compartment_min = item.compartment_min != undefined ? item.compartment_min : 0;

                        let scriptInsertItem = `INSERT INTO tbl_compartment_item 
                        (veh_type_code, compartment_no, compartment_total, compartment_max, compartment_min, ist_dt) VALUES 
                        ('${veh_type_code}', '${current_compartment_no}', ${current_compartment_total}, ${current_compartment_max}, ${current_compartment_min}, '${moment().format('YYYY-MM-DD HH:mm:ss')}');`;

                        let tbl_insertItem = await pgConn.execute(dbPrefix + lic_code, scriptInsertItem, config.connectionString());

                        if (!tbl_insertItem.code) {
                            insertedCompartments.push({
                                veh_type_code: veh_type_code,
                                compartment_no: current_compartment_no,
                                compartment_total: current_compartment_total,
                                compartment_max: current_compartment_max,
                                compartment_min: current_compartment_min
                            });
                        } else {
                            isError = true;
                            break;
                        }
                    }
                }

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_type_code: veh_type_code,
                        compartment_item: insertedCompartments
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'แก้ไขข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}

//Success
exports.addVehicleTypeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            veh_type_desc,
            veh_qty,
            veh_unavailable,
            veh_type_flag,
            max_merg,
            capacity_total,
            capacity_max,
            capacity_min,
            compartment_qty,
            compartment_item,
            unloading_minute,
            loading_minute,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (!veh_type_desc || compartment_item == undefined || max_merg == undefined || capacity_total == undefined || capacity_max == undefined || capacity_min == undefined || compartment_qty == undefined || unloading_minute == undefined || loading_minute == undefined || !action || !lic_code) {
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

            let veh_type_code = '';
            let insertedCompartments = [];
            let isError = false;
            let vehTypeFlag = veh_type_flag == undefined ? '1' : String(veh_type_flag);
            let vehQty = veh_qty == undefined ? 1 : veh_qty;
            let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
            let maxMerge = max_merg == undefined ? 0 : max_merg;

            // เช็คว่า veh_type_desc มีอยู่ใน tbl_vehicle_type หรือยัง
            let scriptCheck = `SELECT veh_type_code FROM tbl_vehicle_type 
                WHERE veh_type_desc = '${veh_type_desc}';`;
            let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

            if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
                // มีอยู่แล้ว → ดึง veh_type_code เดิมมาใช้
                veh_type_code = tbl_check.data[0].veh_type_code;

                // ลบ compartment_item เก่าทั้งหมดของ veh_type_code นี้ก่อน แล้วค่อยเพิ่มใหม่
                let deleteAllScript = `DELETE FROM tbl_compartment_item 
                    WHERE veh_type_code = '${veh_type_code}';`;
                await pgConn.execute(dbPrefix + lic_code, deleteAllScript, config.connectionString());

                // อัพเดทข้อมูล master record
                let scriptUpdate = `UPDATE tbl_vehicle_type SET
                    veh_type_desc = '${veh_type_desc}',
                    veh_qty = ${vehQty},
                    veh_unavailable = ${vehUnavailable},
                    veh_type_flag = '${vehTypeFlag}',
                    max_merg = ${maxMerge},
                    capacity_total = ${capacity_total},
                    capacity_max = ${capacity_max},
                    capacity_min = ${capacity_min},
                    compartment_qty = ${compartment_qty},
                    unloading_minute = ${unloading_minute},
                    loading_minute = ${loading_minute},
                    mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                    WHERE veh_type_code = '${veh_type_code}';`;
                let tbl_update = await pgConn.execute(dbPrefix + lic_code, scriptUpdate, config.connectionString());
                if (tbl_update.code) {
                    isError = true;
                }
            } else {
                // ยังไม่มี vehicle type → Insert ใหม่เข้า tbl_vehicle_type
                let vehQty = veh_qty == undefined ? 1 : veh_qty;
                let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
                let maxMerge = max_merg == undefined ? 0 : max_merg;
                veh_type_code = 'veht-' + moment().format('x');

                let scriptInsert = `INSERT INTO tbl_vehicle_type 
                    (veh_type_code, veh_type_desc, veh_qty, veh_unavailable, veh_type_flag, max_merg, capacity_total, capacity_max, capacity_min, compartment_qty, unloading_minute, loading_minute, ist_dt) VALUES 
                    ('${veh_type_code}', '${veh_type_desc}', ${vehQty}, ${vehUnavailable}, '${vehTypeFlag}', ${maxMerge}, ${capacity_total}, ${capacity_max}, ${capacity_min}, ${compartment_qty}, ${unloading_minute}, ${loading_minute}, '${moment().format('YYYY-MM-DD HH:mm:ss')}');`;
                let tbl_insert = await pgConn.execute(dbPrefix + lic_code, scriptInsert, config.connectionString());
                if (tbl_insert.code) {
                    isError = true;
                }
            }

            // วนลูป compartment_item เพื่อ Insert เข้า tbl_compartment_item
            if (!isError && Array.isArray(compartment_item) && compartment_item.length > 0) {
                for (let i = 0; i < compartment_item.length; i++) {
                    let item = compartment_item[i];
                    let current_compartment_no = item.compartment_no || '';
                    let current_compartment_total = item.compartment_total != undefined ? item.compartment_total : 0;
                    let current_compartment_max = item.compartment_max != undefined ? item.compartment_max : 0;
                    let current_compartment_min = item.compartment_min != undefined ? item.compartment_min : 0;

                    let scriptInsertItem = `INSERT INTO tbl_compartment_item 
                        (veh_type_code, compartment_no, compartment_total, compartment_max, compartment_min, ist_dt) VALUES 
                        ('${veh_type_code}', '${current_compartment_no}', ${current_compartment_total}, ${current_compartment_max}, ${current_compartment_min}, '${moment().format('YYYY-MM-DD HH:mm:ss')}');`;

                    let tbl_insertItem = await pgConn.execute(dbPrefix + lic_code, scriptInsertItem, config.connectionString());

                    if (!tbl_insertItem.code) {
                        insertedCompartments.push({
                            veh_type_code: veh_type_code,
                            compartment_no: current_compartment_no,
                            compartment_total: current_compartment_total,
                            compartment_max: current_compartment_max,
                            compartment_min: current_compartment_min
                        });
                    } else {
                        isError = true;
                        break;
                    }
                }
            }

            // จัดการ Response เมื่อทำงานเสร็จ
            if (isError) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลบางส่วนได้', action[0].value);
                return;
            }

            // กรณีสำเร็จทั้งหมด
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: `บันทึกข้อมูลสำเร็จ`,
                data: [{
                    veh_type_code: veh_type_code,
                    compartment_item: insertedCompartments
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'เพิ่มข้อมูลประเภทรถ', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}


//Success
exports.removeCompartmentItemById = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { compartment_item_id, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (compartment_item_id == undefined || lic_code == undefined || action == undefined) {
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
            let compartment_item_idArr = Array.isArray(compartment_item_id) ? compartment_item_id : [compartment_item_id];
            let compartment_item_idIn = compartment_item_idArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_compartment_item set flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where id in (${compartment_item_idIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลช่องเก็บได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลช่องเก็บได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลช่องเก็บได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลช่องเก็บได้', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}


