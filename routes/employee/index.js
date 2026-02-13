const express = require('express');
const router = express.Router();
const employee = require('./employee');
const employee_group = require('./employee-group');
const employee_role = require('./employee-role');

//employee
router.post('/information', employee.getEmployeeInformation);
router.delete('/information', employee.removeEmployee);
router.patch('/information', employee.setEmployeeInformation);
router.patch('/password/information', employee.setEmployeePasswordInformation);
router.put('/information', employee.addEmployeeInformation);

//group
router.post('/group/information', employee_group.getEmployeeGroupInformation);
router.delete('/group/information', employee_group.removeEmployeeGroup);
router.patch('/group/information', employee_group.setEmployeeGroupInformation);
router.put('/group/information', employee_group.addEmployeeGroupInformation);

//role
router.post('/role/information', employee_role.getEmployeeRoleInformation);

module.exports = router;