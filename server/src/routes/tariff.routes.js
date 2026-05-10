const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const tariffs = await executeQuery(
    `SELECT tc.*, COUNT(tt.id) as tier_count 
     FROM tariff_configs tc 
     LEFT JOIN tariff_tiers tt ON tc.id = tt.tariff_config_id 
     WHERE tc.is_active IN (0, 1)
     GROUP BY tc.id ORDER BY tc.property_type, tc.name`
  );
  res.json({ success: true, data: tariffs });
}));

router.get('/:id/tiers', verifyToken, asyncHandler(async (req, res) => {
  const tiers = await executeQuery(
    'SELECT * FROM tariff_tiers WHERE tariff_config_id = ? ORDER BY tier_order',
    [req.params.id]
  );
  res.json({ success: true, data: tiers });
}));

router.post('/', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, propertyType, standingCharge, sewerageRate, meterRent, effectiveFrom, tiers } = req.body;
  
  const result = await executeQuery(
    `INSERT INTO tariff_configs (name, property_type, standing_charge, sewerage_rate, meter_rent, effective_from, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, propertyType, standingCharge, sewerageRate, meterRent, effectiveFrom, req.user.id]
  );
  
  const configId = result.insertId;
  
  // Insert tiers
  if (tiers && tiers.length > 0) {
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      await executeQuery(
        `INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit)
         VALUES (?, ?, ?, ?, ?)`,
        [configId, i + 1, tier.minConsumption, tier.maxConsumption, tier.ratePerUnit]
      );
    }
  }
  
  res.status(201).json({ success: true, data: { id: configId } });
}));

router.put('/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, propertyType, standingCharge, sewerageRate, meterRent, effectiveFrom, isActive } = req.body;
  
  const fields = [];
  const values = [];
  
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (propertyType !== undefined) { fields.push('property_type = ?'); values.push(propertyType); }
  if (standingCharge !== undefined) { fields.push('standing_charge = ?'); values.push(standingCharge); }
  if (sewerageRate !== undefined) { fields.push('sewerage_rate = ?'); values.push(sewerageRate); }
  if (meterRent !== undefined) { fields.push('meter_rent = ?'); values.push(meterRent); }
  if (effectiveFrom !== undefined) { fields.push('effective_from = ?'); values.push(effectiveFrom); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }
  
  if (fields.length > 0) {
    values.push(req.params.id);
    await executeQuery(
      `UPDATE tariff_configs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }
  
  // Update tiers if provided
  if (req.body.tiers !== undefined) {
    await executeQuery('DELETE FROM tariff_tiers WHERE tariff_config_id = ?', [req.params.id]);
    for (let i = 0; i < req.body.tiers.length; i++) {
      const tier = req.body.tiers[i];
      await executeQuery(
        `INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit)
         VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, i + 1, tier.minConsumption, tier.maxConsumption, tier.ratePerUnit]
      );
    }
  }
  
  res.json({ success: true, data: { id: req.params.id } });
}));

module.exports = router;
