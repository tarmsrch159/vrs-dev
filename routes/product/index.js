const express = require("express");
const router = express.Router();
const product = require("./product");
const productType = require("./product-type");

//product
router.post("/information", product.getProductInformation);
router.delete("/information", product.removeProduct);
router.patch("/information", product.setProductInformation);
router.put("/information", product.addProductInformation);

//product-type
router.post("/type/information", productType.getProductTypeInformation);
router.delete("/type/information", productType.removeProductType);
router.patch("/type/information", productType.setProductTypeInformation);
router.put("/type/information", productType.addProductTypeInformation);

module.exports = router;
