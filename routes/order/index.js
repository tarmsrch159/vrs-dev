const express = require('express');
const router = express.Router();
const order = require('./order')
const order_type = require('./order-type');
const order_vehicle = require('./order-vehicle');
const order_driver = require('./order-driver');
const order_route = require('./order-route');
const order_close = require('./order-close');
const order_expenses = require('./order-expenses');
const order_configuraiton = require('./order-configuration')
const order_sync_non_vmi = require('./order-sync-non-vmi');
const order_sync_vmi = require('./order-sync-vmi');
const order_calculate = require('./order-calculate');

//order
router.post('/information', order.getOrderInformation);
router.post('/runout/information', order.getOrderRunout);
router.post('/report/information', order.getOrderReport);
router.post('/confirm/information', order.getConfirmOrder);
router.post('/order-logs/information', order.getLoggingOrderInformation);
router.put('/information', order.addOrderInformation);
router.patch('/information', order.setOrderInformation);
router.patch('/status-deli/information', order.setStatusDeli);
router.delete('/information/remove', order.removeOrderInformationById);

//order for accept
// router.post('/tmp-status/information', order.getOrderTMPStatusInformation);
// router.post('/tmp-status/accept/information', order.setAceptOrderTMPStatusInformation);
// router.post('/tmp-status/decline/information', order.setDeclineOrderTMPStatusInformation);

//sync order
// router.post('/sync/non-vmi/information', order_sync_non_vmi.getOrderNonVMIInformation);
// router.post('/sync/non-vmi/information-with-number', order_sync_non_vmi.getOrderNonVMIInformationWithNumber);
// router.post('/sync/vmi/information', order_sync_vmi.getOrderVMIInformation);

//confirm
// router.post('/confirm/information', order.setConfirmedOrderInformation);
// router.post('/cancel/information', order.setCanceldOrderInformation);
//plan
router.post('/vehicle/information', order_vehicle.getVehicleOfOrderInformation);
router.post('/driver/information', order_driver.getDriverOfOrderInformation);
// router.post('/assign-jobs/information', order.setAssignJobsOrderInformation);
// router.post('/cancel-jobs/information', order.setCancelJobsOrderInformation);
router.post('/expenses/information', order_expenses.getExpensesOfOrderInformation);
router.post('/route/information', order_route.getRouteOfOrderInformation);
router.patch('/route/information', order_route.setRouteOfOrderInformation);
//close
router.post('/close/vehicle/information', order_close.getVehicleOrderForCloseInformation);
router.post('/close/driver/information', order_close.getDriverOrderForCloseInformation);
//order type
router.post('/type/information', order_type.getOrderTypeInformation);

//configuration
//แก้ไขข้อมูลคลังน้ำมัน
router.patch('/configuration/location/depot/information', order_configuraiton.setLocationDepotOrderInformation);
//เพิ่มข้อมูลคลังน้ำมัน
router.put('/configuration/location/depot/information', order_configuraiton.addLocationDepotOrderInformation);
// ดึงข้อมูลน้ำมัน
router.post('/configuration/item/information', order_configuraiton.getItemOfOrderInformationForConfig);

router.post('/information/itemForPetol', order_configuraiton.getItemOfOrderInformationForPetrol);
//แก้ไขข้อมูลปั้มน้ำมัน
router.patch('/configuration/location/petrol/information', order_configuraiton.setLocationPetrolOrderInformation);
//เพิ่มข้อมูลปั้มน้ำมัน
router.put('/configuration/location/petrol/information', order_configuraiton.addLocationPetrolOrderInformation);
//แก้ไขข้อมูลน้ำมัน
router.patch('/configuration/vmi-order/fuel/information', order_configuraiton.setFuelOrderInformation);
//ยกเลิก order VMI
router.patch('/configuration/vmi-order/cancel/information', order_configuraiton.setCancelOrderInformation);
//แก้ไขวันที่ส่งน้ำมัน
router.patch('/configuration/req-dt/information', order_configuraiton.setDateTimeOrderInformation);

//calculate 
router.post('/compartment/calculate/information', order_calculate.getFuelFilltoCompartment);
//verifyFuelFromJobToVehicle

// //คำนวณการบรรจุน้ำมัน
// router.post('/fuel/calculate', func.calcFuel);
// router.post('/fuel/verify', func.verifyFuel);
// router.post('/fuel/verify-job', func.verifyJobs);

// //คำนวณการบรรจุน้ำมันหลายออเดอร์
// router.post('/list/fuel', func.getFuelOrderList)

module.exports = router;