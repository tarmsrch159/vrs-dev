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
router.post('/order-logs/information', order.getLoggingOrderInformation);
router.put('/information', order.addOrderInformation);
router.patch('/information', order.setOrderInformation);
router.patch('/status-deli/information', order.setStatusDeli);
router.delete('/information/remove', order.removeOrderInformationById);

//Order - SAP
router.post('/confirm/information', order.getConfirmOrder);
router.post('/order-hana/information', order.getOrderInformationHana);
router.post('/cancel-hana/information', order.cancelOrderInformationHana);
module.exports = router;