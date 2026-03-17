const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
// const moment = require('moment/ts3.1-typings/moment');
const moment = require('moment');
const axios = require('axios');

const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

// =========== ดึงข้อมูลรายการสั่งซื้อ ===========
exports.getOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { order_no, start_date, end_date, order_type, order_status, auto_order, status_deli,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        auto_order = auto_order == undefined ? 'ALL' : auto_order;
        status_deli = status_deli == undefined ? 'ALL' : status_deli;

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (start_date == undefined || end_date == undefined
            || order_type == undefined || order_status == undefined
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

            // ========== เตรียมข้อมูลสำหรับ Query และ Format Dates ==========
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

            // ========== Script Query ข้อมูลหลัก ==========
            if (order_no.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_order.id, tbl_order.order_no,tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc,
                tbl_petrol_group.ptrl_group_desc,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
                tbl_petrol.ptrl_desc as station,
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime, 
                tbl_order.description,  tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                json_build_object(
                    'id', tbl_order_item.id,
                    'sales_order_item', tbl_order_item.sales_order_item,
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
                ) tbl_order_item on tbl_order.id::text = tbl_order_item.order_no 
                left join tbl_item on tbl_order_item.item_no = tbl_item.itm_code
                left join tbl_master_time on tbl_order.deli_time_req = tbl_master_time.time_code
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
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime , 
                tbl_order.description,  tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                json_build_object(
                    'id', tbl_order_item.id,
                    'sales_order_item', tbl_order_item.sales_order_item,
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
                ) tbl_order_item on tbl_order.id::text = tbl_order_item.order_no 
                left join tbl_item on tbl_order_item.item_no = tbl_item.itm_code
                left join tbl_master_time on tbl_order.deli_time_req = tbl_master_time.time_code
                left join (
                    SELECT ptrl_code, itm_code, string_agg(tnk_number, ', ') as tnk_number 
                    FROM tbl_petrol_tank 
                    WHERE rm_dt IS NULL 
                    GROUP BY ptrl_code, itm_code
                ) tbl_petrol_tank on tbl_item.itm_code = tbl_petrol_tank.itm_code and tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                where tbl_order.rm_dt IS NULL`;
            }

            // ========== ต่อ Query String ==========
            if (status_deli.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.status_deli = '${status_deli}' `
            }

            if (order_type.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.order_type = '${order_type}' `
            }

            if (auto_order.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.auto_order = '${auto_order}' `
            }

            if (order_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.order_status = '${order_status}' `
            }

            if (status_deli.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.status_deli = '${status_deli}' `
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

            // ========== ต่อท้าย Query String ==========
            script += ` order by tbl_order.ist_dt desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            // ========== Query ข้อมูลหลัก ==========
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    // ========== Query จำนวนแถวทั้งหมด ==========
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

                    if (order_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.order_status = '${order_status}' `
                    }

                    if (status_deli.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.status_deli = '${status_deli}' `
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

                    // ========== Query จำนวนแถวทั้งหมด ==========
                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }

                    // ========== Return Success Response ==========
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
                    // ========== Return Empty Data Response ==========
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
        // ========== Catch Block ==========
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

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Log ===========
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
                script += ` and (tbl_action_logs.action_desc = 'override' 
                or tbl_action_logs.action_desc = 'manual' 
                or tbl_action_logs.action_desc = 'cancel' 
                or tbl_action_logs.action_desc = 'confirm' 
                or tbl_action_logs.action_desc = 'approve'
                or tbl_action_logs.action_desc = 'confirm_order_sap'
                or tbl_action_logs.action_desc = 'cancel_order_sap'
                ) `;
            }

            script += ` order by tbl_action_logs.ist_dt desc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
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

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Report ===========
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
                left join tbl_order on tbl_order_petrol.ord_code = tbl_order.id::text
                where tbl_order_petrol.rm_dt IS NULL and tbl_order_petrol.ord_code = (SELECT id::text FROM tbl_order WHERE order_no = '${order_no}' LIMIT 1)
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
                left join tbl_order on tbl_order_petrol.ord_code = tbl_order.id::text
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
                        where tbl_order_petrol.rm_dt IS NULL and tbl_order_petrol.ord_code = (SELECT id::text FROM tbl_order WHERE order_no = '${order_no}' LIMIT 1) `;
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

// =========== ดึงข้อมูล Order Runout ===========
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
                EXTRACT(EPOCH FROM(NOW() - ist_dt)) / 60 AS minutes_since_created
            FROM public.tbl_order 
            WHERE auto_order = '1'
            AND(order_no IS NULL OR order_no = '') 
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

// =========== ดึงข้อมูลรายการสั่งซื้อ ที่มีการยืนยันจาก HANA ===========
exports.getConfirmOrder = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_id, action } = req.body[0];

        if (!order_id || !action) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // ================ ดึงข้อมูล tbl_order ==================
        let orderScript = `SELECT * FROM tbl_order WHERE id = '${order_id}' AND rm_dt IS NULL LIMIT 1`;
        let orderResult = await pgConn.get(dbPrefix + lic_code, orderScript, config.connectionString());

        if (orderResult.code || orderResult.data.length === 0) {
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

        console.log(orderResult.data[0])

        let orderData = orderResult.data[0];

        // ================ ดึงข้อมูล tbl_order_item ==================
        let itemScript = `
            SELECT i.item_no, i.item_qty, i.long_text_id, i.long_text, t.itm_material_number, i.sales_order_item 
            FROM tbl_order_item i
            LEFT JOIN tbl_item t ON i.item_no = t.itm_code
            WHERE i.order_no = '${orderData.id}' AND i.rm_dt IS NULL AND i.order_item_flag = '1'
            ORDER BY i.id ASC
                `;
        let itemResult = await pgConn.get(dbPrefix + lic_code, itemScript, config.connectionString());
        // ================ Construct SAP Payload ==================
        let sapItems = [];
        if (!itemResult.code && itemResult.data.length > 0) {
            sapItems = itemResult.data.map((item, index) => {
                let salesOrderItem = String(item.sales_order_item);

                let qty = parseFloat(item.item_qty || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

                let sapItemObj = {
                    "SalesOrderItem": salesOrderItem,
                    "Material": item.itm_material_number || "",
                    "OrderQuantity": qty,
                    "DeliveryPlant": "2I01", // Hardcoded per example
                    "ItemText": []
                };

                if (item.long_text_id && item.long_text) {
                    sapItemObj.ItemText.push({
                        "LongTextID": item.long_text_id,
                        "LongText": item.long_text
                    });
                }

                return sapItemObj;
            });
        }


        let cus_date_ref_formatted = orderData.cus_date_ref ? moment(orderData.cus_date_ref).format('YYYYMMDD') : "";
        let deli_date_req_formatted = orderData.deli_date_req ? moment(orderData.deli_date_req).format('YYYYMMDD') : "";
        let sh_cus_date_ref_formatted = orderData.sh_cus_date_ref ? moment(orderData.sh_cus_date_ref).format('YYYYMMDD') : "";

        let payloadData = JSON.stringify({
            "SalesDocuments": [
                {
                    "SalesOrderType": orderData.order_type || "",
                    "SalesOrganization": orderData.order_group || "1900",
                    "DistributionChannel": orderData.chanel || "01",
                    "OrganizationDivision": orderData.division || "04",
                    "ShipToParty": orderData.ship_to || "",
                    "CustomerReference": orderData.cus_ref || "",
                    "CustomerPurchaseOrderType": orderData.po_name || "AOS",
                    "CustomerReferenceDate": cus_date_ref_formatted,
                    "NameofOrderer": orderData.order_by || "AOS",
                    "ShippingCondition": orderData.ship_cond || "T1",
                    "CustomerPaymentTerms": orderData.pay_term || "Z006",
                    "RequestedDeliveryDate": deli_date_req_formatted,
                    "DeliveryTime": orderData.deli_time_req || "Z05",
                    "Description": orderData.description || "",
                    "SHCustomerReference": orderData.sh_cus_ref || "",
                    "SHCustomerReferenceDate": sh_cus_date_ref_formatted,
                    "HeaderText": [],
                    "Items": sapItems
                }
            ]
        });

        // ================ API Config ==================
        let axiosConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://apiqas-bcp.test01.apimanagement.ap11.hana.ondemand.com:443/v1/Logistics/SDI001/SOCreation',
            headers: {
                'APIKey': 'TRtiSlDe7esbl0lWftGvbEJwY8pfsp86',
                'Content-Type': 'application/json'
            },
            data: payloadData
        };

        try {
            let api_response = await axios.request(axiosConfig);

            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'ยืนยันคำสั่งซื้อสำเร็จ API Called Successfully',
                data: api_response.data,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);

            await xglobal.action_logs(lic_code, action[0].id, 'confirm_order_sap', JSON.stringify({ order_id, ...JSON.parse(payloadData) }), 'success', action[0].value);

            let update_order_status_script = `update tbl_order set order_status = '1', mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' `
            update_order_status_script += ` where id = '${order_id}'`;
            await pgConn.execute(dbPrefix + lic_code, update_order_status_script, config.connectionString());


            // =========== เชื่อมต่อ SAP Data ลงฐานข้อมูล ===========
            let sap_response = api_response.data;
            if (sap_response && sap_response.Response && sap_response.Response.SalesOrders && Array.isArray(sap_response.Response.SalesOrders)) {
                for (let sap_order of sap_response.Response.SalesOrders) {
                    let sh_cus_ref = sap_order.SHCustomerReference;
                    if (!sh_cus_ref) continue;

                    // ===== เช็ค SHCustomerReference ว่ามีอยู่ในระบบหรือไม่ =====
                    let checkScript = `SELECT id, order_no FROM public.tbl_order WHERE sh_cus_ref = '${sh_cus_ref}' AND rm_dt IS NULL LIMIT 1`;
                    let checkResult = await pgConn.get(dbPrefix + lic_code, checkScript, config.connectionString());

                    // ===== Convert SAP Date to SQL Date =====
                    let creation_dt = sap_order.CreationDate ? moment(sap_order.CreationDate, 'YYYYMMDD').format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
                    let creation_tm = sap_order.CreationTime ? moment(sap_order.CreationTime, 'HHmmss').format('HH:mm:ss') : moment().format('HH:mm:ss');
                    let ist_dt = `${creation_dt} ${creation_tm} `;
                    // ===== Convert SAP Date to SQL Date =====
                    let deli_date_req = sap_order.RequestedDeliveryDate ? moment(sap_order.RequestedDeliveryDate, 'YYYYMMDD').format('YYYY-MM-DD') : null;
                    let cus_date_ref = sap_order.CustomerReferenceDate ? moment(sap_order.CustomerReferenceDate, 'YYYYMMDD').format('YYYY-MM-DD') : null;

                    if (!checkResult.code && checkResult.data.length > 0) {
                        // ===== ถ้าเจอ SHCustomerReference แล้ว Update =====
                        let existing_order_no = checkResult.data[0].order_no;
                        let existing_id = checkResult.data[0].id;
                        let updateOrderScript = `UPDATE public.tbl_order SET
            order_no = '${sap_order.SalesOrder}',
                status_deli = '${sap_order.OverallSDProcessStatus || ''}',
                    mdf_dt = '${moment().format('YYYY - MM - DD HH: mm:ss')}'
                            WHERE sh_cus_ref = '${sh_cus_ref}'`;
                        await pgConn.execute(dbPrefix + lic_code, updateOrderScript, config.connectionString());

                        // ===== Update Items =====
                        if (sap_order.Items && Array.isArray(sap_order.Items)) {
                            for (let sapItem of sap_order.Items) {
                                let updateItemScript = `UPDATE public.tbl_order_item SET
            order_no = '${existing_id}',
                sales_order_item = '${sapItem.SalesOrderItem}'
            WHERE(order_no = '${existing_order_no}' OR order_no = '${existing_id}') 
                                    AND item_no IN(SELECT itm_code FROM tbl_item WHERE itm_material_number = '${sapItem.Material}')`;
                                await pgConn.execute(dbPrefix + lic_code, updateItemScript, config.connectionString());
                            }
                        }
                    } else {
                        // ===== ถ้าไม่เจอ SHCustomerReference แล้ว Insert =====
                        let sap_order_no = sap_order.SalesOrder;
                        let insertOrderScript = `INSERT INTO public.tbl_order
                (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                    cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                    deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                    status_deli, ist_dt, order_flag, auto_order)
            VALUES
                ('${sap_order_no}', '${sap_order.SalesOrderType || ''}', '${sap_order.SalesOrganization || ''}', '${sap_order.DistributionChannel || '01'}', '${sap_order.OrganizationDivision || '04'}',
                    '${sap_order.SoldToParty || ''}', '${sap_order.ShipToParty || ''}', '${sap_order.CustomerReference || ''}',
                    ${cus_date_ref ? "'" + cus_date_ref + "'" : 'NULL'},
                    '${sap_order.CustomerPurchaseOrderType || 'AOS'}', '${sap_order.NameofOrderer || ''}', '', '',
                    ${deli_date_req ? "'" + deli_date_req + "'" : 'NULL'}, '${sap_order.DeliveryTime || ''}',
                    '${sap_order.Description || ''}', '${sap_order.SHCustomerReference || ''}',
                    ${cus_date_ref ? "'" + cus_date_ref + "'" : 'NULL'},
                    '${sap_order.OverallSDProcessStatus || '0'}', '${ist_dt}', '1', '1') RETURNING id`;

                        insertOrderScript = insertOrderScript.replace(/'NULL'/gi, "NULL");
                        let insertResult = await pgConn.get(dbPrefix + lic_code, insertOrderScript, config.connectionString());

                        if (!insertResult.code && insertResult.data.length > 0) {
                            let new_order_id = insertResult.data[0].id;

                            if (sap_order.Items && Array.isArray(sap_order.Items)) {
                                for (let sapItem of sap_order.Items) {
                                    let material = sapItem.Material;
                                    let itm_code = '';

                                    let lookupMaterialScript = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${material}' LIMIT 1`;
                                    let lookupResult = await pgConn.get(dbPrefix + lic_code, lookupMaterialScript, config.connectionString());
                                    if (!lookupResult.code && lookupResult.data.length > 0) {
                                        itm_code = lookupResult.data[0].itm_code;
                                    }

                                    if (itm_code) {
                                        let insertItemScript = `INSERT INTO public.tbl_order_item
                (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order, sales_order_item)
            VALUES('${new_order_id}', '${itm_code}', ${parseFloat(sapItem.OrderQuantity) || 0
                                            }, '', '',
            '${ist_dt}', '1', '1', '${sapItem.SalesOrderItem || ''}')`;
                                        await pgConn.execute(dbPrefix + lic_code, insertItemScript, config.connectionString());
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return;

        } catch (error) {
            console.log(error);
            let errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'External API Error: ' + errMsg,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            if (!res.headersSent) {
                res.status(200).send(response);
            }

            await xglobal.action_logs(lic_code, action[0].id, 'confirm_order_api_error', JSON.stringify({ order_id }), errMsg, action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        if (!res.headersSent) {
            res.status(200).send(response);
        }
    });

};

// =========== ดึงรายการสั่งซื้อจาก Hana ===========
exports.getOrderInformationHana = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');

        // 1. ดึงข้อมูลจาก SOInputParameter ตามโครงสร้าง JSON ใหม่
        let inputParam = req.body[0]?.SOInputParameter || {};
        let { SalesOrderList, CreationDate, CreationDateTo, action } = inputParam;

        if (!SalesOrderList || !action) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // ================ Construct SAP Payload ==================
        let sapItems = [];

        let payloadData = JSON.stringify({
            "SOInputParameter": {
                // 2. ใส่ SalesOrderList ที่เป็น Array ลงไปได้เลย
                "SalesOrderList": SalesOrderList,
                "SalesOrderTypeList": inputParam.SalesOrderTypeList || [],
                "ShipToPartyList": inputParam.ShipToPartyList || [],
                "CreationDate": CreationDate || "",
                "CreationTime": inputParam.CreationTime || "",
                "CreationDateTo": CreationDateTo || "",
                "CreationTimeTo": inputParam.CreationTimeTo || "",
                "CustomerPurchaseOrderType": inputParam.CustomerPurchaseOrderType || "",
                "CustomerGroup1List": inputParam.CustomerGroup1List || [],
                "NameofOrdererList": inputParam.NameofOrdererList || []
            }
        });

        // ================ API Config ==================
        let axiosConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://apiqas-bcp.test01.apimanagement.ap11.hana.ondemand.com:443/v1/Logistics/SDI024/SODetail',
            headers: {
                'APIKey': 'TRtiSlDe7esbl0lWftGvbEJwY8pfsp86',
                'Content-Type': 'application/json'
            },
            data: payloadData
        };

        try {
            let apiResponse = await axios.request(axiosConfig);

            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'ดึงข้อมูล Order จาก SAP',
                data: apiResponse.data,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);


        } catch (error) {
            console.log(error);
            let errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'External API Error: ' + errMsg,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);

            // 3. เปลี่ยนตัวแปร log จาก order_no เป็น SalesOrderList เพื่อไม่ให้เกิด error
            await xglobal.action_logs(lic_code, action[0].id, 'confirm_order_api_error', JSON.stringify({ SalesOrderList }), errMsg, action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });

};

// =========== ส่งคำขอยกเลิกคำสั่งซื้อ ไปที่ HANA
exports.cancelOrderInformationHana = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { order_no, items, action } = req.body[0];

        if (!order_no || !action) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // ========== เช็ีคก่อนว่ามี order มั้ย ================
        // var script_check_sales_order = `SELECT * FROM tbl_order WHERE order_no = '${order_no}'`;
        // var check_sales_order = await pgConn.get(dbPrefix + lic_code, script_check_sales_order, config.connectionString());
        // if (!check_sales_order.code && check_sales_order.data.length > 0) {
        //     let response = [{
        //         status: 'error',
        //         invalid_code: '-1',
        //         message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
        //         data: [],
        //         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        //     }];
        //     res.status(200).send(response);
        //     return;
        // }

        // console.log("check_sales_order.data", check_sales_order.data)

        // ================ Construct HANA Payload ==================
        let itemsArr = [];
        if (items && Array.isArray(items) && items.length > 0) {
            itemsArr = items;
        } else {
            itemsArr = [{}];
        }

        console.log(itemsArr)

        let sapItems = itemsArr.map((item, index) => {

            return {
                "SalesOrderItem": item.SalesOrderItem,
                "SalesDocumentRjcnReason": "85"
            };
        });

        console.log(sapItems)

        let payloadData = JSON.stringify({
            "SalesDocuments": [
                {
                    "SalesOrder": order_no,
                    "Items": sapItems
                }
            ]

        });



        console.log(payloadData)

        // ================ API Config ==================
        let axiosConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://apiqas-bcp.test01.apimanagement.ap11.hana.ondemand.com:443/v1/Logistics/SDI022/SOUpdate',
            headers: {
                'APIKey': 'TRtiSlDe7esbl0lWftGvbEJwY8pfsp86',
                'Content-Type': 'application/json'
            },
            data: payloadData
        };

        try {
            let apiResponse = await axios.request(axiosConfig);

            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'ขอยกเลิกคำสั่งซื้อ จาก SAP',
                data: apiResponse.data,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);

            await xglobal.action_logs(lic_code, action[0].id, 'cancel_order_sap', JSON.stringify({ order_no, ...JSON.parse(payloadData) }), 'success', action[0].value);
            return;

        } catch (error) {
            console.log(error);
            let errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'External API Error: ' + errMsg,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);

            await xglobal.action_logs(lic_code, action[0].id, 'cancel_order_error', JSON.stringify({ order_no }), errMsg, action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });

};

