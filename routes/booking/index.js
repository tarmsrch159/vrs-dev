const express = require("express");
const router = express.Router();
const booking = require("./booking");

// booking
router.post("/information", booking.getBookingInformation);
router.put("/information", booking.addBookingInformation);

module.exports = router;
