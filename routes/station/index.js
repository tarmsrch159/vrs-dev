const express = require('express');
const router = express.Router();
const station = require('./station');
const stationType = require('./station-type');

// =========================================================================
// Routes สำหรับจัดการข้อมูลสถานที่ (Station Routes)
// =========================================================================
router.post('/information', station.getStationInformation);
router.put('/information', station.addStationInformation);
router.patch('/information', station.setStationInformation);
router.delete('/information/remove', station.removeStationInformationById);

// =========================================================================
// Routes สำหรับจัดการประเภทสถานที่ (Station Type Routes)
// =========================================================================
router.post('/type/information', stationType.getStationTypeInformation);
router.put('/type/information', stationType.addStationTypeInformation);
router.patch('/type/information', stationType.setStationTypeInformation);
router.delete('/type/remove', stationType.removeStationTypeInformationById);

module.exports = router;