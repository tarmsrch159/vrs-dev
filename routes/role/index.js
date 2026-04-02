const express = require('express');
const router = express.Router();
const role = require('./role')

//authority
router.post('/information', role.getAuthorityInformation);
router.delete('/information', role.removeAuthority);
router.patch('/information', role.setAuthorityInformation);
router.put('/information', role.addAuthorityInformation);


module.exports = router;