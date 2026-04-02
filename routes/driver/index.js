const express = require('express');
const router = express.Router();
const driver = require('./driver')
const driverCalendar = require('./driver-calendar')
const driverOvertime = require('./driver-overtime')

//driver
router.post('/information', driver.getDriverInformation);
router.delete('/information', driver.removeDriver);
router.patch('/information', driver.setDriverInformation);
router.patch('/password/information', driver.setDriverPasswordInformation);
router.put('/information', driver.addDriverInformation);

//driver-calendar
router.post('/calendar/information', driverCalendar.getDriverCalendarInformation);
router.delete('/calendar/information', driverCalendar.removeDriverCalendar);
router.patch('/calendar/information', driverCalendar.setDriverCalendarInformation);
router.put('/calendar/information', driverCalendar.addDriverCalendarInformation);

//driver-overtime
router.post('/overtime/information', driverOvertime.getDriverOvertimeInformation);
router.delete('/overtime/information', driverOvertime.removeDriverOvertime);
router.patch('/overtime/information', driverOvertime.setDriverOvertimeInformation);
router.put('/overtime/information', driverOvertime.addDriverOvertimeInformation);


module.exports = router;