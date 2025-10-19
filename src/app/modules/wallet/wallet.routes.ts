import express from 'express';
import {
  getWalletBalance,
  getTransactions,
  addFundsToWallet
} from './wallet.controller';
import { auth, authenticatedActionLimiter } from '@/middlewares';

const router = express.Router();

router.post('/add', auth('admin'), authenticatedActionLimiter, addFundsToWallet);

router.get('/balance', auth('user'), authenticatedActionLimiter, getWalletBalance);

router.get('/transactions', auth('user'), authenticatedActionLimiter, getTransactions);

export const walletRouter = router;