// Mockup: กำหนดเวลา runout (นาที)
const RUNOUT_TIMEOUT_MINUTES = 5;

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Runout ===========
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
            EXTRACT(EPOCH FROM(NOW() - ist_dt)) / 60 AS minutes_since_created
            FROM public.tbl_order 
            WHERE auto_order = '1'
        AND(order_no IS NULL OR order_no = '') 
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

// =========== เพิ่มข้อมูลรายการสั่งซื้อ ===========
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
            || sold_to == undefined || ship_to == undefined
            || deli_date_req == undefined || deli_time_req == undefined || order_item == undefined || action == undefined) {
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

        chanel = chanel = undefined ? "01" : chanel;
        division = division = undefined ? "04" : division;
        let cust_date_delidate = deli_date_req = undefined ? "" : deli_date_req;

        let script = ``;
        // =========== Order No Mockup ===========  
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
                    let logPayload = { order_no: order_no, ...req.body[0] };
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่ม Order', JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)', action[0].value);
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
                message: 'ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจากไม่พบรหัสสินค้าน้ำมัน (material_code) ที่ถูกต้องในระบบ',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            let logPayload = { ...req.body[0] };
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่ม Order', JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล Order เนื่องจากไม่มี รหัสน้ำมันอยู่ในระบบ', action[0].value);
            return;
        }
        // ====================== จบการเช็ค ======================

        cus_date_ref = deli_date_req;
        sh_cus_date_ref = deli_date_req;

        let req_date_str = moment(deli_date_req).format('YYYYMMDD');

        // ====================== หาค่า sh_cus_ref ล่าสุด ======================
        let scriptCheckShCusRef = `
            SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running 
            FROM public.tbl_order 
            WHERE sh_cus_ref LIKE 'AOS%' AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
            `;
        let checkShCusRefResult = await pgConn.get(dbPrefix + lic_code, scriptCheckShCusRef, config.connectionString());

        let running_number = 1;
        if (!checkShCusRefResult.code && checkShCusRefResult.data.length > 0 && checkShCusRefResult.data[0].last_running !== null) {
            running_number = parseInt(checkShCusRefResult.data[0].last_running) + 1;
        }
        sh_cus_ref = 'AOS' + req_date_str + String(running_number).padStart(4, '0');

        // ====================== เพิ่มข้อมูลลงใน tbl_order ======================
        script = `INSERT INTO public.tbl_order
            (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                status_deli, ist_dt, order_flag, auto_order, order_status)
        VALUES
            (NULL, '${order_type}', '${order_group}', '${chanel || '01'}', '${division || '04'}',
                '${sold_to}', '${ship_to}', '${cus_ref || ''}', ${cus_date_ref ? "'" + moment(cus_date_ref).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'},
                'AOS', '${order_by || 'AOS'}', '${ship_cond || 'T1'}', '${pay_term || ''}',
                ${deli_date_req ? "'" + moment(deli_date_req).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'}, '${deli_time_req || ''}',
                '${description || ''}', '${sh_cus_ref || ''}', ${sh_cus_date_ref ? "'" + moment(sh_cus_date_ref).format('YYYY-MM-DD HH:mm:ss') + "'" : 'NULL'},
                'A', '${moment().format('YYYY - MM - DD HH: mm: ss')}', '1', '0', '0') RETURNING id`;

        script = script.replace(/'NULL'/gi, "NULL");
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
        if (tbl_temporary.code || tbl_temporary.data.length === 0) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล Order, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            let logPayload = { order_no: order_no, ...req.body[0] };
            await xglobal.action_logs(lic_code, action[0].id, "เพิ่ม Order", JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล Order', action[0].value);
            return;
        }

        let order_id = tbl_temporary.data[0].id;

        let invalid_material_item = []

        // ====================== หาค่า sales_order_item ล่าสุด ======================
        let script_max_sales_order_item = `SELECT MAX(CAST(sales_order_item AS INTEGER)) as last_running FROM public.tbl_order_item`;
        let check_max_result = await pgConn.get(dbPrefix + lic_code, script_max_sales_order_item, config.connectionString());
        let last_sales_order_item = 0;
        if (!check_max_result.code && check_max_result.data.length > 0 && check_max_result.data[0].last_running !== null) {
            last_sales_order_item = parseInt(check_max_result.data[0].last_running);
        }

        // ====================== เพิ่มข้อมูลลงใน tbl_order_item จาก order_item array ======================
        if (order_item && Array.isArray(order_item) && order_item.length > 0) {
            for (var i = 0; i < order_item.length; i++) {
                last_sales_order_item += 10;
                let sales_order_item = String(last_sales_order_item);
                var itm_code = order_item[i].itm_code;
                var item_quantity = parseFloat(order_item[i].item_quantity) || 0;
                var itm_material_number = order_item[i].itm_material_number;
                var deli_plant = order_item[i].deli_plant;

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
            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item)
        VALUES('${order_id}', '${itm_code}', ${item_quantity}, '${item_text.long_text_id}', '${item_text.long_text}',
            '${moment().format('YYYY - MM - DD HH: mm: ss')}', '1', '0', '${deli_plant || ''}', '${sales_order_item}')`;
                                await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());
                            }
                        } else {
                            // กรณีที่ไม่มี item_text
                            let script_item = `INSERT INTO public.tbl_order_item
            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item)
        VALUES('${order_id}', '${itm_code}', ${item_quantity}, '', '',
            '${moment().format('YYYY - MM - DD HH: mm: ss')}', '1', '0', '${deli_plant || ''}', '${sales_order_item}')`;
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
            message: 'ยืนยันคำสั่ง Order สำเร็จ รอคำสั่ง SAP',
            data: [],
            invalid_material_item: invalid_material_item,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let event_type = req.body[0].event_type || 'manual';
        let logPayload = { order_no: order_no, ...req.body[0] };
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
// =========== แก้ไขข้อมูลรายการสั่งซื้อ ===========
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

        if (status_deli.code || status_deli.data.length === 0 || status_deli.data[0].status_deli != 'A') {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            let logPayloadObj = { order_no: order_no, ...req.body[0] };
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A', action[0].value);
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
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง', action[0].value);
                return;
            }


            let oldOrder = checkOrderNo.data[0];
            let new_order_no = 'ord-' + moment().format('x');
            let addOrderScript = `INSERT INTO tbl_order(
                order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                auto_order, order_ref, ist_dt, status_deli, order_flag)
        VALUES(
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23) RETURNING id`;

            let tbl_temporary_add_order = await pgConn.execute2params(addOrderScript, [
                new_order_no, oldOrder.order_type, oldOrder.order_group, oldOrder.chanel,
                oldOrder.division, oldOrder.sold_to, oldOrder.ship_to, oldOrder.cus_ref,
                oldOrder.cus_date_ref ? moment(oldOrder.cus_date_ref).format('YYYY-MM-DD HH:mm:ss') : null,
                oldOrder.po_name, oldOrder.order_by, oldOrder.ship_cond, oldOrder.pay_term,
                deli_date_req, deli_time_req, description, oldOrder.sh_cus_ref,
                oldOrder.sh_cus_date_ref ? moment(oldOrder.sh_cus_date_ref).format('YYYY-MM-DD HH:mm:ss') : null,
                `0`, order_no, moment().format('YYYY-MM-DD HH:mm:ss'), `0`, `1`
            ]);

            if (tbl_temporary_add_order.code || tbl_temporary_add_order.data.length === 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถสร้าง Order ได้',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่สามารถสร้าง Order ได้', action[0].value);
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
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่สามารถอัปเดต Order ได้', action[0].value);
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
                    let new_order_id = tbl_temporary_add_order.data[0].id;

                    if (order_item_no) {
                        // ============= ดึงข้อมูลเดิมมาอ้างอิง =============
                        // Use both order_no (string) and oldOrder.id to find precisely if exists.
                        let getItemScript = `SELECT * FROM public.tbl_order_item WHERE(order_no = '${order_no}' OR order_no = '${oldOrder.id}') and item_no = '${order_item_no}' order by id desc limit 1`;
                        let oldItemResult = await pgConn.get(dbPrefix + lic_code, getItemScript, config.connectionString());

                        if (!oldItemResult.code && oldItemResult.data.length > 0) {
                            let oldItem = oldItemResult.data[0];
                            //============ ดึงข้อมูลเก่ามาสร้าง Row ใหม่ =============
                            let script_item = `INSERT INTO public.tbl_order_item
            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order)
        VALUES(
            '${new_order_id}', '${oldItem.item_no}', ${item_quantity}, '${oldItem.long_text_id || ''}',
            '${oldItem.long_text || ''}', '${moment().format('YYYY - MM - DD HH: mm: ss')}', '1', '0'
        )`;
                            await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());



                            //============ ปิด Row เก่า =============
                            let disableOldScript = `UPDATE public.tbl_order_item SET order_item_flag = '0', rm_dt = '${moment().format('YYYY - MM - DD HH: mm:ss')}' WHERE id = ${oldItem.id} `;
                            await pgConn.execute(dbPrefix + lic_code, disableOldScript, config.connectionString());

                        } else {
                            // ============= กรณีหาของเดิมไม่เจอ ให้ทำการ Insert ของใหม่เข้าไปเลยครับ โดยผูกกับ new_order_id =============
                            let script_item = `INSERT INTO public.tbl_order_item
            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order)
        VALUES(
            '${new_order_id}', '${order_item_no}', ${item_quantity}, '', '', '${moment().format('YYYY - MM - DD HH: mm: ss')}', '1', '0'
        )`;
                            await pgConn.execute(dbPrefix + lic_code, script_item, config.connectionString());

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
            let logPayloadObj = { order_no: order_no, new_order_no: new_order_no, ...req.body[0] };
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

//============== Approve Order Status Deli ==============
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
        let event_type = req.body[0].event_type || 'approve';
        let logPayloadObj = { order_no: order_no, status_deli: status_deli, action: action };
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

// =========== ลบข้อมูลรายการสั่งซื้อ ===========
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

            // ดัก petrol_merge_job_id เป็น array
            let order_noArr = Array.isArray(order_no) ? order_no : [order_no];
            let order_noIn = order_noArr.map(c => `'${c}'`).join(', ');

            // ================= เช็ค Validate Status Deli และ Flag =================
            let scriptCheckStatus = `SELECT order_no, status_deli, order_flag FROM tbl_order WHERE order_no IN(${order_noIn})`;
            let status_deli_res = await pgConn.get(dbPrefix + lic_code, scriptCheckStatus, config.connectionString());

            if (status_deli_res.code || status_deli_res.data.length === 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่พบข้อมูลออเดอร์ที่สามารถลบได้ในระบบ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่พบข้อมูลออเดอร์ที่สามารถลบได้ในระบบ', action[0].value);
                return;
            }

            // ============ เช็คเงื่อนไขถ้าตัวไหนที่ปิด flag แล้วไม่ต้องบันทึก logs ============
            let closedOrders = status_deli_res.data.filter(order => order.order_flag === '0');
            if (closedOrders.length > 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-2',
                    message: 'ไม่สามารถลบข้อมูลเนื่องจากออเดอร์นี้ปิดใช้งานไปแล้ว',
                    data: [],
                    closed_orders: closedOrders.map(o => o.order_no),
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่สามารถลบข้อมูลเนื่องจากออเดอร์นี้ปิดใช้งานไปแล้ว', action[0].value);
                return;
            }

            let validOrders = [];
            let skippedOrders = [];

            status_deli_res.data.forEach(order => {
                if (order.status_deli === 'A') {
                    validOrders.push(order.order_no);
                } else {
                    skippedOrders.push(order.order_no);
                }
            });

            // ถ้าไม่มีออเดอร์สถานะ A เลยสักตัวเดียว ให้ตีกลับ Error
            if (validOrders.length === 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถยกเลิก/ลบออเดอร์ได้ เนื่องจากไม่มีออเดอร์ใดที่มี Status Delivery เป็น A',
                    data: [],
                    skipped_orders: skippedOrders, // แนบไปบอกหน้าบ้านว่าตัวไหนโดนข้ามบ้าง
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);
                let logPayloadObj = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Order', JSON.stringify(logPayloadObj), 'ไม่สามารถยกเลิก/ลบออเดอร์ได้ เนื่องจากไม่มีออเดอร์ใดที่มี Status Delivery เป็น A', action[0].value);
                return;
            }
            // ================= จบการเช็ค Status Deli =================
            let validOrderNoIn = validOrders.map(c => `'${c}'`).join(', ');

            let script = `update tbl_order set order_flag = '0', rm_dt = '${moment().format('YYYY - MM - DD HH: mm:ss')}' 
            where order_no in (${validOrderNoIn}); `

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {

                let successMessage = skippedOrders.length > 0
                    ? `ลบข้อมูล Order สำเร็จ ${validOrders.length} รายการ(ข้าม Order ที่สถานะไม่ใช่ A จำนวน ${skippedOrders.length} รายการ)`
                    : 'ลบข้อมูล Order ได้สำเร็จทั้งหมด';
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: successMessage,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                let event_type = req.body[0].event_type || 'cancel_aos';
                let logPayload = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'success', action[0].value);
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
                let event_type = req.body[0].event_type || 'cancel_aos';
                let logPayload = { order_no: order_no, ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        let logPayload = { order_no: (req.body[0].order_no || ""), ...req.body[0] };
        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayload), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}




