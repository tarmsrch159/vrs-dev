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
        let { order_no, start_date, end_date, order_type, ord_status,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
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
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_order.deli_time_req as RequestTime, 
                tbl_order.description,  tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                tbl_order_petrol.ord_petrol_code,
                tbl_order_petrol.item_quantity as qty,
                tbl_petrol.ptrl_number as shipto,
                tbl_petrol.ptrl_desc as station,
                json_build_object(
                    'id', tbl_order_item.id,
                    'item_no', tbl_order_item.item_no,
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
                left join tbl_order_petrol on tbl_order.order_no = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1'
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_item on tbl_order_petrol.itm_code = tbl_item.itm_code
                left join (
                    SELECT DISTINCT ON (order_no, item_no) * FROM tbl_order_item 
                    WHERE rm_dt IS NULL 
                    ORDER BY order_no, item_no, ist_dt DESC
                ) tbl_order_item on tbl_order.order_no = tbl_order_item.order_no and tbl_order_petrol.itm_code = tbl_order_item.item_no
                where tbl_order.rm_dt IS NULL and tbl_order.order_no = '${order_no}' and tbl_order_item.auto_order = '0' `;
            }
            else {
                script = `select 
                tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc,
                tbl_petrol_group.ptrl_group_desc,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_order.deli_time_req as request_time, 
                tbl_order.description, tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                tbl_order_petrol.ord_petrol_code,
                tbl_order_petrol.item_quantity as qty,
                tbl_petrol.ptrl_number as shipto,
                tbl_petrol.ptrl_desc as station,
                json_build_object(
                    'id', tbl_order_item.id,
                    'item_no', tbl_order_item.item_no,
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
                left join tbl_order_petrol on tbl_order.order_no = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1'
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                left join tbl_item on tbl_order_petrol.itm_code = tbl_item.itm_code
                left join (
                    SELECT DISTINCT ON (order_no, item_no) * FROM tbl_order_item 
                    WHERE rm_dt IS NULL 
                    ORDER BY order_no, item_no, ist_dt DESC
                ) tbl_order_item on tbl_order.order_no = tbl_order_item.order_no and tbl_order_petrol.itm_code = tbl_order_item.item_no
                where tbl_order.rm_dt IS NULL and tbl_order_item.auto_order = '0' `;
            }

            if (ord_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.status_deli = '${ord_status}' `
            }

            if (order_type.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.order_type = '${order_type}' `
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
            order_petrol,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (order_type == undefined || order_group == undefined
            || division == undefined || sold_to == undefined || ship_to == undefined
            || deli_date_req == undefined || order_petrol == undefined || action == undefined || description == undefined) {
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

        // ====================== เช็คก่อนว่า มีรหัสน้ำมันในระบบรึเปล่า ======================
        let hasValidItem = false;
        if (order_petrol && Array.isArray(order_petrol) && order_petrol.length > 0) {
            for (var i = 0; i <= order_petrol.length - 1; i++) {
                if (order_petrol[i].data && Array.isArray(order_petrol[i].data) && order_petrol[i].data.length > 0) {
                    for (var j = 0; j <= order_petrol[i].data.length - 1; j++) {
                        var pre_itm_material_number = order_petrol[i].data[j].itm_material_number;
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
                if (hasValidItem) break; // เจอแล้ว break loop
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
            '${po_name || 'AOS'}', '${order_by || ''}', '${ship_cond || ''}', '${pay_term || ''}', 
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

        // ====================== เพิ่มข้อมูลลงใน tbl_order_petrol + tbl_order_item จาก order_petrol array ======================
        if (order_petrol && Array.isArray(order_petrol) && order_petrol.length > 0) {
            for (var i = 0; i <= order_petrol.length - 1; i++) {
                var ptrl_code = order_petrol[i].ptrl_code;
                var ptrl_tank_code = order_petrol[i].ptrl_tank_code || '';

                if (order_petrol[i].data && Array.isArray(order_petrol[i].data) && order_petrol[i].data.length > 0) {
                    for (var j = 0; j <= order_petrol[i].data.length - 1; j++) {
                        var itm_code = order_petrol[i].data[j].itm_code;
                        var itm_unit_code = order_petrol[i].data[j].itm_unit_code || '';
                        var item_quantity = parseFloat(order_petrol[i].data[j].item_quantity) || 0;
                        var itm_material_number = order_petrol[i].data[j].itm_material_number;
                        var ord_petrol_code = 'optrl-' + moment().format('x') + '-' + i + '-' + j;

                        // ===== เช็ค itm_material_number ว่ามีอยู่ใน tbl_item หรือไม่ =====
                        if (itm_material_number) {
                            let check_item = `SELECT * FROM tbl_item WHERE itm_material_number = '${itm_material_number}'`
                            let checkItem = await pgConn.get(dbPrefix + lic_code, check_item, config.connectionString());

                            if (!checkItem.code && checkItem.data.length > 0) {
                                itm_code = checkItem.data[0].itm_code;
                                // ===== เพิ่มข้อมูลลงใน tbl_order_petrol =====
                                let script_petrol = `INSERT INTO public.tbl_order_petrol 
                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, 
                            req_dt, ord_petrol_flag, ist_dt) 
                            VALUES ('${ord_petrol_code}', '${order_no}', '${ptrl_code}', '${ptrl_tank_code}', 
                            '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                            ${deli_date_req ? "'" + moment(deli_date_req).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'}, 
                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`;

                                await pgConn.execute(dbPrefix + lic_code, script_petrol, config.connectionString());

                                // ===== เพิ่มข้อมูลลงใน tbl_order_item =====
                                if (order_petrol[i].data[j].item_text && Array.isArray(order_petrol[i].data[j].item_text) && order_petrol[i].data[j].item_text.length > 0) {
                                    // ===== เพิ่มข้อมูลลงใน tbl_order_item กรณีที่มี item_text ส่งมาด้วย (วนลูป Insert ตามปกติ) =====
                                    for (var k = 0; k <= order_petrol[i].data[j].item_text.length - 1; k++) {
                                        var item_text = order_petrol[i].data[j].item_text[k];
                                        let script_item = `INSERT INTO public.tbl_order_item 
                                        (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                                        VALUES ('${order_no}', '${itm_code}', ${item_quantity}, '${item_text.long_text_id}', '${item_text.long_text}',
                                        '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`;
                                        await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                                    }
                                } else {
                                    // ===== เพิ่มข้อมูลลงใน tbl_order_item =====
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
        let { order_no } = req.query
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
            order_petrol,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (description == undefined || action == undefined) {
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

        let logPayload = {
            body: req.body[0],
            order_no: order_no
        };

        // Step 1: UPDATE tbl_order — แก้ไขทุกฟิลด์ยกเว้น order_no
        let setClauses = [];
        if (order_type != undefined) setClauses.push(`order_type = '${order_type}'`);
        if (order_group != undefined) setClauses.push(`order_group = '${order_group}'`);
        if (chanel != undefined) setClauses.push(`chanel = '${chanel}'`);
        if (division != undefined) setClauses.push(`division = '${division}'`);
        if (sold_to != undefined) setClauses.push(`sold_to = '${sold_to}'`);
        if (ship_to != undefined) setClauses.push(`ship_to = '${ship_to}'`);
        if (cus_ref != undefined) setClauses.push(`cus_ref = '${cus_ref}'`);
        if (cus_date_ref != undefined) setClauses.push(`cus_date_ref = '${moment(cus_date_ref).format('YYYY-MM-DD HH:mm:ss')}'`);
        if (po_name != undefined) setClauses.push(`po_name = '${po_name}'`);
        if (order_by != undefined) setClauses.push(`order_by = '${order_by}'`);
        if (ship_cond != undefined) setClauses.push(`ship_cond = '${ship_cond}'`);
        if (pay_term != undefined) setClauses.push(`pay_term = '${pay_term}'`);
        if (deli_date_req != undefined) setClauses.push(`deli_date_req = '${moment(deli_date_req).format('YYYY-MM-DD HH:mm:ss')}'`);
        if (deli_time_req != undefined) setClauses.push(`deli_time_req = '${deli_time_req}'`);
        if (description != undefined) setClauses.push(`description = '${description}'`);
        if (sh_cus_ref != undefined) setClauses.push(`sh_cus_ref = '${sh_cus_ref}'`);
        if (sh_cus_date_ref != undefined) setClauses.push(`sh_cus_date_ref = '${moment(sh_cus_date_ref).format('YYYY-MM-DD HH:mm:ss')}'`);
        setClauses.push(`mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}'`);

        let script = `UPDATE public.tbl_order SET ${setClauses.join(', ')} WHERE order_no = '${order_no}' AND rm_dt IS NULL`;

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (tbl_temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถแก้ไขข้อมูล Order, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            let event_type = req.body[0].event_type || 'override';
            let logPayloadObj = { ...req.body[0], order_no: order_no };
            await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadObj), 'ไม่สามารถแก้ไขข้อมูล Order', action[0].value);
            return;
        }

        // Step 2: UPDATE tbl_order_petrol + tbl_order_item (item_quantity)
        if (order_petrol && Array.isArray(order_petrol) && order_petrol.length > 0) {
            for (var i = 0; i <= order_petrol.length - 1; i++) {

                if (order_petrol[i].data && Array.isArray(order_petrol[i].data) && order_petrol[i].data.length > 0) {
                    for (var j = 0; j <= order_petrol[i].data.length - 1; j++) {
                        var itm_code = order_petrol[i].data[j].itm_code;
                        var ord_petrol_item_qty = parseFloat(order_petrol[i].ord_petrol_item_qty) || 0;
                        var item_quantity = parseFloat(order_petrol[i].data[j].item_quantity) || 0;
                        var ord_petrol_code = order_petrol[i].data[j].ord_petrol_code || order_petrol[i].ord_petrol_code;
                        var item_id = order_petrol[i].data[j].id;
                        var order_item_no = order_petrol[i].data[j].item_no;
                        // UPDATE tbl_order_petrol — แก้ไขจำนวนน้ำมัน
                        if (ord_petrol_code) {
                            let script_petrol = `UPDATE public.tbl_order_petrol 
                                SET item_quantity = ${ord_petrol_item_qty}, 
                                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                                WHERE ord_petrol_code = '${ord_petrol_code}'`;

                            await pgConn.execute(dbPrefix + lic_code, script_petrol, config.connectionString());
                        }

                        // INSERT tbl_order_item แทนการ อัปเดต ตาม Requirement
                        if (order_item_no) {
                            // ดึงข้อมูลเดิมมาเพื่อ insert ทับ
                            let getItemScript = `SELECT * FROM public.tbl_order_item WHERE order_no = '${order_no}' and item_no = '${order_item_no}'`;
                            let oldItemResult = await pgConn.get(dbPrefix + lic_code, getItemScript, config.connectionString());

                            if (!oldItemResult.code && oldItemResult.data.length > 0) {
                                let oldItem = oldItemResult.data[0];

                                if (oldItem.auto_order == '1') {
                                    let script_item = `INSERT INTO public.tbl_order_item 
                                        (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order) 
                                        VALUES (
                                        '${oldItem.order_no}', 
                                        '${oldItem.item_no}', 
                                        ${item_quantity}, 
                                        '${oldItem.long_text_id || ''}', 
                                        '${oldItem.long_text || ''}', 
                                        '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
                                        '1',    
                                        '0'
                                        )`;
                                    console.log(script_item);
                                    await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());

                                    // Disable/Remove the old one by setting order_item_flag to 0 or nullifying it
                                    let disableOldScript = `UPDATE public.tbl_order_item SET order_item_flag = '1', WHERE order_no = '${order_no}' and item_no = '${order_item_no}'`;
                                    await pgConn.execute(dbPrefix + lic_code, disableOldScript, config.connectionString());
                                } else {
                                    let script_item = `UPDATE public.tbl_order_item SET item_qty = ${item_quantity}, mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE order_no = '${order_no}' and item_no = '${order_item_no}'`;
                                    await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                                }
                            }
                        }
                    }
                }
            }
        }

        // Success response
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let event_type = req.body[0].event_type || 'override';
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
        }]
        res.status(200).send(response);
    });

}

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

