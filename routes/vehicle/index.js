const express = require('express');
const router = express.Router();
const vehicle = require('./vehicle')
const vehicle_group = require('./vehicle-group')
const vehicle_type = require('./vehicle-type')
const vehicle_mode = require('./vehicle-mode')
const vehicle_brand = require('./vehicle-brand')
const vehicle_model = require('./vehicle-model')
const vehicle_submodel = require('./vehicle-submodel')
const vehicle_calendar = require('./vehicle-calendar')

//vehicle
router.post('/information', vehicle.getVehicleInformation);
router.delete('/information', vehicle.removeVehicle);
router.patch('/information', vehicle.setVehicleInformation);
router.put('/information', vehicle.addVehicleInformation);

//group
router.post('/vehicle-group/information', vehicle_group.getVehicleGroupInformation);
router.delete('/vehicle-group/information', vehicle_group.removeVehicleGroup);
router.patch('/vehicle-group/information', vehicle_group.setVehicleGroupInformation);
router.put('/vehicle-group/information', vehicle_group.addVehicleGroupInformation);

//vehicle type
router.post('/vehicle-type/information', vehicle_type.getVehicleTypeInformation);
router.patch('/vehicle-type/information', vehicle_type.setVehicleTypeInformation);
router.put('/vehicle-type/information', vehicle_type.addVehicleTypeInformation);
router.delete('/vehicle-type/information', vehicle_type.removeVehicleType);

//vehicle mode
router.post('/vehicle-mode/information', vehicle_mode.getVehicleModeInformation);
router.patch('/vehicle-mode/information', vehicle_mode.setVehicleModeInformation);
router.put('/vehicle-mode/information', vehicle_mode.addVehicleModeInformation);
router.delete('/vehicle-mode/information', vehicle_mode.removeVehicleMode);

//vehicle brand
router.post('/vehicle-brand/information', vehicle_brand.getVehicleBrandInformation);
router.patch('/vehicle-brand/information', vehicle_brand.setVehicleBrandInformation);
router.put('/vehicle-brand/information', vehicle_brand.addVehicleBrandInformation);
router.delete('/vehicle-brand/information', vehicle_brand.removeVehicleBrand);

//vehicle model
router.post('/vehicle-model/information', vehicle_model.getVehicleModelInformation);
router.patch('/vehicle-model/information', vehicle_model.setVehicleModelInformation);
router.put('/vehicle-model/information', vehicle_model.addVehicleModelInformation);
router.delete('/vehicle-model/information', vehicle_model.removeVehicleModel);

//vehicle submodel
router.post('/vehicle-submodel/information', vehicle_submodel.getVehicleSubmodelInformation);
router.patch('/vehicle-submodel/information', vehicle_submodel.setVehicleSubmodelInformation);
router.put('/vehicle-submodel/information', vehicle_submodel.addVehicleSubmodelInformation);
router.delete('/vehicle-submodel/information', vehicle_submodel.removeVehicleSubmodel);

//vehicle calendar
router.post('/vehicle-calendar/information', vehicle_calendar.getVehicleCalendarInformation);
router.patch('/vehicle-calendar/information', vehicle_calendar.setVehicleCalendarInformation);
router.put('/vehicle-calendar/information', vehicle_calendar.addVehicleCalendarInformation);
router.delete('/vehicle-calendar/information', vehicle_calendar.removeVehicleCalendar);

module.exports = router;