const express = require('express');
const router = express.Router();
const blackbox = require('./blackbox')

// blackbox
router.post('/information', blackbox.getBlackboxInformation);
router.delete('/information', blackbox.removeBlackbox);
router.patch('/information', blackbox.setBlackboxInformation);
router.put('/information', blackbox.addBlackboxInformation);

module.exports = router;