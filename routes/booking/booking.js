const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================================
// API ดึงข้อมูลการจอง (Get Booking Information)
// =========================================================================
exports.getBookingInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            booking_code = 'ALL', action, page_index = 1, page_limit = 10
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
        const conditions = ["booking.rm_dt IS NULL"];

        if (String(booking_code).toUpperCase() !== 'ALL') conditions.push(`booking_code = '${booking_code}'`);

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                booking.booking_code, 
                booking.vehicle_code, 
                booking.driver_code, 
                booking.origin_id, 
                booking.dest_id,
                vehicle.vehicle_name,
                travel_type.travel_type_desc,
                driver.driver_fname || ' ' || driver.driver_lname as driver_name,
                origin.station_name as origin_name,
                dest.station_name as dest_name,
                booking.trip_purpose, 
                booking.start_datetime, 
                booking.end_datetime, 
                booking.ist_dt,
                booking.booking_status,
                usr_agg.booking_users_list as booking_users,
                stop_agg.booking_stops_list as booking_stops,
                tbl_u.booking_users as user_reserve
            FROM tbl_booking booking
            LEFT JOIN tbl_vehicle vehicle ON booking.vehicle_code = vehicle.vehicle_code
            LEFT JOIN tbl_driver driver ON booking.driver_code = driver.driver_code
            LEFT JOIN tbl_station origin ON booking.origin_id = origin.station_id
            LEFT JOIN tbl_station dest ON booking.dest_id = dest.station_id
            LEFT JOIN tbl_travel_type travel_type ON booking.travel_type_code = travel_type.travel_type_code
            LEFT JOIN (
             SELECT user_code ,JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'code' , tbl_u.user_code,
                    'name' , tbl_u.name
                )
             ) as booking_users
             FROM tbl_users tbl_u
             GROUP BY tbl_u.user_code
            ) tbl_u ON tbl_u.user_code = booking.user_code
            LEFT JOIN (
                SELECT 
                    tbl_booking_users.booking_code, 
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'code' , tbl_booking_users.user_code,
                            'name' , users.name
                        )
                    ) as booking_users_list
                FROM tbl_booking_users 
                LEFT JOIN tbl_users users ON tbl_booking_users.user_code = users.user_code
                GROUP BY tbl_booking_users.booking_code
            ) usr_agg ON usr_agg.booking_code = booking.booking_code
             LEFT JOIN (
                SELECT 
                    tbl_booking_stop.booking_code, 
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'station_name' , tbl_station.station_name,
                            'stop_seq' , tbl_booking_stop.stop_seq,
                            'stop_type', tbl_booking_stop.stop_type
                        )
                    ) as booking_stops_list
                FROM tbl_booking_stop 
                LEFT JOIN tbl_station ON tbl_booking_stop.station_id = tbl_station.station_id
                GROUP BY tbl_booking_stop.booking_code
            ) stop_agg ON stop_agg.booking_code = booking.booking_code
            
            ${whereClause}
            ORDER BY booking.ist_dt DESC 
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
                COUNT(booking.booking_code) as rows_total,
                CEIL(COUNT(booking.booking_code)::float / ${page_limit}) as page_total
            FROM tbl_booking booking
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
// API เพิ่มข้อมูลการจอง (Add Booking Information)
// =========================================================================
exports.addBookingInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            booking_data,
            booking_users = [],
            booking_stops = [],
            action
        } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!booking_data) missing.push('booking_data');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const {
            vehicle_code,
            driver_code,
            start_datetime,
            end_datetime,
            trip_purpose,
            user_code,
            travel_type_code,
            reserve_user
        } = booking_data;

        // ดึง origin_id และ dest_id จาก booking_stops
        let origin_id = null;
        let dest_id = null;

        if (booking_stops.length > 0) {
            const origin_stop = booking_stops.find(stop => stop.stop_type === 'Origin');
            const dest_stop = booking_stops.find(stop => stop.stop_type === 'Destination');
            if (origin_stop) origin_id = origin_stop.station_id;
            if (dest_stop) dest_id = dest_stop.station_id;
        }

        let transactionResult = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {
            const booking_code = 'BKG-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
            const now = moment().format('YYYY-MM-DD HH:mm:ss');

            // ========= เพิ่มข้อมูลการจอง tbl_booking =========
            const bookingScript = `
                INSERT INTO tbl_booking 
                (
                    booking_code, vehicle_code, driver_code, origin_id, dest_id, 
                    start_datetime, end_datetime, trip_purpose, ist_dt, 
                    booking_flag, booking_status, user_code, travel_type_code
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
            `;
            const bookingParams = [
                booking_code, vehicle_code, driver_code, origin_id, dest_id,
                start_datetime, end_datetime, trip_purpose, now,
                1, 0, user_code, travel_type_code
            ];

            const resBooking = await pgConn.executeWithClient(client, bookingScript, bookingParams);
            if (resBooking.code) throw new Error("ไม่สามารถบันทึกข้อมูลการจองได้");

            // ========= เพิ่มข้อมูลผู้ร่วมเดินทาง tbl_booking_user =========
            if (Array.isArray(booking_users) && booking_users.length > 0) {
                for (const user_code of booking_users) {
                    const userScript = `INSERT INTO tbl_booking_users (booking_code, user_code, ist_dt) VALUES ($1, $2, $3);`;
                    const resUser = await pgConn.executeWithClient(client, userScript, [booking_code, user_code, now]);
                    if (resUser.code) throw new Error(`ไม่สามารถบันทึกข้อมูลผู้ร่วมเดินทางได้ (${user_code})`);
                }
            }

            // ========= เพิ่มข้อมูลจุดแวะพัก tbl_booking_stop =========
            if (Array.isArray(booking_stops) && booking_stops.length > 0) {
                for (const [index, stop] of booking_stops.entries()) {
                    const stop_seq = index + 1;
                    const stop_code = 'STP-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
                    const stopScript = `
                        INSERT INTO tbl_booking_stop 
                        (booking_stop_code, booking_code, station_id, stop_type, est_arrive_time, ist_dt, remark, stop_seq) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                    `;
                    const stopParams = [
                        stop_code, booking_code, stop.station_id, stop.stop_type, stop.est_arrive_time, now, stop.remark, stop_seq
                    ];
                    const resStop = await pgConn.executeWithClient(client, stopScript, stopParams);
                    if (resStop.code) throw new Error(`ไม่สามารถบันทึกข้อมูลจุดแวะพักได้ (${stop.station_id})`);
                }
            }

            return { booking_code };

        }, config.connectionString());

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลการจอง', JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลการจอง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลการจองสำเร็จ', [transactionResult.data]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// =========================================================================
// API อนุมัติข้อมูลการจอง (Approve Booking Information)
// =========================================================================
exports.setBookingInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            booking_code,
            booking_status,
            action
        } = req.body[0] || {};

        const booking_codeArr = Array.isArray(booking_code) ? booking_code : [booking_code];
        const booking_codeIn = booking_codeArr.map(c => `'${c}'`).join(', ');

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!booking_code || booking_codeArr.length === 0) missing.push('booking_code');
        if (!booking_status) missing.push('booking_status');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ไม่สามารถบันทึกข้อมูล,  เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`);
        }

        const script = `
            UPDATE tbl_booking 
            SET booking_status = $1, mdf_dt = $2::timestamp
            WHERE booking_code IN (${booking_codeIn});
        `;
        const params = [booking_status, moment().format('YYYY-MM-DD HH:mm:ss')];

        const result = await pgConn.execute2params(script, params);

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'อนุมัติข้อมูลการจอง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ');
        }

        // ดึงข้อมูลที่อัปเดตแล้วส่งกลับไปด้วย พร้อมรายละเอียดต่างๆ
        const getScript = `
            SELECT 
                booking.booking_code, 
               
                booking.booking_status,
                usr_agg.booking_users_list as booking_users,
                stop_agg.booking_stops_list as booking_stops,
                tbl_u.booking_users as user_reserve
            FROM tbl_booking booking
            LEFT JOIN tbl_vehicle vehicle ON booking.vehicle_code = vehicle.vehicle_code
            LEFT JOIN tbl_driver driver ON booking.driver_code = driver.driver_code
            LEFT JOIN tbl_station origin ON booking.origin_id = origin.station_id
            LEFT JOIN tbl_station dest ON booking.dest_id = dest.station_id
            LEFT JOIN tbl_travel_type travel_type ON booking.travel_type_code = travel_type.travel_type_code
            LEFT JOIN tbl_users tbl_user ON booking.user_code = tbl_user.user_code
            LEFT JOIN (
             SELECT user_code ,JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'code' , tbl_u.user_code,
                    'name' , tbl_u.name
                )
             ) as booking_users
             FROM tbl_users tbl_u
             GROUP BY tbl_u.user_code
            ) tbl_u ON tbl_u.user_code = booking.user_code
            LEFT JOIN (
                SELECT 
                    tbl_booking_users.booking_code, 
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'code' , tbl_booking_users.user_code,
                            'name' , users.name
                        )
                    ) as booking_users_list
                FROM tbl_booking_users 
                LEFT JOIN tbl_users users ON tbl_booking_users.user_code = users.user_code
                GROUP BY tbl_booking_users.booking_code
            ) usr_agg ON usr_agg.booking_code = booking.booking_code
             LEFT JOIN (
                SELECT 
                    tbl_booking_stop.booking_code, 
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'station_name' , tbl_station.station_name,
                            'stop_seq' , tbl_booking_stop.stop_seq,
                            'stop_type', tbl_booking_stop.stop_type
                        )
                    ) as booking_stops_list
                FROM tbl_booking_stop 
                LEFT JOIN tbl_station ON tbl_booking_stop.station_id = tbl_station.station_id
                GROUP BY tbl_booking_stop.booking_code
            ) stop_agg ON stop_agg.booking_code = booking.booking_code
            WHERE booking.booking_code IN (${booking_codeIn});
        `;
        const getResult = await pgConn.get(dbPrefix + lic_code, getScript, config.connectionString());
        let updatedData = [];
        if (!getResult.code && getResult.data.length > 0) {
            updatedData = JSON.parse(JSON.stringify(getResult.data).replace(/\:null/gi, "\:\"\""));
        }

        await xglobal.action_logs(lic_code, action[0].id, 'อนุมัติข้อมูลการจอง', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลการอนุมัติสำเร็จ', updatedData);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};