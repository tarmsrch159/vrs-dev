const express = require('express');
const router = express.Router();
const vehicle = require('./vehicle')
const vehicle_group = require('./vehicle-group')
const vehicle_group_depot = require('./vehicle-group-depot')
const vehicle_unavailable_type = require('./vehicle-unavailable-type')
const vehicle_unavailable = require('./vehicle-unavailable')
const vehicle_compartment = require('./vehicle-compartment')
const vehicle_compartment_level = require('./vehicle-compartment-level')
const vehicle_type = require('./vehicle-type')

//vehicle
router.post('/information', vehicle.getVehicleInformation);
router.delete('/information', vehicle.removeVehicle);
router.patch('/information', vehicle.setVehicleInformation);
router.put('/information', vehicle.addVehicleInformation);

//group
router.post('/group/information', vehicle_group.getVehicleGroupInformation);
router.post('/group/table-information', vehicle_group.getVehicleGroupTableInformation);
router.delete('/group/information', vehicle_group.removeVehicleGroup);
router.patch('/group/information', vehicle_group.setVehicleGroupInformation);
router.put('/group/information', vehicle_group.addVehicleGroupInformation);

//group depot
router.post('/group/depot/information', vehicle_group_depot.getVehicleGroupDepotInformation);
router.delete('/group/depot/information', vehicle_group_depot.removeVehicleGroupDepot);
router.patch('/group/depot/information', vehicle_group_depot.setVehicleGroupDepotInformation);
router.put('/group/depot/information', vehicle_group_depot.addVehicleGroupDepotInformation);

//type
router.post('/type/information', vehicle_type.getVehicleTypeInformation);
router.delete('/type/information', vehicle_type.removeVehicleType);
router.patch('/type/information', vehicle_type.setVehicleTypeInformation);
router.put('/type/information', vehicle_type.addVehicleTypeInformation);
router.delete('/type/compartment/information', vehicle_type.removeCompartmentItemById);

//unavailable type
router.post('/unavailable/type/information', vehicle_unavailable_type.getVehicleUnavailableTypeInformation);
router.delete('/unavailable/type/information', vehicle_unavailable_type.removeVehicleUnavailableType);
router.patch('/unavailable/type/information', vehicle_unavailable_type.setVehicleUnavailableTypeInformation);
router.put('/unavailable/type/information', vehicle_unavailable_type.addVehicleUnavailableTypeInformation);

//unavailable 
router.post('/unavailable/information', vehicle_unavailable.getVehicleUnavailableInformation);
router.delete('/unavailable/information', vehicle_unavailable.removeVehicleUnavailable);
router.patch('/unavailable/information', vehicle_unavailable.setVehicleUnavailableInformation);
router.put('/unavailable/information', vehicle_unavailable.addVehicleUnavailableInformation);
router.put('/unavailable/multi-date/information', vehicle_unavailable.addVehicleUnavailableMutiDateInformation);

//compartment 
router.post('/compartment/information', vehicle_compartment.getVehicleCompartmentInformation);
router.delete('/compartment/information', vehicle_compartment.removeVehicleCompartment);
router.patch('/compartment/information', vehicle_compartment.setVehicleCompartmentInformation);
router.put('/compartment/information', vehicle_compartment.addVehicleCompartmentInformation);

//compartment level
router.post('/compartment/level/information', vehicle_compartment_level.getVehicleCompartmentLevelInformation);
router.delete('/compartment/level/information', vehicle_compartment_level.removeVehicleCompartmentLevel);
router.patch('/compartment/level/information', vehicle_compartment_level.setVehicleCompartmentLevelInformation);
router.put('/compartment/level/information', vehicle_compartment_level.addVehicleCompartmentLevelInformation);

module.exports = router;