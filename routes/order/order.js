const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
// const moment = require('moment/ts3.1-typings/moment');
const moment = require('moment');

const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.getOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no, start_date, end_date, order_type, ord_status, auto_order,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        auto_order = auto_order == undefined ? 'ALL' : auto_order;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (order_no == undefined || start_date == undefined || end_date == undefined
            || order_type == undefined || ord_status == undefined
            || search == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            if (start_date.length == 10) {
                start_date = start_date + ' 00:00:00'
            }

            if (end_date.length == 10) {
                end_date = end_date + ' 23:59:59'
            }

            if (order_no.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_order.id, tbl_order.order_no,tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc,
                tbl_petrol_group.ptrl_group_desc,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
                tbl_petrol.ptrl_desc as station,
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_order.deli_time_req as RequestTime, 
                tbl_order.description,  tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                json_build_object(
                    'id', tbl_order_item.id,
                    'itm_code', tbl_item.itm_code,
                    'itm_material_number', tbl_item.itm_material_number,
                    'product', tbl_item.itm_desc,
                    'item_qty', tbl_order_item.item_qty,
                    'long_text_id', tbl_order_item.long_text_id,
                    'long_text', tbl_order_item.long_text,
                    'auto_order', tbl_order_item.auto_order 
                ) as item_information,
                 tbl_order.auto_order
                from tbl_order  
                left join tbl_order_type on tbl_order.order_type = tbl_order_type.ord_type_code
                left join tbl_petrol_group on tbl_petrol_group.ptrl_group_code = tbl_order.order_group
                left join tbl_petrol on tbl_order.ship_to = tbl_petrol.ptrl_number
                left join (
                    SELECT DISTINCT ON (order_no, item_no) * FROM tbl_order_item 
                    WHERE rm_dt IS NULL 
                    ORDER BY order_no, item_no, ist_dt DESC
                ) tbl_order_item on tbl_order.order_no = tbl_order_item.order_no 
                left join tbl_item on tbl_order_item.item_no = tbl_item.itm_code
                where tbl_order.rm_dt IS NULL and tbl_order.order_no = '${order_no}' `;
            }
            else {
                script = `select 
                tbl_order.id, tbl_order.order_no,tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc,
                tbl_petrol_group.ptrl_group_desc,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
                tbl_petrol.ptrl_desc as station,
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_order.deli_time_req as RequestTime, 
                tbl_order.description,  tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                json_build_object(
                    'id', tbl_order_item.id,
                    'itm_code', tbl_item.itm_code,
                    'tnk_number', tbl_petrol_tank.tnk_number,
                    'petrol_desc', tbl_petrol.ptrl_desc,
                    'itm_material_number', tbl_item.itm_material_number,
                    'product', tbl_item.itm_desc,
                    'item_qty', tbl_order_item.item_qty,
                    'long_text_id', tbl_order_item.long_text_id,
                    'long_text', tbl_order_item.long_text,
                    'auto_order', tbl_order_item.auto_order 
                ) as item_information,
                 tbl_order.auto_order
                from tbl_order  
                left join tbl_order_type on tbl_order.order_type = tbl_order_type.ord_type_code
                left join tbl_petrol_group on tbl_petrol_group.ptrl_group_code = tbl_order.order_group
                left join tbl_petrol on tbl_order.ship_to = tbl_petrol.ptrl_number
                left join (
                    SELECT DISTINCT ON (order_no, item_no) * FROM tbl_order_item 
                    WHERE rm_dt IS NULL 
                    ORDER BY order_no, item_no, ist_dt DESC
                ) tbl_order_item on tbl_order.order_no = tbl_order_item.order_no 
                left join tbl_item on tbl_order_item.item_no = tbl_item.itm_code
                left join (
                    SELECT ptrl_code, itm_code, string_agg(tnk_number, ', ') as tnk_number 
                    FROM tbl_petrol_tank 
                    WHERE rm_dt IS NULL 
                    GROUP BY ptrl_code, itm_code
                ) tbl_petrol_tank on tbl_item.itm_code = tbl_petrol_tank.itm_code and tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                where tbl_order.rm_dt IS NULL`;
            }

            if (ord_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.status_deli = '${ord_status}' `
            }

            if (order_type.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.order_type = '${order_type}' `
            }

            if (auto_order.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.auto_order = '${auto_order}' `
            }


            if (search != '') {
                script += ` and (tbl_order.order_no like '%${search}%' 
                or tbl_order.sold_to like '%${search}%' 
                or tbl_order.ship_to like '%${search}%' 
                or tbl_order.po_name like '%${search}%' 
                or tbl_order.description like '%${search}%')`
            }

            if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ist_dt >= '${start_date}' and tbl_order.ist_dt <= '${end_date}'`
            }

            script += ` order by tbl_order.ist_dt desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (order_no.toString().toUpperCase() != 'ALL') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        where tbl_order.rm_dt IS NULL and tbl_order.order_no = '${order_no}' `;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        where tbl_order.rm_dt IS NULL `;
                    }

                    if (ord_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.status_deli = '${ord_status}' `
                    }
                    if (order_type.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.order_type = '${order_type}' `
                    }
                    if (auto_order.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.auto_order = '${auto_order}' `
                    }
                    if (search != '') {
                        script += ` and (tbl_order.order_no like '%${search}%' 
                    or tbl_order.sold_to like '%${search}%' 
                    or tbl_order.ship_to like '%${search}%' 
                    or tbl_order.po_name like '%${search}%' 
                    or tbl_order.description like '%${search}%')`
                    }
                    if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ist_dt >= '${start_date}' and tbl_order.ist_dt <= '${end_date}'`
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


exports.getLoggingOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { action_desc, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (action_desc == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            script = `select 
                tbl_action_logs.action_code as action_by,
                tbl_action_logs.action_desc as event_type,
                tbl_action_logs.action_body,
                tbl_action_logs.ist_dt as action_date
                from tbl_action_logs 
                where tbl_action_logs.rm_dt IS NULL `;

            if (action_desc && action_desc.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_action_logs.action_desc = '${action_desc}' `;
            } else {
                script += ` and (tbl_action_logs.action_desc = 'override' or tbl_action_logs.action_desc = 'manual' or tbl_action_logs.action_desc = 'cancel' or tbl_action_logs.action_desc = 'confirm') `;
            }

            script += ` order by tbl_action_logs.ist_dt desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            console.log(script)
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    let rawData = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let processedData = [];
                    for (let i = 0; i < rawData.length; i++) {
                        let item = rawData[i];
                        let parsedBody = null;
                        try {
                            if (item.action_body && typeof item.action_body === 'string') {
                                parsedBody = JSON.parse(item.action_body);
                            } else if (typeof item.action_body === 'object') {
                                parsedBody = item.action_body;
                            }
                        } catch (e) {
                            console.log("Parse JSON Error on action_body:", e.message);
                        }

                        let flatItem = {
                            event_type: item.event_type,
                            action_by: item.action_by,
                            action_date: item.action_date,
                            log_data: parsedBody || item.action_body
                        };

                        if (parsedBody) {
                            // Extract common fields if they exist
                            let bodyContent = parsedBody.body || parsedBody;
                            flatItem.reason = bodyContent.reason || bodyContent.remark || '';
                            flatItem.log_data = bodyContent;

                            let extracted_order = parsedBody.query?.order_no || bodyContent.query?.order_no || bodyContent.order_no || parsedBody.order_no || '';
                            if (Array.isArray(extracted_order)) {
                                flatItem.order_no = extracted_order.join(', ');
                            } else {
                                flatItem.order_no = extracted_order;
                            }
                        }

                        if (flatItem.order_no && flatItem.order_no !== '') {
                            let orderNoArr = flatItem.order_no.split(',').map(o => `'${o.trim()}'`).join(', ');
                            let stationScript = `
                                select t2.ptrl_number, t2.ptrl_desc 
                                from tbl_order_petrol t1
                                left join tbl_petrol t2 on t1.ptrl_code = t2.ptrl_code 
                                where t1.ord_code in (${orderNoArr}) and t1.ord_petrol_flag = '1'
                            `;
                            let stationTemp = await pgConn.get(dbPrefix + lic_code, stationScript, config.connectionString());
                            if (!stationTemp.code && stationTemp.data.length > 0) {
                                flatItem.ptrl_number = [...new Set(stationTemp.data.map(s => s.ptrl_number).filter(Boolean))].join(', ');
                                flatItem.ptrl_desc = [...new Set(stationTemp.data.map(s => s.ptrl_desc).filter(Boolean))].join(', ');
                            } else {
                                flatItem.ptrl_number = '';
                                flatItem.ptrl_desc = '';
                            }
                        } else {
                            flatItem.ptrl_number = '';
                            flatItem.ptrl_desc = '';
                        }

                        processedData.push(flatItem);
                    }
                    tbl_temporary.data = processedData;

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (action_desc.toString().toUpperCase() != 'ALL') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_action_logs 
                        where tbl_action_logs.rm_dt IS NULL and tbl_action_logs.action_desc = '${action_desc}' `;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_action_logs 
                        where tbl_action_logs.rm_dt IS NULL `;
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


exports.getOrderReport = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no, req_dt, ptrl_tank_code, itm_code,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (req_dt == undefined || order_no == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            if (order_no.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_order_petrol.ord_code,
                tbl_order.cus_date_ref,
               json_agg(json_build_object(
                    'ord_petrol_code', tbl_order_petrol.ord_petrol_code,
                    'shipto', tbl_petrol.ptrl_number,
                    'station', tbl_petrol.ptrl_desc,
                    'req_dt', tbl_order_petrol.req_dt,
                    'ptrl_tank_code', tbl_order_petrol.ptrl_tank_code,
                    'tnk_number', tbl_petrol_tank.tnk_number,
                    'itm_code', tbl_order_petrol.itm_code,
                    'itm_desc', tbl_item.itm_desc,
                    'item_qty', tbl_order_petrol.item_quantity
                )) as items
                from tbl_order_petrol 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_item on tbl_order_petrol.itm_code = tbl_item.itm_code
                left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                left join tbl_order on tbl_order_petrol.ord_code = tbl_order.order_no
                where tbl_order_petrol.rm_dt IS NULL and tbl_order_petrol.ord_code = '${order_no}'
                `;
            }
            else {
                script = `select 
                tbl_order_petrol.ord_code,
                tbl_order.cus_date_ref,
               json_agg(json_build_object(
                    'ord_petrol_code', tbl_order_petrol.ord_petrol_code,
                    'shipto', tbl_petrol.ptrl_number,
                    'station', tbl_petrol.ptrl_desc,
                    'req_dt', tbl_order_petrol.req_dt,
                    'ptrl_tank_code', tbl_order_petrol.ptrl_tank_code,
                    'tnk_number', tbl_petrol_tank.tnk_number,
                    'itm_code', tbl_order_petrol.itm_code,
                    'itm_desc', tbl_item.itm_desc,
                    'item_qty', tbl_order_petrol.item_quantity
                )) as items
                from tbl_order_petrol 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_item on tbl_order_petrol.itm_code = tbl_item.itm_code
                left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                left join tbl_order on tbl_order_petrol.ord_code = tbl_order.order_no
                where tbl_order_petrol.rm_dt IS NULL
                `;
            }



            if (req_dt.toString().toUpperCase() != 'ALL') {
                if (req_dt.length == 10) {

                    script += ` and tbl_order.cus_date_ref >= '${req_dt} 00:00:00' and tbl_order.cus_date_ref <= '${req_dt} 23:59:59' `
                } else {

                    script += ` and tbl_order.cus_date_ref >= '${req_dt}' `
                }
            }

            if (ptrl_tank_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_petrol.ptrl_tank_code = '${ptrl_tank_code}' `
            }

            if (itm_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_petrol.itm_code = '${itm_code}' `
            }
            script += ` 
                group by 
                tbl_order_petrol.ord_code,
                tbl_order.cus_date_ref`

            script += ` order by max(tbl_order_petrol.ist_dt) desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            console.log(script);
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (order_no.toString().toUpperCase() != 'ALL') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order_petrol 
                        where tbl_order_petrol.rm_dt IS NULL and tbl_order_petrol.ord_code = '${order_no}' `;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / ${page_limit})) as page_total, sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order_petrol 
                        where tbl_order_petrol.rm_dt IS NULL `;
                    }




                    if (req_dt.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_petrol.req_dt >= '${req_dt}'`
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


exports.addOrderInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            order_type,
            order_group,
            chanel,
            division,
            sold_to,
            ship_to,
            cus_ref,
            cus_date_ref,
            po_name,
            order_by,
            ship_cond,
            pay_term,
            deli_date_req,
            deli_time_req,
            description,
            sh_cus_ref,
            sh_cus_date_ref,
            order_item,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (order_type == undefined || order_group == undefined
            || division == undefined || sold_to == undefined || ship_to == undefined
            || deli_date_req == undefined || order_item == undefined || action == undefined || description == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let script = ``;
        let order_no = 'ord-' + moment().format('x');

        // ====================== เช็ค Validate item_quantity ======================
        if (order_item && Array.isArray(order_item) && order_item.length > 0) {
            for (var i = 0; i < order_item.length; i++) {
                var item_quantity_check = order_item[i].item_quantity;
                if (!/^\d+(\.\d+)?$/.test(String(item_quantity_check))) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-1',
                        message: 'ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }];
                    res.status(200).send(response);
                    return;
                }
            }
        }

        // ====================== เช็คก่อนว่า มีรหัสน้ำมันในระบบรึเปล่า ======================
        let hasValidItem = false;
        if (order_item && Array.isArray(order_item) && order_item.length > 0) {
            for (var i = 0; i < order_item.length; i++) {
                var pre_itm_material_number = order_item[i].itm_material_number;
                if (pre_itm_material_number) {
                    let check_item_script = `SELECT 1 FROM tbl_item WHERE itm_material_number = '${pre_itm_material_number}' LIMIT 1`;
                    let checkItemResult = await pgConn.get(dbPrefix + lic_code, check_item_script, config.connectionString());
                    if (!checkItemResult.code && checkItemResult.data.length > 0) {
                        hasValidItem = true;
                        break; // เจอ แล้ว break loop
                    }
                }
            }
        }

        if (!hasValidItem) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจากไม่พบรหัสสินค้าน้ำมัน (material_code) ที่ถูกต้องในระบบเลยแม้แต่รายการเดียว',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            let event_type = req.body[0].event_type || 'manual';
            let logPayload = { ...req.body[0] }; // order_no is not created
            await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล Order เนื่องจากไม่มี item ที่สมบูรณ์', action[0].value);
            return;
        }
        // ====================== จบการเช็ค ======================

        // ====================== เพิ่มข้อมูลลงใน tbl_order ======================
        script = `INSERT INTO public.tbl_order 
            (order_no, order_type, order_group, chanel, division, sold_to, ship_to, 
            cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term, 
            deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref, 
            status_deli, ist_dt, order_flag, auto_order) 
            VALUES 
            ('${order_no}', '${order_type}', '${order_group}', '${chanel || '01'}', '${division}', 
            '${sold_to}', '${ship_to}', '${cus_ref || ''}', ${cus_date_ref ? "'" + moment(cus_date_ref).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'}, 
            'AOS', '${order_by || ''}', '${ship_cond || ''}', '${pay_term || ''}', 
            ${deli_date_req ? "'" + moment(deli_date_req).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'}, '${deli_time_req || ''}', 
            '${description || ''}', '${sh_cus_ref || ''}', ${sh_cus_date_ref ? "'" + moment(sh_cus_date_ref).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'}, 
            '0', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`;

        script = script.replace(/'NULL'/gi, "NULL");
        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (tbl_temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล Order, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            let event_type = req.body[0].event_type || 'manual';
            let logPayload = { ...req.body[0], order_no: order_no };
            await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล Order', action[0].value);
            return;
        }

        let invalid_material_item = []

        // ====================== เพิ่มข้อมูลลงใน tbl_order_item จาก order_item array ======================
        if (order_item && Array.isArray(order_item) && order_item.length > 0) {
            for (var i = 0; i < order_item.length; i++) {
                var itm_code = order_item[i].itm_code;
                var item_quantity = parseFloat(order_item[i].item_quantity) || 0;
                var itm_material_number = order_item[i].itm_material_number;

                // ===== เช็ค itm_material_number ว่ามีอยู่ใน tbl_item หรือไม่ =====
                if (itm_material_number) {
                    let check_item = `SELECT * FROM tbl_item WHERE itm_material_number = '${itm_material_number}'`
                    let checkItem = await pgConn.get(dbPrefix + lic_code, check_item, config.connectionString());

                    if (!checkItem.code && checkItem.data.length > 0) {
                        itm_code = checkItem.data[0].itm_code; // ใช้ itm_code ที่เชื่อมได้จากใน DB

                        // ===== เพิ่มข้อมูลลงใน tbl_order_item =====
                        if (order_item[i].item_text && Array.isArray(order_item[i].item_text) && order_item[i].item_text.length > 0) {
                            // กรณีที่มี item_text
                            for (var k = 0; k < order_item[i].item_text.length; k++) {
                                var item_text = order_item[i].item_text[k];
                                let script_item = `INSERT INTO public.tbl_order_item 
                                (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                                VALUES ('${order_no}', '${itm_code}', ${item_quantity}, '${item_text.long_text_id}', '${item_text.long_text}',
                                '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`;
                                await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                            }
                        } else {
                            // กรณีที่ไม่มี item_text
                            let script_item = `INSERT INTO public.tbl_order_item 
                            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                            VALUES ('${order_no}', '${itm_code}', ${item_quantity}, '', '',
                            '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`;
                            await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                        }
                    } else {
                        // ===== ข้ามรายการน้ำมันที่ไม่มีอยู่ในระบบ ======
                        console.log(`ข้ามรายการน้ำมัน: material number ${itm_material_number} ไม่พบในระบบ`);
                        invalid_material_item.push(itm_material_number)
                        continue;
                    }
                }
            }
        }

        // ============ Success response ============
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            invalid_material_item: invalid_material_item,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let event_type = req.body[0].event_type || 'manual';
        let logPayload = { ...req.body[0], order_no: order_no };
        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'success', action[0].value);
        return;

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
    });

}

exports.setOrderInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no } = req.query;
        let {
            description,
            order_item,
            deli_date_req,
            deli_time_req,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (description == undefined || description == '' || action == undefined || order_item == undefined) {
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

        deli_date_req = deli_date_req != undefined ? moment(deli_date_req).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
        deli_time_req = deli_time_req != undefined ? deli_time_req : "Z00";

        // ====================== เช็ค Validate item_quantity ======================
        if (order_item && Array.isArray(order_item) && order_item.length > 0) {
            for (var i = 0; i < order_item.length; i++) {
                var item_quantity_check = order_item[i].item_quantity;
                if (!/^\d+(\.\d+)?$/.test(String(item_quantity_check))) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-1',
                        message: 'ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }];
                    res.status(200).send(response);
                    return;
                }
            }
        }

        let scriptCheckStatus = `SELECT status_deli FROM tbl_order WHERE order_no = '${order_no}'`;
        let status_deli = await pgConn.get(dbPrefix + lic_code, scriptCheckStatus, config.connectionString());
        console.log(status_deli);

        if (status_deli.code || status_deli.data.length === 0 || status_deli.data[0].status_deli != 'A') {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        } else {

            let scriptCheckOrderNo = `SELECT * FROM tbl_order WHERE order_no = '${order_no}'`;
            let checkOrderNo = await pgConn.get(dbPrefix + lic_code, scriptCheckOrderNo, config.connectionString());
            if (checkOrderNo.code || checkOrderNo.data.length == 0) {
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


            let oldOrder = checkOrderNo.data[0];
            let new_order_no = 'ord-' + moment().format('x');
            let addOrderScript = `INSERT INTO tbl_order(
                order_no, order_type, order_group, chanel, division, sold_to, ship_to, 
                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term, 
                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref, 
                auto_order, order_ref, ist_dt, status_deli, order_flag) 
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23)`;

            let tbl_temporary_add_order = await pgConn.execute2params(addOrderScript, [
                new_order_no, oldOrder.order_type, oldOrder.order_group, oldOrder.chanel,
                oldOrder.division, oldOrder.sold_to, oldOrder.ship_to, oldOrder.cus_ref,
                oldOrder.cus_date_ref ? moment(oldOrder.cus_date_ref).format('YYYY-MM-DD HH:mm:ss') : null,
                oldOrder.po_name, oldOrder.order_by, oldOrder.ship_cond, oldOrder.pay_term,
                deli_date_req, deli_time_req, description, oldOrder.sh_cus_ref,
                oldOrder.sh_cus_date_ref ? moment(oldOrder.sh_cus_date_ref).format('YYYY-MM-DD HH:mm:ss') : null,
                `0`, order_no, moment().format('YYYY-MM-DD HH:mm:ss'), `0`, `1`
            ]);

            if (tbl_temporary_add_order.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถสร้าง Order ได้',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                return;
            }

            let updateOrderScript = `UPDATE tbl_order SET order_flag = '0' WHERE order_no = $1`;
            let tbl_temporary_update_order = await pgConn.execute2params(updateOrderScript, [order_no]);

            if (tbl_temporary_update_order.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถอัปเดต Order ได้',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                return;
            }

            // Step 2: UPDATE tbl_order_item (item_quantity)
            if (order_item && Array.isArray(order_item) && order_item.length > 0) {
                // Collect all items to update
                let itemsToUpdate = [];
                for (let i = 0; i < order_item.length; i++) {
                    let currentItem = order_item[i];
                    if (currentItem.item_no) {
                        itemsToUpdate.push({
                            item_no: currentItem.item_no,
                            item_quantity: parseFloat(currentItem.item_quantity) || 0
                        });
                    }
                }

                for (let i = 0; i < itemsToUpdate.length; i++) {
                    let order_item_no = itemsToUpdate[i].item_no;
                    let item_quantity = itemsToUpdate[i].item_quantity;

                    if (order_item_no) {
                        // ============= ดึงข้อมูลเดิมมาอ้างอิง =============
                        let getItemScript = `SELECT * FROM public.tbl_order_item WHERE order_no = '${order_no}' and item_no = '${order_item_no}' order by id desc limit 1`;
                        let oldItemResult = await pgConn.get(dbPrefix + lic_code, getItemScript, config.connectionString());

                        if (!oldItemResult.code && oldItemResult.data.length > 0) {
                            let oldItem = oldItemResult.data[0];
                            //============ ดึงข้อมูลเก่ามาสร้าง Row ใหม่ =============
                            let script_item = `INSERT INTO public.tbl_order_item 
                            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                            VALUES (
                            '${new_order_no}', '${oldItem.item_no}', ${item_quantity}, '${oldItem.long_text_id || ''}', 
                            '${oldItem.long_text || ''}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0'
                            )`;
                            await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                            //============ ดึงข้อมูลเก่ามาสร้าง Row ใหม่=============


                            //============ ปิด Row เก่า =============
                            let disableOldScript = `UPDATE public.tbl_order_item SET order_item_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = ${oldItem.id}`;
                            await pgConn.execute(dbPrefix + lic_code, disableOldScript, config.connectionString());
                            //============ ปิด Row เก่า =============
                        } else {
                            // ============= กรณีหาของเดิมไม่เจอ ให้ทำการ Insert ของใหม่เข้าไปเลยครับ โดยผูกกับ new_order_no =============
                            let script_item = `INSERT INTO public.tbl_order_item 
                            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                            VALUES (
                            '${new_order_no}', '${order_item_no}', ${item_quantity}, '', '', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0'
                            )`;
                            await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                            //============ กรณีหาของเดิมไม่เจอ ให้ทำการ Insert ของใหม่เข้าไปเลยครับ โดยผูกกับ new_order_no =============
                        }
                    }
                }
            }

            // ============= Success response =============
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            let event_type = req.body[0].event_type || 'override';
            let logPayloadObj = { ...req.body[0], order_no: order_no, new_order_no: new_order_no };
            await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadObj), 'success', action[0].value);
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

//Success
exports.removeOrderInformationById = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (order_no == undefined || lic_code == undefined || action == undefined) {
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
            let order_noArr = Array.isArray(order_no) ? order_no : [order_no];
            let order_noIn = order_noArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_order set order_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where order_no in (${order_noIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูล Order ได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                let event_type = req.body[0].event_type || 'Cancel';
                await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(req.body[0]), 'success', action[0].value);
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
                let event_type = req.body[0].event_type || 'Cancel';
                await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        let event_type = req.body[0].event_type || 'cancel';
        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

// Mockup: กำหนดเวลา runout (นาที)
const RUNOUT_TIMEOUT_MINUTES = 5;

exports.getOrderRunout = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { action } = req.body[0];

        if (action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            return;
        }

        // เช็ค order ที่ auto_order = '1' และ order_no ยังว่าง/null
        // และ ist_dt เกินเวลากำหนด (RUNOUT_TIMEOUT_MINUTES นาที)
        let script = `SELECT id, order_no, order_type, order_group, sold_to, ship_to, 
            deli_date_req, description, auto_order, ist_dt,
            EXTRACT(EPOCH FROM (NOW() - ist_dt)) / 60 AS minutes_since_created
            FROM public.tbl_order 
            WHERE auto_order = '1' 
            AND (order_no IS NULL OR order_no = '') 
            AND rm_dt IS NULL 
            AND ist_dt <= NOW() - INTERVAL '${RUNOUT_TIMEOUT_MINUTES} minutes'
            ORDER BY ist_dt ASC`;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                // เพิ่ม status runout ให้แต่ละ order
                let runout_orders = tbl_temporary.data.map(order => ({
                    ...order,
                    runout_status: 'Run-out',
                    runout_reason: `ไม่ได้รับ order_no กลับมาภายใน ${RUNOUT_TIMEOUT_MINUTES} นาที`
                }));

                tbl_temporary.data = JSON.parse(JSON.stringify(runout_orders).replace(/\:null/gi, "\:\"\""));

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบ Order Runout', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ไม่พบ Order ที่ Runout',
                    data: [],
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
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบ Order Runout', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    });

}


exports.setStatusDeli = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no } = req.query;
        let {
            status_deli,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (status_deli == undefined || action == undefined) {
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

        let scriptCheckOrderNo = `SELECT * FROM tbl_order WHERE order_no = '${order_no}'`;
        let checkOrderNo = await pgConn.get(dbPrefix + lic_code, scriptCheckOrderNo, config.connectionString());
        if (checkOrderNo.code || checkOrderNo.data.length == 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่พบข้อมูลออเดอร์ในระบบ',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            return;
        }

        let updateOrderScript = `UPDATE tbl_order SET status_deli = $1, mdf_dt = $2 WHERE order_no = $3`;
        let tbl_temporary_update_order = await pgConn.execute2params(updateOrderScript, [
            status_deli,
            moment().format('YYYY-MM-DD HH:mm:ss'),
            order_no
        ]);

        if (tbl_temporary_update_order.code) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถอัปเดตสถานะ Order ได้',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            return;
        }

        // ============= Success response =============
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];

        res.status(200).send(response);
        let event_type = req.body[0].event_type || 'update_status';
        let logPayloadObj = { ...req.body[0], order_no: order_no };
        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadObj), 'success', action[0].value);
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
};


