import jwt from 'jsonwebtoken';
import { IUser } from '@/modules/user/user.interface';
import config from '@/config';
export const generateToken = (user: IUser) => {
  const payload = {
    userId: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
};
