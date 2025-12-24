import express from 'express';
import {
  createUnit,
  getAllUnits,
  getUnitById,
  updateUnit,
  deleteUnit
} from './unit.controller';
import { auth, authenticatedActionLimiter, apiLimiter } from '@/middlewares';

const router = express.Router();

router.post('/', auth('admin'), authenticatedActionLimiter, createUnit);

router.get('/', apiLimiter, getAllUnits);

router.get('/:id', apiLimiter, getUnitById);

router.patch('/:id', auth('admin'), authenticatedActionLimiter, updateUnit);

router.delete('/:id', auth('admin'), authenticatedActionLimiter, deleteUnit);

export const unitRouter = router;

