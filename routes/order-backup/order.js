const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
// const moment = require('moment/ts3.1-typings/moment');
const moment = require('moment');

const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getRunNumberOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = `select case when max(shipments_code) is null then '000001' 
                else LPAD((replace(max(shipments_code),'','') :: integer + 1) :: text,6,'0') end as shipments_code
                from tbl_order where ord_type_code in ('otyp-9999999999997', 'otyp-9999999999996')`;

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getOrderInformationold = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, start_date, end_date, ord_type_code, ord_status, dpo_code, ptrl_code, ord_missing_latlng, off_code,
            search, page_index, page_limit, suggestion, ptrl_group_code, veh_group_code, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || start_date == undefined || end_date == undefined
            || ord_type_code == undefined || ord_status == undefined || dpo_code == undefined || ptrl_code == undefined
            || ord_missing_latlng == undefined || search == undefined || action == undefined) {
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

            if (suggestion == undefined) {
                suggestion = '0';
            }

            if (ptrl_group_code == undefined) {
                ptrl_group_code = 'ALL';
            }

            if (ord_code.toString().toUpperCase() != 'ALL' && suggestion != '1') {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_order.ord_customer_name, tbl_order.ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code,
                tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, '' ptrl_vehicle_type_desc, 
                case when gsap_order_type_code = 'ZUR' then 'URGENT' when (tbl_order.item_quantity >= 17000 and tbl_order.item_quantity <= 20000) OR (tbl_order.item_quantity >= 40000 and tbl_order.item_quantity <= 45000) then 'FULLLOAD' else '-' end as order_segmentation, 
                tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status, case when tbl_order.ord_comment != '' then tbl_order.ord_comment else  tbl_petrol.ptrl_remark end as ptrl_remark, tbl_order.deadlock_dt    
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
            }
            else {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code,
                tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, '' ptrl_vehicle_type_desc, 
                case when gsap_order_type_code = 'ZUR' then 'URGENT' when (tbl_order.item_quantity >= 17000 and tbl_order.item_quantity <= 20000) OR (tbl_order.item_quantity >= 40000 and tbl_order.item_quantity <= 45000) then 'FULLLOAD' else '-' end as order_segmentation, 
                tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status, case when tbl_order.ord_comment != '' then tbl_order.ord_comment else  tbl_petrol.ptrl_remark end as ptrl_remark, tbl_order.deadlock_dt 
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                where tbl_order.ord_flag = '1' `;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.off_code = '${off_code}' `
            }

            if (ord_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ord_status = '${ord_status}' `
            }

            if (ord_type_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
            }

            if (search != '') {
                script += ` and (tbl_order.shipments_code like '%${search}%' 
                or tbl_order.transport_code like '%${search}%' 
                or tbl_order.tour_code like '%${search}%' 
                or tbl_order.number like '%${search}%' 
                or tbl_order.document_reference like '%${search}%' 
                or tbl_petrol.ptrl_number like '%${search}%' 
                or tbl_petrol.ptrl_desc like '%${search}%' 
                or tbl_order_type.ord_type_desc like '%${search}%')`
            }

            if (ord_missing_latlng == '1') {
                script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0)
                or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
            }

            if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
            }

            if (suggestion == '1') {
                script += `and tbl_order_petrol.ptrl_code in (select ptrl_merge_code as ptrl_code from tbl_petrol_merge_job 
                left join tbl_order_petrol on tbl_petrol_merge_job.ptrl_code = tbl_order_petrol.ptrl_code
                where tbl_order_petrol.ord_code = '${ord_code}'

                union 

                select distinct tbl_order_petrol.ptrl_code from tbl_order_petrol
                where tbl_order_petrol.ord_code = '${ord_code}') `
            }

            if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}' `
            }

            script += ` 
            group by
            tbl_order.ord_code, tbl_order.gsap_order_number ,tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
            tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
            tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number,
            tbl_petrol.ptrl_desc, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
            tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
            tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code, 
            tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, tbl_depot.dpo_number, tbl_depot.dpo_desc, 
            tbl_petrol_depot.ptrl_depot_status, tbl_petrol.ptrl_remark, tbl_order.deadlock_dt   
            
            order by tbl_order.deadlock_dt asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    for (var xveh = 0; xveh <= tbl_temporary.data.length - 1; xveh++) {

                        script = `select tbl_vehicle_type.veh_type_desc from tbl_petrol_vehicle_type 
                        left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code
                        where ptrl_code = '${tbl_temporary.data[xveh].ptrl_code}' and tbl_vehicle_type.veh_type_flag = '1' 
                        and tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1'`

                        let tbl_temporary01 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary01.code) {
                            var vehicle_type_desc = '';
                            for (var xrr = 0; xrr <= tbl_temporary01.data.length - 1; xrr++) {
                                if (vehicle_type_desc == '') {
                                    vehicle_type_desc = tbl_temporary01.data[xrr].veh_type_desc;
                                }
                                else {
                                    vehicle_type_desc += '/' + tbl_temporary01.data[xrr].veh_type_desc;
                                }

                                if (xrr == tbl_temporary01.data.length - 1) {
                                    tbl_temporary.data[xveh].ptrl_vehicle_type_desc = vehicle_type_desc;
                                }
                            }
                        }
                        else {
                            tbl_temporary.data[xveh].ptrl_vehicle_type_desc = 'ไม่ระบุ';
                        }

                        //depot primary
                        script = `select tbl_petrol_depot.dpo_code, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status 
                        from tbl_petrol_depot
                        left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code
                        where ptrl_code = '${tbl_temporary.data[xveh].ptrl_code}' and tbl_petrol_depot.ptrl_depot_flag = '1'
                        order by tbl_petrol_depot.ptrl_depot_status asc`

                        let tbl_temporary02 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary02.code) {
                            var dpo_desc = '';
                            for (var xrr = 0; xrr <= tbl_temporary02.data.length - 1; xrr++) {
                                if (dpo_desc == '') {
                                    dpo_desc = '' + tbl_temporary02.data[xrr].dpo_desc;
                                }
                                else {
                                    dpo_desc += '\r\n' + tbl_temporary02.data[xrr].dpo_desc;
                                }

                                if (xrr == tbl_temporary02.data.length - 1) {
                                    tbl_temporary.data[xveh].dpo_desc = dpo_desc;
                                }
                            }
                        }
                        else {
                            tbl_temporary.data[xveh].dpo_desc = 'ไม่ระบุ';
                        }
                    }

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (ord_code.toString().toUpperCase() != 'ALL' && suggestion != '1') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / 10)) as page_total,sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                        left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                        and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                        where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / 10)) as page_total,sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                        left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                        and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                        where tbl_order.ord_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.off_code = '${off_code}' `
                    }

                    if (ord_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ord_status = '${ord_status}' `
                    }

                    if (ord_type_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
                    }

                    if (search != '') {
                        script += ` and (tbl_order.shipments_code like '%${search}%' 
                        or tbl_order.transport_code like '%${search}%' 
                        or tbl_order.tour_code like '%${search}%' 
                        or tbl_order.number like '%${search}%' 
                        or tbl_order.document_reference like '%${search}%' 
                        or tbl_petrol.ptrl_number like '%${search}%' 
                        or tbl_petrol.ptrl_desc like '%${search}%' 
                        or tbl_order_type.ord_type_desc like '%${search}%')`
                    }

                    if (ord_missing_latlng == '1') {
                        script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0) or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
                    }

                    if (dpo_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
                    }

                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
                    }

                    if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
                    }

                    if (suggestion == '1') {
                        script += `and tbl_order_petrol.ptrl_code in (select ptrl_merge_code as ptrl_code from tbl_petrol_merge_job 
                        left join tbl_order_petrol on tbl_petrol_merge_job.ptrl_code = tbl_order_petrol.ptrl_code
                        where tbl_order_petrol.ord_code = '${ord_code}'

                        union 

                        select distinct tbl_order_petrol.ptrl_code from tbl_order_petrol
                        where tbl_order_petrol.ord_code = '${ord_code}') `
                    }

                    if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}' `
                    }

                    script += ` 
                    group by
                    tbl_order.ord_code, tbl_order.gsap_order_number ,tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                    tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                    tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number,
                    tbl_petrol.ptrl_desc, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                    tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                    tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code, 
                    tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, tbl_depot.dpo_number, tbl_depot.dpo_desc, 
                    tbl_petrol_depot.ptrl_depot_status, tbl_petrol.ptrl_remark, tbl_order.deadlock_dt) xtbl_master `

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}
exports.getOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, start_date, end_date, ord_type_code, ord_status, dpo_code, ptrl_code, ord_missing_latlng, off_code,
            search, page_index, page_limit, suggestion, ptrl_group_code, veh_group_code, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || start_date == undefined || end_date == undefined
            || ord_type_code == undefined || ord_status == undefined || dpo_code == undefined || ptrl_code == undefined
            || ord_missing_latlng == undefined || search == undefined || action == undefined) {
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

            if (suggestion == undefined) {
                suggestion = '0';
            }

            if (ptrl_group_code == undefined) {
                ptrl_group_code = 'ALL';
            }
            if (veh_group_code == undefined) {
                veh_group_code = 'ALL';
            }

            if (ord_code.toString().toUpperCase() != 'ALL' && suggestion != '1') {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code,
                tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, '' ptrl_vehicle_type_desc, 
                case when gsap_order_type_code = 'ZUR' then 'URGENT' when (tbl_order.item_quantity >= 17000 and tbl_order.item_quantity <= 20000) OR (tbl_order.item_quantity >= 40000 and tbl_order.item_quantity <= 45000) then 'FULLLOAD' else '-' end as order_segmentation, 
                tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status, case when tbl_order.ord_comment != '' then tbl_order.ord_comment else  tbl_petrol.ptrl_remark end as ptrl_remark, tbl_order.deadlock_dt    
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
            }
            else {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code,
                tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, '' ptrl_vehicle_type_desc, 
                case when gsap_order_type_code = 'ZUR' then 'URGENT' when (tbl_order.item_quantity >= 17000 and tbl_order.item_quantity <= 20000) OR (tbl_order.item_quantity >= 40000 and tbl_order.item_quantity <= 45000) then 'FULLLOAD' else '-' end as order_segmentation, 
                tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status, case when tbl_order.ord_comment != '' then tbl_order.ord_comment else  tbl_petrol.ptrl_remark end as ptrl_remark, tbl_order.deadlock_dt 
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                where tbl_order.ord_flag = '1' `;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.off_code = '${off_code}' `
            }

            if (ord_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ord_status = '${ord_status}' `
            }

            if (ord_type_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
            }

            if (search != '') {
                script += ` and (tbl_order.shipments_code like '%${search}%' 
                or tbl_order.transport_code like '%${search}%' 
                or tbl_order.tour_code like '%${search}%' 
                or tbl_order.number like '%${search}%' 
                or tbl_order.document_reference like '%${search}%' 
                or tbl_petrol.ptrl_number like '%${search}%' 
                or tbl_petrol.ptrl_desc like '%${search}%' 
                or tbl_order_type.ord_type_desc like '%${search}%')`
            }

            if (ord_missing_latlng == '1') {
                script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0)
                or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
            }

            if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
            }

            if (suggestion == '1') {
                script += `and tbl_order_petrol.ptrl_code in (select ptrl_merge_code as ptrl_code from tbl_petrol_merge_job 
                left join tbl_order_petrol on tbl_petrol_merge_job.ptrl_code = tbl_order_petrol.ptrl_code
                where tbl_order_petrol.ord_code = '${ord_code}'

                union 

                select distinct tbl_order_petrol.ptrl_code from tbl_order_petrol
                where tbl_order_petrol.ord_code = '${ord_code}') `
            }

            if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}' `
            }
            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}' `
            }

            script += ` 
            group by
            tbl_order.ord_code, tbl_order.gsap_order_number ,tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
            tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
            tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number,
            tbl_petrol.ptrl_desc, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
            tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
            tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code, 
            tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, tbl_depot.dpo_number, tbl_depot.dpo_desc, 
            tbl_petrol_depot.ptrl_depot_status, tbl_petrol.ptrl_remark, tbl_order.deadlock_dt  
            ,tbl_vehicle.veh_group_code ,tbl_petrol.ptrl_group_code
            
            order by tbl_order.deadlock_dt asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    for (var xveh = 0; xveh <= tbl_temporary.data.length - 1; xveh++) {

                        script = `select tbl_vehicle_type.veh_type_desc from tbl_petrol_vehicle_type 
                        left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code
                        where ptrl_code = '${tbl_temporary.data[xveh].ptrl_code}' 
                        and tbl_vehicle_type.veh_type_flag = '1' and tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1'`

                        let tbl_temporary01 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary01.code) {
                            var vehicle_type_desc = '';
                            for (var xrr = 0; xrr <= tbl_temporary01.data.length - 1; xrr++) {
                                if (vehicle_type_desc == '') {
                                    vehicle_type_desc = tbl_temporary01.data[xrr].veh_type_desc;
                                }
                                else {
                                    vehicle_type_desc += '/' + tbl_temporary01.data[xrr].veh_type_desc;
                                }

                                if (xrr == tbl_temporary01.data.length - 1) {
                                    tbl_temporary.data[xveh].ptrl_vehicle_type_desc = vehicle_type_desc;
                                }
                            }
                        }
                        else {
                            tbl_temporary.data[xveh].ptrl_vehicle_type_desc = 'ไม่ระบุ';
                        }

                        //depot primary
                        script = `select tbl_petrol_depot.dpo_code, tbl_depot.dpo_desc, tbl_petrol_depot.ptrl_depot_status 
                        from tbl_petrol_depot
                        left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code
                        where ptrl_code = '${tbl_temporary.data[xveh].ptrl_code}' and tbl_petrol_depot.ptrl_depot_flag = '1'
                        order by tbl_petrol_depot.ptrl_depot_status asc`

                        let tbl_temporary02 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary02.code) {
                            var dpo_desc = '';
                            for (var xrr = 0; xrr <= tbl_temporary02.data.length - 1; xrr++) {
                                if (dpo_desc == '') {
                                    dpo_desc = '' + tbl_temporary02.data[xrr].dpo_desc;
                                }
                                else {
                                    dpo_desc += '\r\n' + tbl_temporary02.data[xrr].dpo_desc;
                                }

                                if (xrr == tbl_temporary02.data.length - 1) {
                                    tbl_temporary.data[xveh].dpo_desc = dpo_desc;
                                }
                            }
                        }
                        else {
                            tbl_temporary.data[xveh].dpo_desc = 'ไม่ระบุ';
                        }
                    }

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (ord_code.toString().toUpperCase() != 'ALL' && suggestion != '1') {
                        script = `
                        select ceil((ceil(sum(rows_total)) / 10)) as page_total,sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                        left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                        and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                        where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
                    }
                    else {
                        script = `
                        select ceil((ceil(sum(rows_total)) / 10)) as page_total,sum(rows_total) as rows_total  
                        from (select 1 as rows_total from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1' 
                        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
                        left join tbl_petrol_depot on tbl_petrol_depot.ptrl_code = tbl_order_petrol.ptrl_code 
                        and tbl_order_depot.dpo_code = tbl_petrol_depot.dpo_code 
                        where tbl_order.ord_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.off_code = '${off_code}' `
                    }

                    if (ord_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ord_status = '${ord_status}' `
                    }

                    if (ord_type_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
                    }

                    if (search != '') {
                        script += ` and (tbl_order.shipments_code like '%${search}%' 
                        or tbl_order.transport_code like '%${search}%' 
                        or tbl_order.tour_code like '%${search}%' 
                        or tbl_order.number like '%${search}%' 
                        or tbl_order.document_reference like '%${search}%' 
                        or tbl_petrol.ptrl_number like '%${search}%' 
                        or tbl_petrol.ptrl_desc like '%${search}%' 
                        or tbl_order_type.ord_type_desc like '%${search}%')`
                    }

                    if (ord_missing_latlng == '1') {
                        script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0) or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
                    }

                    if (dpo_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
                    }

                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
                    }

                    if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
                    }

                    if (suggestion == '1') {
                        script += `and tbl_order_petrol.ptrl_code in (select ptrl_merge_code as ptrl_code from tbl_petrol_merge_job 
                        left join tbl_order_petrol on tbl_petrol_merge_job.ptrl_code = tbl_order_petrol.ptrl_code
                        where tbl_order_petrol.ord_code = '${ord_code}'

                        union 

                        select distinct tbl_order_petrol.ptrl_code from tbl_order_petrol
                        where tbl_order_petrol.ord_code = '${ord_code}') `
                    }

                    if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}' `
                    }
                    if (veh_group_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}' `
                    }

                    script += ` 
                    group by
                    tbl_order.ord_code, tbl_order.gsap_order_number ,tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                    tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                    tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number,
                    tbl_petrol.ptrl_desc, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                    tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                    tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code, 
                    tbl_order.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, tbl_depot.dpo_number, tbl_depot.dpo_desc, 
                    tbl_petrol_depot.ptrl_depot_status, tbl_petrol.ptrl_remark, tbl_order.deadlock_dt) xtbl_master `

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getOrderItemInformationformanagePlan = async (req, res, next) => {


    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = `select tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc,
                   case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
                   case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
                   case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
                   case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
                   case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
                   case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
                   tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
                   tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
                   tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
                   tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc,
                   case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
                   case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
                   case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
                   case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
                   case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
                   case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
                   tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt, tbl_order_item.rm_dt, tbl_order_item.ptrl_tank_code, tbl_petrol_tank.tnk_number
                   ,tbl_order.shipments_code
                   ,tbl_order_petrol.deadlock_dt
                   ,tbl_petrol_tank.tnk_capacity
                   ,tbl_petrol_tank.tnk_target
                   ,tbl_petrol_tank.tnk_deadstock
                   ,tbl_order_item.item_quantity as expected_quantity
                   ,tbl_order_petrol.book_stock
                   ,tbl_order_petrol.book_stock_dt
                   ,tbl_order_petrol.average_daily_sales
                  ,tbl_petrol_group.ptrl_group_desc 
                   from tbl_order_item
                   left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                   left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code
                   left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
                   left join tbl_order_depot on tbl_order_item.ord_code = tbl_order_depot.ord_code
                   left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
                   left join tbl_order_petrol on tbl_order_item.ord_code = tbl_order_petrol.ord_code
                   and tbl_order_item.itm_code = tbl_order_petrol.itm_code
                   and tbl_order_item.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
                   left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                   left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
                   left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                   and tbl_petrol_tank.ptrl_tank_code = tbl_order_item.ptrl_tank_code
                   left join tbl_order on tbl_order_item.ord_code = tbl_order.ord_code

                   where tbl_order.ord_code = '${ord_code}' and tbl_order_depot.dpo_code != '' and tbl_order_depot.dpo_code is not null `;

            script += ` group by
                   tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, tbl_depot.dpo_address,
                   tbl_order_depot.dpo_address,tbl_depot.dpo_zip_code,tbl_order_depot.dpo_zip_code,tbl_depot.dpo_country_code,tbl_order_depot.dpo_country_code,
                   tbl_depot.dpo_lat, tbl_order_depot.dpo_lat, tbl_depot.dpo_lon, tbl_order_depot.dpo_lon, tbl_order_depot.dpo_city, tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
                   tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
                   tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
                   tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc,
                   tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code,tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon,
                   tbl_order_petrol.ptrl_address, tbl_order_petrol.ptrl_zip_code,tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon,
                   tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt,
                   tbl_order_item.rm_dt, tbl_depot.dpo_city, tbl_petrol.ptrl_city, tbl_order_item.ptrl_tank_code, tbl_petrol_tank.tnk_number
                   
                   ,tbl_order.shipments_code
                   ,tbl_order_petrol.deadlock_dt
                   ,tbl_petrol_tank.tnk_capacity
                   ,tbl_petrol_tank.tnk_target
                   ,tbl_petrol_tank.tnk_deadstock
                   ,tbl_order_item.item_quantity
                   ,tbl_order_petrol.book_stock
                   ,tbl_order_petrol.book_stock_dt
                   ,tbl_order_petrol.average_daily_sales
                   ,tbl_petrol_group.ptrl_group_desc
   
                 
                   order by tbl_order_item.ord_item_code asc `;

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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}
exports.getOrderItemInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || action == undefined) {
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
            script = `select tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
            tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
            tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
            tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
            tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address, 
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code, 
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code, 
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat, 
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
            tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt, tbl_order_item.rm_dt
            from tbl_order_item 
            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
            left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
            left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code 
            left join tbl_order_depot on tbl_order_item.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            left join tbl_order_petrol on tbl_order_item.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code 
            where tbl_order_item.ord_code = '${ord_code}'
            and tbl_order_item.ord_item_flag = '1' and tbl_order_depot.ord_depot_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1' 
            and tbl_petrol.ptrl_code is not null and tbl_order_depot.dpo_code != '' and tbl_order_depot.dpo_code is not null 

            group by 
            tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, tbl_depot.dpo_address,
            tbl_order_depot.dpo_address,tbl_depot.dpo_zip_code,tbl_order_depot.dpo_zip_code,tbl_depot.dpo_country_code,tbl_order_depot.dpo_country_code,
            tbl_depot.dpo_lat, tbl_order_depot.dpo_lat, tbl_depot.dpo_lon, tbl_order_depot.dpo_lon, tbl_order_depot.dpo_city, tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
            tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
            tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
            tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code,tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_address, tbl_order_petrol.ptrl_zip_code,tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt, 
            tbl_order_item.rm_dt, tbl_depot.dpo_city, tbl_petrol.ptrl_city`;

            script += ` order by tbl_order_item.ord_item_code asc `

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getOrderDepotInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || action == undefined) {
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
            script = `select tbl_order.ord_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
            tbl_depot.dpo_loading_minute, tbl_order.ist_dt, tbl_order.mdf_dt, 
            tbl_order.rm_dt
            from tbl_order
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

            group by tbl_order.ord_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            tbl_depot.dpo_address,tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code, tbl_depot.dpo_lat, tbl_depot.dpo_lon, 
            tbl_order_depot.dpo_address,tbl_order_depot.dpo_zip_code, tbl_order_depot.dpo_country_code, tbl_order_depot.dpo_lat, tbl_order_depot.dpo_lon, 
            tbl_depot.dpo_loading_minute, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order_depot.dpo_city, tbl_depot.dpo_city, 
            tbl_order.rm_dt`;

            script += ` order by tbl_order.ord_code asc `

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getOrderPetrolInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || action == undefined) {
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
            script = `select tbl_order.ord_code, tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, 
            tbl_petrol.rm_dt
            from tbl_order
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'

            group by tbl_order.ord_code, tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_address,tbl_order_petrol.ptrl_zip_code, tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_city, 
            tbl_petrol.rm_dt`;

            script += ` order by tbl_order.ord_code asc `

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.removeVehicle = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            script = `update tbl_vehicle set veh_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_code = '${veh_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setConfirmedOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (ord_code.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `select 
            tbl_order.ord_code, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
            tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
            tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
            tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
            tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
            tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code,
            case when tbl_order.req_dt is null then '-1' 
            when shipments_code = '' or shipments_code is null then '-2' 
            when loading_count = 0 then '-3' 
            when unloading_count = 0 then '-4' 
            when item_count = 0 then '-5' 
            when tbl_order.item_quantity = 0 then '-6' 
            when tbl_order_depot.dpo_code is null or tbl_order_depot.dpo_code = '' then '-7' 
            when tbl_order_petrol.ptrl_code is null or tbl_order_petrol.ptrl_code = '' then '-8' 
            else 1 end as checked

            from tbl_order 
            left join tbl_order_type 
            on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1'
            where tbl_order.ord_flag = '1' and tbl_order.ord_status = '0' and tbl_order.ord_code in (${ord_code.map(number => `'${number}'`).toString()}) `

            // script = `update tbl_order set
            // mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            // ord_status = '1' 
            // where ord_code in (${ord_code.map(number => `'${number}'`).toString()});`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                var xresult = [];
                var xlist = [];
                if (tbl_temporary.data.length > 0) {

                    for (var xjob = 0; xjob <= tbl_temporary.data.length - 1; xjob++) {
                        if (tbl_temporary.data[xjob].checked.toString() == '1') {
                            script = `update tbl_order set mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', ord_status = '1'
                            where ord_code = '${tbl_temporary.data[xjob].ord_code.toString()}';`
                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                            if (!tbl_temporary0.code) {

                                if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                    xlist.push(tbl_temporary.data[xjob].shipments_code);
                                    xresult.push(
                                        {
                                            shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                            status: "success",
                                            reason: ""
                                        });
                                }
                            }
                            else {
                                var xreason = `บันทึกไม่สำเร็จ`;
                                if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                    xlist.push(tbl_temporary.data[xjob].shipments_code);
                                    xresult.push(
                                        {
                                            shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                            status: "error",
                                            reason: xreason
                                        });
                                }
                            }
                        }
                        else {
                            var xreason = `ไม่สำเร็จ`;

                            switch (tbl_temporary.data[xjob].checked) {
                                case "-1":
                                    xreason = `ไม่สำเร็จ, วันที่จัดส่งน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-2":
                                    xreason = `ไม่สำเร็จ, shipments_code ไม่ถูกต้อง`;
                                    break;
                                case "-3":
                                    xreason = `ไม่สำเร็จ, ไม่พบสถานที่คลังน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-4":
                                    xreason = `ไม่สำเร็จ, ไม่พบสถานที่จัดส่งน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-5":
                                    xreason = `ไม่สำเร็จ, วันที่จัดส่งน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-6":
                                    xreason = `ไม่สำเร็จ, ข้อมูลน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-7":
                                    xreason = `ไม่สำเร็จ, ไม่พบสถานที่คลังน้ำมันไม่ถูกต้อง`;
                                    break;
                                case "-8":
                                    xreason = `ไม่สำเร็จ, ไม่พบสถานที่จัดส่งน้ำมันไม่ถูกต้อง`;
                                    break;
                            }

                            if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                xlist.push(tbl_temporary.data[xjob].shipments_code);
                                xresult.push(
                                    {
                                        shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                        status: "error",
                                        reason: xreason
                                    });
                            }
                        }

                        if (xjob == tbl_temporary.data.length - 1) {
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: xresult,
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                            return;
                        }
                    }
                }
                else {
                    var xresult = [];
                    if (ord_code.length >= 0) {
                        for (var ord = 0; ord <= ord_code.length - 1; ord++) {
                            xresult.push(
                                {
                                    shipments_code: ord_code[ord].toString(),
                                    status: "error",
                                    reason: "ไม่พบข้อมูล Order"
                                });

                            if (ord == ord_code.length - 1) {
                                let response = [{
                                    status: 'success',
                                    invalid_code: '0',
                                    message: '',
                                    data: xresult,
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]

                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สำเร็จ', action[0].value);
                                return;
                            }
                        }
                    }
                    else {
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: xresult,
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สำเร็จ', action[0].value);
                        return;
                    }
                }

            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setAssignJobsOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            dver_code,
            veh_code,
            item,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined || dver_code == undefined || veh_code == undefined || item == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (item.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            ord_status = '2', 
            dver_code = '${dver_code}',
            veh_code = '${veh_code}'
            where ord_code = '${ord_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                debugger
                for (var itm = 0; itm <= item.length - 1; itm++) {

                    let ord_veh_compartment_code = 'ovhc-' + moment().format('x');
                    script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity, 
                    ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code) 
                    values ('${ord_veh_compartment_code}', '${ord_code}', '${item[itm].itm_code}', '${item[itm].itm_unit_code}', ${item[itm].item_quantity}, '1', 
                    '${moment().format('YYYY-MM-DD HH:mm:ss')}', NULL, NULL, '${item[itm].veh_compartment_code}');`

                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    debugger
                    if (itm == item.length - 1) {
                        //debugger
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        var xtmp_status = await xglobal.postOrder2Tmp(lic_code, ord_code);

                        if (xtmp_status == true) {
                            await xglobal.action_logs(lic_code, action[0].id, ord_code + ' TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                        }
                        else {
                            await xglobal.action_logs(lic_code, action[0].id, ord_code + ' TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                        }

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                        return;
                    }
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setCancelJobsOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            ord_status = '1', 
            dver_code = NULL,
            veh_code = NULL,
            transporeon_status = 'N' 
            where ord_code = '${ord_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `update tbl_order_compartment 
                set ord_veh_compartment_flag = '0',
                rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                where ord_code = '${ord_code}';`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary0.code) {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.a
                }

            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setCanceldOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (ord_code.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
            ord_status = '0' 
            where ord_code in (${ord_code.map(number => `'${number}'`).toString()});`

            script = script.replace(/'NULL'/gi, "NULL")
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกตรวจสอบ Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            cus_code,
            shipments_code,
            transport_code,
            tour_code,
            pull_code,
            number,
            document_reference,
            plant,
            assigned_carrier_id,
            assigned_carrier_name,
            assigned_creditor_number,
            assigned_carrier_number,
            ord_dt,
            req_dt,
            ord_comment,
            ord_customer_code,
            ord_customer_name,
            ord_customer_number,
            gsap_order_type_code,
            gsap_order_status,
            ord_type_code,
            transporeon_status,
            loading,
            unloading,
            item,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (cus_code == undefined || shipments_code == undefined || transport_code == undefined
            || tour_code == undefined || pull_code == undefined || number == undefined || document_reference == undefined
            || plant == undefined || assigned_carrier_id == undefined || assigned_carrier_name == undefined || assigned_creditor_number == undefined
            || assigned_carrier_number == undefined || ord_dt == undefined || req_dt == undefined
            || ord_comment == undefined || ord_customer_code == undefined || ord_customer_name == undefined || ord_customer_number == undefined
            || gsap_order_type_code == undefined || gsap_order_status == undefined || ord_type_code == undefined
            || transporeon_status == undefined || loading == undefined || unloading == undefined || item == undefined || off_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {
            let script = ``;
            var loading_count = 0;
            var unloading_count = 0;
            var item_count = 0;
            var item_quantity = 0;

            if (loading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                loading_count = loading.length;
            }

            if (unloading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                unloading_count = unloading.length;
            }

            if (item.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                item_count = item.length;
            }

            script = `select ord_code from tbl_order where (shipments_code = '${shipments_code}') and ord_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูล Shipments Code ซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูล Shipments Code ซ้ำ', action[0].value);
                    return;
                }
            }

            let ord_code = 'odr-' + moment().format('x');
            script = `insert into tbl_order 
            (ord_code, shipments_code, cus_code, transport_code, tour_code, pull_code, number, document_reference, plant, assigned_carrier_id, assigned_carrier_name, assigned_creditor_number,
            assigned_carrier_number, ord_dt, req_dt, ord_comment, ord_customer_code, ord_customer_name, ord_customer_number, gsap_order_type_code, gsap_order_status, ord_type_code, transporeon_status,
            loading_count, unloading_count, item_count, item_quantity, off_code, ist_dt, ord_flag) 
            values 
            ('${ord_code}','${shipments_code}', '${cus_code}','${transport_code}','${tour_code}','${pull_code}','${number}','${document_reference}','${plant}','${assigned_carrier_id}','${assigned_carrier_name}','${assigned_creditor_number}',
            '${assigned_carrier_number}','${ord_dt}','${req_dt}','${ord_comment}','${ord_customer_code}','${ord_customer_name}','${ord_customer_number}','${gsap_order_type_code}','${gsap_order_status}','${ord_type_code}',
            '${transporeon_status}',${loading_count},${unloading_count},${item_count},${item_quantity},'${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        ord_code: ord_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addOrderInformationWithPreEvent = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            shipments_code,
            transport_code,
            tour_code,
            pull_code,
            number,
            document_reference,
            plant,
            assigned_carrier_id,
            assigned_carrier_name,
            assigned_creditor_number,
            assigned_carrier_number,
            ord_dt,
            req_dt,
            ord_comment,
            ord_customer_code,
            ord_customer_name,
            ord_customer_number,
            gsap_order_type_code,
            gsap_order_status,
            transporeon_status,
            loading,
            unloading,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (shipments_code == undefined || transport_code == undefined
            || tour_code == undefined || pull_code == undefined || number == undefined || document_reference == undefined
            || plant == undefined || assigned_carrier_id == undefined || assigned_carrier_name == undefined || assigned_creditor_number == undefined
            || assigned_carrier_number == undefined || ord_dt == undefined || req_dt == undefined
            || ord_comment == undefined || ord_customer_code == undefined || ord_customer_name == undefined || ord_customer_number == undefined
            || gsap_order_type_code == undefined || gsap_order_status == undefined
            || transporeon_status == undefined || loading == undefined || unloading == undefined || off_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {
            let script = ``;
            var loading_count = 0;
            var unloading_count = 0;
            var item_count = 0;
            var item_quantity = 0;
            let ord_code = 'odr-' + moment().format('x');

            script = `select ord_code from tbl_order where (shipments_code = '${shipments_code}') and ord_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    var script001 = `select case when max(shipments_code) is null then '000001' 
                    else LPAD((replace(max(shipments_code),'','') :: integer + 1) :: text,6,'0') end as shipments_code
                    from tbl_order where ord_type_code in ('otyp-9999999999997', 'otyp-9999999999996')`;

                    let tbl_temporary001 = await pgConn.get(dbPrefix + lic_code, script001, config.connectionString());

                    if (!tbl_temporary001.code) {
                        if (tbl_temporary001.data.length > 0) {
                            shipments_code = tbl_temporary001.data[0].shipments_code;
                        }
                        else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-4',
                                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูล Shipments Code ซ้ำ`,
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูล Shipments Code ซ้ำ', action[0].value);
                            return;
                        }
                    }
                }
            }

            if (loading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                loading_count = loading.length;
                for (var lad1 = 0; lad1 <= loading.length - 1; lad1++) {

                    var dpo_code = loading[lad1].dpo_code;
                    var loading_start_dt = loading[lad1].loading_start_dt;
                    var loading_end_dt = loading[lad1].loading_end_dt;
                    if (loading[lad1].item.length > 0) {
                        for (litem1 = 0; litem1 <= loading[lad1].item.length - 1; litem1++) {
                            var ord_depot_code = 'odpo-' + moment().format('x');
                            var itm_code = loading[lad1].item[litem1].itm_code;
                            var itm_unit_code = loading[lad1].item[litem1].itm_unit_code;
                            var item_quantity = parseFloat(loading[lad1].item[litem1].itm_quantity);

                            let script0 = `INSERT INTO public.tbl_order_depot 
                            (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt, loading_start_dt, loading_end_dt) 
                            values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${moment(loading_start_dt).format('YYYY-MM-DD HH:mm:ss')}',
                            '${moment(loading_end_dt).format('YYYY-MM-DD HH:mm:ss')}')`

                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                        }
                    }

                }
            }

            if (unloading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                unloading_count = unloading.length;
                for (var unlad1 = 0; unlad1 <= unloading.length - 1; unlad1++) {

                    var ptrl_code = unloading[unlad1].ptrl_code;
                    var unloading_start_dt = unloading[unlad1].unloading_start_dt;
                    var unloading_end_dt = unloading[unlad1].unloading_end_dt;
                    if (unloading[unlad1].tank.length > 0) {
                        for (tank1 = 0; tank1 <= unloading[unlad1].tank.length - 1; tank1++) {
                            var ord_petrol_code = 'optrl-' + moment().format('x');
                            var ptrl_tank_code = unloading[unlad1].tank[tank1].ptrl_tank_code;
                            var itm_code = unloading[unlad1].tank[tank1].itm_code;
                            var itm_unit_code = unloading[unlad1].tank[tank1].itm_unit_code;
                            var item_quantity = parseFloat(unloading[unlad1].tank[tank1].itm_quantity);

                            let script2 = `INSERT INTO public.tbl_order_petrol 
                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt, unloading_start_dt, unloading_end_dt) 
                            values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                            '${moment(req_dt).format('YYYY-MM-DD HH:mm:ss')}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}' ,'${moment(unloading_start_dt).format('YYYY-MM-DD HH:mm:ss')}','${moment(unloading_end_dt).format('YYYY-MM-DD HH:mm:ss')}')`
                            let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                            if (!tbl_temporary2.code) {
                                //add item
                                var ord_item_code = 'oitm-' + moment().format('x');
                                let script1 = `INSERT INTO public.tbl_order_item 
                                (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, ptrl_tank_code) 
                                values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}','${ptrl_tank_code}')`

                                let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                if (!tbl_temporary1.code) {
                                    debugger
                                }
                                else {
                                    debugger
                                }

                            }
                            else {
                                debugger
                            }
                        }
                    }

                }
            }

            script = `insert into tbl_order 
            (ord_code, shipments_code, transport_code, tour_code, pull_code, number, document_reference, plant, assigned_carrier_id, assigned_carrier_name, assigned_creditor_number,
            assigned_carrier_number, ord_dt, req_dt, ord_comment, ord_customer_code, ord_customer_name, ord_customer_number, gsap_order_type_code, gsap_order_status, ord_type_code, transporeon_status,
            loading_count, unloading_count, item_count, item_quantity, off_code, ist_dt, ord_flag, ord_status) 
            values 
            ('${ord_code}','${shipments_code}','${transport_code}','${tour_code}','${pull_code}','${number}','${document_reference}','${plant}','${assigned_carrier_id}','${assigned_carrier_name}','${assigned_creditor_number}',
            '${assigned_carrier_number}','${ord_dt}','${req_dt}','${ord_comment}','${ord_customer_code}','${ord_customer_name}','${ord_customer_number}','${gsap_order_type_code}','${gsap_order_status}','otyp-9999999999997',
            '${transporeon_status}',${loading_count},${unloading_count},${item_count},${item_quantity},'${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `update tbl_order 
                set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                where ord_code = '${ord_code}'`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary0.code) {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [{
                            ord_code: ord_code
                        }],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }


            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getOrderTMPStatusInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, start_date, end_date, ord_type_code, transporeon_status, dpo_code, ptrl_code, ord_missing_latlng, off_code,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || start_date == undefined || end_date == undefined
            || ord_type_code == undefined || transporeon_status == undefined || dpo_code == undefined || ptrl_code == undefined
            || ord_missing_latlng == undefined || search == undefined || action == undefined) {
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

            if (ord_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1'
                where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
            }
            else {
                script = `select 
                tbl_order.ord_code, tbl_order.gsap_order_number, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number as ord_customer_code,
                tbl_petrol.ptrl_desc as ord_customer_name, tbl_petrol.ptrl_number as ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code
                from tbl_order 
                left join tbl_order_type 
                on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1'
                where tbl_order.ord_flag = '1' `;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.off_code = '${off_code}' `
            }

            if (transporeon_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.transporeon_status = '${transporeon_status}' `
            }
            else {
                script += ` and tbl_order.transporeon_status in ('WA','A','D') `
            }

            if (ord_type_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
            }

            if (search != '') {
                script += ` and (tbl_order.shipments_code like '%${search}%' 
                or tbl_order.transport_code like '%${search}%' 
                or tbl_order.tour_code like '%${search}%' 
                or tbl_order.number like '%${search}%' 
                or tbl_order.document_reference like '%${search}%' 
                or tbl_petrol.ptrl_number like '%${search}%' 
                or tbl_petrol.ptrl_desc like '%${search}%' 
                or tbl_order_type.ord_type_desc like '%${search}%')`
            }

            if (ord_missing_latlng == '1') {
                script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0)
                or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
            }

            if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
            }

            script += ` 
            group by
            tbl_order.ord_code, tbl_order.gsap_order_number ,tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
            tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
            tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_petrol.ptrl_number,
            tbl_petrol.ptrl_desc, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
            tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
            tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity, tbl_depot.dpo_code, tbl_petrol.ptrl_code 
            
            order by tbl_order.shipments_code asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (ord_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(tbl_order.ord_code)) / ${page_limit})) as page_total, (count(tbl_order.ord_code)) as rows_total 
                        from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1'
                        where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}' `;
                    }
                    else {
                        script = `select ceil((ceil(count(tbl_order.ord_code)) / ${page_limit})) as page_total, (count(tbl_order.ord_code)) as rows_total 
                        from tbl_order 
                        left join tbl_order_type 
                        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code and tbl_order_depot.ord_depot_flag = '1'
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code and tbl_order_petrol.ord_petrol_flag = '1' 
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code and tbl_petrol.ptrl_flag = '1'
                        where tbl_order.ord_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.off_code = '${off_code}' `
                    }

                    if (transporeon_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.transporeon_status = '${transporeon_status}' `
                    }
                    else {
                        script += ` and tbl_order.transporeon_status in ('WA','A','D') `
                    }

                    if (ord_type_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.ord_type_code = '${ord_type_code}' `
                    }

                    if (search != '') {
                        script += ` and (tbl_order.shipments_code like '%${search}%' 
                        or tbl_order.transport_code like '%${search}%' 
                        or tbl_order.tour_code like '%${search}%' 
                        or tbl_order.number like '%${search}%' 
                        or tbl_order.document_reference like '%${search}%' 
                        or tbl_petrol.ptrl_number like '%${search}%' 
                        or tbl_order.ord_customer_name like '%${search}%' 
                        or tbl_order.ord_customer_number like '%${search}%'
                        or tbl_order_type.ord_type_desc like '%${search}%')`
                    }

                    if (ord_missing_latlng == '1') {
                        script += ` and ((tbl_petrol.ptrl_code is null or tbl_petrol.ptrl_lat = 0.0 or tbl_petrol.ptrl_lon = 0.0)
                        or (tbl_depot.dpo_code is null or tbl_depot.dpo_lat = 0.0 or tbl_depot.dpo_lon = 0.0)) `
                    }

                    if (dpo_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
                    }

                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order_petrol.ptrl_code = '${ptrl_code}' `
                    }

                    if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_order.req_dt >= '${start_date}' and tbl_order.req_dt <= '${end_date}'`
                    }

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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.setAceptOrderTMPStatusInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
            transporeon_status = 'A' 
            where ord_code = '${ord_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
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

                var xtmp_status = await xglobal.postAcceptOrder2Tmp(lic_code, ord_code);

                if (xtmp_status == true) {
                    await xglobal.action_logs(lic_code, action[0].id, ord_code + ' Accept TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                }
                else {
                    await xglobal.action_logs(lic_code, action[0].id, ord_code + ' Accept TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                }

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setDeclineOrderTMPStatusInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            action
        } = req.body[0];

        if (ord_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
            transporeon_status = 'D' 
            where ord_code = '${ord_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
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

                var xtmp_status = await xglobal.postDeclineOrder2Tmp(lic_code, ord_code);

                if (xtmp_status == true) {
                    await xglobal.action_logs(lic_code, action[0].id, ord_code + ' Decline TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                }
                else {
                    await xglobal.action_logs(lic_code, action[0].id, ord_code + ' Decline TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                }

                res.status(200).send(response);


                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addOrderUploadInformationWithPreEvent = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            orders,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (orders == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {
            let script = ``;

            for (var xr = 0; xr <= orders.length - 1; xr) {
                let ord_code = 'odr-' + moment().format('x');


            }

            script = `select ord_code from tbl_order where (shipments_code = '${shipments_code}') and ord_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    var script001 = `select case when max(shipments_code) is null then '000001' 
                    else LPAD((replace(max(shipments_code),'','') :: integer + 1) :: text,6,'0') end as shipments_code
                    from tbl_order where ord_type_code in ('otyp-9999999999997', 'otyp-9999999999996')`;

                    let tbl_temporary001 = await pgConn.get(dbPrefix + lic_code, script001, config.connectionString());

                    if (!tbl_temporary001.code) {
                        if (tbl_temporary001.data.length > 0) {
                            shipments_code = tbl_temporary001.data[0].shipments_code;
                        }
                        else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-4',
                                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูล Shipments Code ซ้ำ`,
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูล Shipments Code ซ้ำ', action[0].value);
                            return;
                        }
                    }
                }
            }

            if (loading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง loading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                loading_count = loading.length;
                for (var lad1 = 0; lad1 <= loading.length - 1; lad1++) {

                    var dpo_code = loading[lad1].dpo_code;
                    var loading_start_dt = loading[lad1].loading_start_dt;
                    var loading_end_dt = loading[lad1].loading_end_dt;
                    if (loading[lad1].item.length > 0) {
                        for (litem1 = 0; litem1 <= loading[lad1].item.length - 1; litem1++) {
                            var ord_depot_code = 'odpo-' + moment().format('x');
                            var itm_code = loading[lad1].item[litem1].itm_code;
                            var itm_unit_code = loading[lad1].item[litem1].itm_unit_code;
                            var item_quantity = parseFloat(loading[lad1].item[litem1].itm_quantity);

                            let script0 = `INSERT INTO public.tbl_order_depot 
                            (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt, loading_start_dt, loading_end_dt) 
                            values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${moment(loading_start_dt).format('YYYY-MM-DD HH:mm:ss')}',
                            '${moment(loading_end_dt).format('YYYY-MM-DD HH:mm:ss')}')`

                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                        }
                    }

                }
            }

            if (unloading.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง unloading ไม่รองรับค่าว่าง', action[0].value);
                return;
            }
            else {
                unloading_count = unloading.length;
                for (var unlad1 = 0; unlad1 <= unloading.length - 1; unlad1++) {

                    var ptrl_code = unloading[unlad1].ptrl_code;
                    var unloading_start_dt = unloading[unlad1].unloading_start_dt;
                    var unloading_end_dt = unloading[unlad1].unloading_end_dt;
                    if (unloading[unlad1].tank.length > 0) {
                        for (tank1 = 0; tank1 <= unloading[unlad1].tank.length - 1; tank1++) {
                            var ord_petrol_code = 'optrl-' + moment().format('x');
                            var ptrl_tank_code = unloading[unlad1].tank[tank1].ptrl_tank_code;
                            var itm_code = unloading[unlad1].tank[tank1].itm_code;
                            var itm_unit_code = unloading[unlad1].tank[tank1].itm_unit_code;
                            var item_quantity = parseFloat(unloading[unlad1].tank[tank1].itm_quantity);

                            let script2 = `INSERT INTO public.tbl_order_petrol 
                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt, unloading_start_dt, unloading_end_dt) 
                            values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                            '${moment(req_dt).format('YYYY-MM-DD HH:mm:ss')}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}' ,'${moment(unloading_start_dt).format('YYYY-MM-DD HH:mm:ss')}','${moment(unloading_end_dt).format('YYYY-MM-DD HH:mm:ss')}')`
                            let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                            if (!tbl_temporary2.code) {
                                //add item
                                var ord_item_code = 'oitm-' + moment().format('x');
                                let script1 = `INSERT INTO public.tbl_order_item 
                                (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, ptrl_tank_code) 
                                values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}','${ptrl_tank_code}')`

                                let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                if (!tbl_temporary1.code) {
                                    debugger
                                }
                                else {
                                    debugger
                                }

                            }
                            else {
                                debugger
                            }
                        }
                    }

                }
            }

            script = `insert into tbl_order 
            (ord_code, shipments_code, transport_code, tour_code, pull_code, number, document_reference, plant, assigned_carrier_id, assigned_carrier_name, assigned_creditor_number,
            assigned_carrier_number, ord_dt, req_dt, ord_comment, ord_customer_code, ord_customer_name, ord_customer_number, gsap_order_type_code, gsap_order_status, ord_type_code, transporeon_status,
            loading_count, unloading_count, item_count, item_quantity, off_code, ist_dt, ord_flag, ord_status) 
            values 
            ('${ord_code}','${shipments_code}','${transport_code}','${tour_code}','${pull_code}','${number}','${document_reference}','${plant}','${assigned_carrier_id}','${assigned_carrier_name}','${assigned_creditor_number}',
            '${assigned_carrier_number}','${ord_dt}','${req_dt}','${ord_comment}','${ord_customer_code}','${ord_customer_name}','${ord_customer_number}','${gsap_order_type_code}','${gsap_order_status}','otyp-9999999999997',
            '${transporeon_status}',${loading_count},${unloading_count},${item_count},${item_quantity},'${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `update tbl_order 
                set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                where ord_code = '${ord_code}'`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary0.code) {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [{
                            ord_code: ord_code
                        }],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }


            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}