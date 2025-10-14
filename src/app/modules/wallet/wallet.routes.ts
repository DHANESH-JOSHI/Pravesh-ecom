import express from 'express';
import {
    getWalletBalance,
    getTransactions,
    addFundsToWallet
} from './wallet.controller';
import { auth } from '@/middlewares';

const router = express.Router();

router.post('/add', auth('admin'), addFundsToWallet);

router.get('/balance', auth('user'), getWalletBalance);

router.get('/transactions', auth('user'), getTransactions);

export const walletRouter = router;